"use strict";

const {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} = require("node:crypto");

const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
const MAX_PAIRING_TTL_MS = 15 * 60 * 1000;
const MAX_PAIRING_ATTEMPTS = 5;
const DEFAULT_RATE_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 30;

const DEVICE_PERMISSIONS = Object.freeze([
  "status:read",
  "comments:read",
  "player:control",
  "bgm:control"
]);

const REMOTE_COMMAND_PERMISSIONS = Object.freeze({
  "status:read": "status:read",
  "comments:read": "comments:read",
  "player:pause": "player:control",
  "player:next": "player:control",
  "player:stop": "player:control",
  "bgm:play": "bgm:control",
  "bgm:pause": "bgm:control",
  "bgm:next": "bgm:control",
  "bgm:volume": "bgm:control"
});

function isSafeTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizePairingCode(value) {
  if (typeof value !== "string" || value.length > 32) return "";
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function createPairingChallenge(now = Date.now(), ttlMs = DEFAULT_PAIRING_TTL_MS) {
  if (!isSafeTimestamp(now)) throw new TypeError("Invalid creation time");
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 30_000 || ttlMs > MAX_PAIRING_TTL_MS) {
    throw new RangeError("Pairing code lifetime must be between 30 seconds and 15 minutes");
  }

  const code = randomBytes(6).toString("hex").toUpperCase();
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 32, { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

  return {
    code,
    challenge: {
      version: 1,
      salt: salt.toString("hex"),
      hash: hash.toString("hex"),
      expiresAt: now + ttlMs,
      attempts: 0,
      consumedAt: null
    }
  };
}

function isValidChallenge(challenge) {
  return !!challenge &&
    challenge.version === 1 &&
    typeof challenge.salt === "string" &&
    /^[a-f0-9]{32}$/i.test(challenge.salt) &&
    typeof challenge.hash === "string" &&
    /^[a-f0-9]{64}$/i.test(challenge.hash) &&
    isSafeTimestamp(challenge.expiresAt) &&
    Number.isInteger(challenge.attempts) &&
    challenge.attempts >= 0 &&
    challenge.attempts <= MAX_PAIRING_ATTEMPTS;
}

function verifyPairingCode(candidate, challenge, now = Date.now()) {
  if (!isSafeTimestamp(now) || !isValidChallenge(challenge)) {
    return { ok: false, reason: "INVALID_CHALLENGE", challenge: null, attemptsRemaining: 0 };
  }
  if (challenge.consumedAt !== null) {
    return { ok: false, reason: "ALREADY_USED", challenge, attemptsRemaining: 0 };
  }
  if (now >= challenge.expiresAt) {
    return { ok: false, reason: "EXPIRED", challenge, attemptsRemaining: 0 };
  }
  if (challenge.attempts >= MAX_PAIRING_ATTEMPTS) {
    return { ok: false, reason: "LOCKED", challenge, attemptsRemaining: 0 };
  }

  const normalized = normalizePairingCode(candidate);
  const formatIsValid = /^[A-F0-9]{12}$/.test(normalized);
  const valueToCheck = formatIsValid ? normalized : "000000000000";
  const actual = scryptSync(
    valueToCheck,
    Buffer.from(challenge.salt, "hex"),
    32,
    { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
  );
  const expected = Buffer.from(challenge.hash, "hex");
  const matches = timingSafeEqual(actual, expected) && formatIsValid;

  if (!matches) {
    const attempts = challenge.attempts + 1;
    const updatedChallenge = { ...challenge, attempts };
    return {
      ok: false,
      reason: attempts >= MAX_PAIRING_ATTEMPTS ? "LOCKED" : "BAD_CODE",
      challenge: updatedChallenge,
      attemptsRemaining: Math.max(0, MAX_PAIRING_ATTEMPTS - attempts)
    };
  }

  return {
    ok: true,
    reason: "PAIRED",
    challenge: { ...challenge, consumedAt: now },
    attemptsRemaining: MAX_PAIRING_ATTEMPTS - challenge.attempts
  };
}

function normalizeDeviceName(value) {
  if (typeof value !== "string") return "未設定デバイス";
  const normalized = Array.from(value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .slice(0, 40)
    .join("");
  return normalized || "未設定デバイス";
}

function normalizeDevicePermissions(value) {
  if (!Array.isArray(value)) return ["status:read", "comments:read"];
  return [...new Set(value.filter(permission =>
    typeof permission === "string" && DEVICE_PERMISSIONS.includes(permission)
  ))];
}

function hashDeviceToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createDeviceCredential({ name, permissions, now = Date.now() } = {}) {
  if (!isSafeTimestamp(now)) throw new TypeError("Invalid creation time");

  const token = randomBytes(32).toString("base64url");
  const device = {
    id: randomUUID(),
    name: normalizeDeviceName(name),
    tokenHash: hashDeviceToken(token),
    permissions: normalizeDevicePermissions(permissions),
    createdAt: new Date(now).toISOString(),
    lastSeenAt: null,
    revokedAt: null
  };

  return { token, device };
}

function verifyDeviceToken(token, device) {
  if (typeof token !== "string" || token.length < 40 || token.length > 64) return false;
  if (!device || typeof device !== "object" || device.revokedAt !== null) return false;
  if (typeof device.tokenHash !== "string" || !/^[a-f0-9]{64}$/i.test(device.tokenHash)) return false;

  const actual = Buffer.from(hashDeviceToken(token), "hex");
  const expected = Buffer.from(device.tokenHash, "hex");
  return timingSafeEqual(actual, expected);
}

function revokeRemoteDevice(device, now = Date.now()) {
  if (!device || typeof device !== "object" || typeof device.id !== "string" || !device.id) return null;
  if (!isSafeTimestamp(now)) throw new TypeError("Invalid revocation time");
  if (device.revokedAt) return { ...device };
  return { ...device, revokedAt: new Date(now).toISOString() };
}

function canExecuteRemoteCommand(device, command) {
  if (!device || typeof device !== "object" || device.revokedAt !== null) return false;
  if (typeof command !== "string") return false;
  const requiredPermission = REMOTE_COMMAND_PERMISSIONS[command];
  return !!requiredPermission &&
    Array.isArray(device.permissions) &&
    device.permissions.includes(requiredPermission);
}

function sanitizeRemoteDevice(device) {
  if (!device || typeof device !== "object") return null;
  return {
    id: typeof device.id === "string" ? device.id : "",
    name: normalizeDeviceName(device.name),
    permissions: normalizeDevicePermissions(device.permissions),
    createdAt: typeof device.createdAt === "string" ? device.createdAt : "",
    lastSeenAt: typeof device.lastSeenAt === "string" ? device.lastSeenAt : null,
    revokedAt: typeof device.revokedAt === "string" ? device.revokedAt : null
  };
}

function isLoopbackBindAddress(address) {
  if (typeof address !== "string") return false;
  const normalized = address.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

class RemoteRateLimiter {
  constructor({
    windowMs = DEFAULT_RATE_WINDOW_MS,
    maxRequests = DEFAULT_RATE_LIMIT,
    maxKeys = 256
  } = {}) {
    if (!Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 60 * 60 * 1000) {
      throw new RangeError("Invalid rate-limit window");
    }
    if (!Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > 10_000) {
      throw new RangeError("Invalid rate limit");
    }
    if (!Number.isSafeInteger(maxKeys) || maxKeys < 1 || maxKeys > 10_000) {
      throw new RangeError("Invalid rate-limit key capacity");
    }
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxKeys = maxKeys;
    this.entries = new Map();
  }

  consume(key, now = Date.now()) {
    if (typeof key !== "string" || !key || key.length > 128 || !isSafeTimestamp(now)) {
      return { allowed: false, code: "INVALID_KEY", remaining: 0, retryAfterMs: 0 };
    }

    let entry = this.entries.get(key);
    if (!entry || now < entry.startedAt || now - entry.startedAt >= this.windowMs) {
      if (!entry && this.entries.size >= this.maxKeys) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey !== undefined) this.entries.delete(oldestKey);
      }
      entry = { startedAt: now, count: 0 };
      this.entries.set(key, entry);
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        code: "RATE_LIMITED",
        remaining: 0,
        retryAfterMs: Math.max(0, entry.startedAt + this.windowMs - now)
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      code: "OK",
      remaining: this.maxRequests - entry.count,
      retryAfterMs: 0
    };
  }

  clear(key) {
    if (typeof key === "string") this.entries.delete(key);
  }

  reset() {
    this.entries.clear();
  }
}

module.exports = {
  DEFAULT_PAIRING_TTL_MS,
  MAX_PAIRING_TTL_MS,
  MAX_PAIRING_ATTEMPTS,
  DEVICE_PERMISSIONS,
  REMOTE_COMMAND_PERMISSIONS,
  createPairingChallenge,
  verifyPairingCode,
  createDeviceCredential,
  verifyDeviceToken,
  revokeRemoteDevice,
  canExecuteRemoteCommand,
  sanitizeRemoteDevice,
  isLoopbackBindAddress,
  RemoteRateLimiter
};
