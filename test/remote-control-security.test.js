"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_PAIRING_ATTEMPTS,
  createPairingChallenge,
  verifyPairingCode,
  createDeviceCredential,
  verifyDeviceToken,
  revokeRemoteDevice,
  canExecuteRemoteCommand,
  sanitizeRemoteDevice,
  isLoopbackBindAddress,
  RemoteRateLimiter
} = require("../src/remote-control-security");

test("pairing code is short-lived, accepted once, and stored as a salted hash", () => {
  const now = 1_800_000_000_000;
  const { code, challenge } = createPairingChallenge(now, 60_000);

  assert.match(code, /^[A-F0-9]{12}$/);
  assert.notEqual(challenge.hash, code);
  assert.equal(challenge.hash.length, 64);
  assert.equal(challenge.salt.length, 32);
  assert.equal(challenge.expiresAt, now + 60_000);

  const verified = verifyPairingCode(code, challenge, now + 1);
  assert.equal(verified.ok, true);
  assert.equal(verified.reason, "PAIRED");
  assert.equal(verified.challenge.consumedAt, now + 1);

  const reused = verifyPairingCode(code, verified.challenge, now + 2);
  assert.equal(reused.ok, false);
  assert.equal(reused.reason, "ALREADY_USED");
});

test("pairing rejects expired challenges and locks after five wrong attempts", () => {
  const now = 1_800_000_000_000;
  const expired = createPairingChallenge(now, 30_000);
  assert.equal(verifyPairingCode(expired.code, expired.challenge, now + 30_000).reason, "EXPIRED");

  const pair = createPairingChallenge(now, 60_000);
  let challenge = pair.challenge;
  for (let attempt = 0; attempt < MAX_PAIRING_ATTEMPTS; attempt += 1) {
    const result = verifyPairingCode("FFFFFFFFFFFF", challenge, now + attempt);
    challenge = result.challenge;
    assert.equal(result.ok, false);
  }
  assert.equal(challenge.attempts, MAX_PAIRING_ATTEMPTS);
  assert.equal(verifyPairingCode(pair.code, challenge, now + 10).reason, "LOCKED");
});

test("pairing inputs and challenge lifetimes are validated", () => {
  assert.throws(() => createPairingChallenge(-1), /creation time/i);
  assert.throws(() => createPairingChallenge(1000, 10_000), /lifetime/i);
  assert.equal(verifyPairingCode({}, null).reason, "INVALID_CHALLENGE");
});

test("device credential returns the secret once and stores only its SHA-256 hash", () => {
  const { token, device } = createDeviceCredential({
    name: "  配信PC\n  ",
    permissions: ["status:read", "bgm:control", "admin:all", "status:read"],
    now: 1_800_000_000_000
  });

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(device.name, "配信PC");
  assert.equal(device.tokenHash.length, 64);
  assert.equal(JSON.stringify(device).includes(token), false);
  assert.deepEqual(device.permissions, ["status:read", "bgm:control"]);
  assert.equal(verifyDeviceToken(token, device), true);
  assert.equal(verifyDeviceToken("wrong-token-that-is-long-enough-1234567890", device), false);
});

test("revocation and command permissions deny unknown or dangerous operations", () => {
  const { device } = createDeviceCredential({
    name: "Remote",
    permissions: ["status:read", "player:control"],
    now: 1_800_000_000_000
  });
  assert.equal(canExecuteRemoteCommand(device, "status:read"), true);
  assert.equal(canExecuteRemoteCommand(device, "player:next"), true);
  assert.equal(canExecuteRemoteCommand(device, "bgm:next"), false);
  assert.equal(canExecuteRemoteCommand(device, "broadcast:start"), false);
  assert.equal(canExecuteRemoteCommand(device, "__proto__"), false);

  const revoked = revokeRemoteDevice(device, 1_800_000_001_000);
  assert.ok(revoked.revokedAt);
  assert.equal(canExecuteRemoteCommand(revoked, "status:read"), false);
  assert.equal(verifyDeviceToken("A".repeat(43), revoked), false);
  assert.equal(revokeRemoteDevice(null), null);
});

test("device display data never includes the credential hash", () => {
  const { device } = createDeviceCredential({ name: "Tablet" });
  const safe = sanitizeRemoteDevice(device);
  assert.equal(safe.id, device.id);
  assert.equal(safe.name, "Tablet");
  assert.equal("tokenHash" in safe, false);
  assert.equal(sanitizeRemoteDevice(null), null);
});

test("only loopback bind addresses are accepted by the default policy", () => {
  assert.equal(isLoopbackBindAddress("127.0.0.1"), true);
  assert.equal(isLoopbackBindAddress("localhost"), true);
  assert.equal(isLoopbackBindAddress("::1"), true);
  assert.equal(isLoopbackBindAddress("[::1]"), true);
  assert.equal(isLoopbackBindAddress("0.0.0.0"), false);
  assert.equal(isLoopbackBindAddress("192.168.1.20"), false);
  assert.equal(isLoopbackBindAddress("example.com"), false);
});

test("rate limiter bounds requests per key and resets after its window", () => {
  const limiter = new RemoteRateLimiter({ windowMs: 10_000, maxRequests: 2, maxKeys: 2 });
  assert.equal(limiter.consume("device-a", 1000).allowed, true);
  assert.equal(limiter.consume("device-a", 1001).remaining, 0);
  const denied = limiter.consume("device-a", 1002);
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "RATE_LIMITED");
  assert.equal(denied.retryAfterMs, 9998);
  assert.equal(limiter.consume("device-a", 11_000).allowed, true);
  assert.equal(limiter.consume("", 11_000).code, "INVALID_KEY");
  limiter.reset();
  assert.equal(limiter.entries.size, 0);
});
