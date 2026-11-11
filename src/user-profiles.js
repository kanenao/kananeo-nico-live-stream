"use strict";

(() => {
  const MAX_USER_PROFILES = 5000;

  function cleanText(value, limit) {
    return String(value ?? "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, limit);
  }

  function safeDate(value, fallback) {
    const date = value ? new Date(value) : new Date(fallback || Date.now());
    return Number.isNaN(date.getTime()) ? new Date(fallback || Date.now()).toISOString() : date.toISOString();
  }

  function normalizeUserId(value) {
    return cleanText(value, 128).replace(/\s+/g, "");
  }

  function normalizeUserProfile(input = {}, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const userId = normalizeUserId(input.userId || input.id);
    if (!userId) return null;
    const nickname = cleanText(input.nickname || input.name, 80);
    const memo = cleanText(input.memo || input.note, 1000);
    if (!nickname && !memo) return null;
    const now = safeDate(options.now);
    return {
      userId,
      nickname,
      memo,
      createdAt: safeDate(input.createdAt, now),
      updatedAt: safeDate(input.updatedAt, now)
    };
  }

  function normalizeUserProfiles(input) {
    const rows = Array.isArray(input) ? input : [];
    const profiles = [];
    const seen = new Set();
    for (const raw of rows) {
      const profile = normalizeUserProfile(raw);
      if (!profile || seen.has(profile.userId)) continue;
      seen.add(profile.userId);
      profiles.push(profile);
      if (profiles.length >= MAX_USER_PROFILES) break;
    }
    return profiles;
  }

  function upsertUserProfile(inputProfiles, inputProfile, options = {}) {
    const profiles = normalizeUserProfiles(inputProfiles);
    const profile = normalizeUserProfile(inputProfile, options);
    if (!profile) return { ok:false, code:"INVALID_PROFILE", profiles };
    const index = profiles.findIndex(item => item.userId === profile.userId);
    if (index < 0 && profiles.length >= MAX_USER_PROFILES) {
      return { ok:false, code:"PROFILE_LIMIT", profiles };
    }
    if (index >= 0) {
      profile.createdAt = profiles[index].createdAt;
      profiles[index] = profile;
    } else {
      profiles.unshift(profile);
    }
    return { ok:true, profile, profiles };
  }

  function removeUserProfile(inputProfiles, userIdInput) {
    const profiles = normalizeUserProfiles(inputProfiles);
    const userId = normalizeUserId(userIdInput);
    if (!userId) return { ok:false, code:"INVALID_USER_ID", profiles, removed:false };
    const next = profiles.filter(item => item.userId !== userId);
    return { ok:true, profiles:next, removed:next.length !== profiles.length };
  }

  function findUserProfile(inputProfiles, userIdInput) {
    const userId = normalizeUserId(userIdInput);
    if (!userId) return null;
    return normalizeUserProfiles(inputProfiles).find(item => item.userId === userId) || null;
  }

  window.KananeoUserProfiles = Object.freeze({
    MAX_USER_PROFILES,
    normalizeUserId,
    normalizeUserProfile,
    normalizeUserProfiles,
    upsertUserProfile,
    removeUserProfile,
    findUserProfile
  });
})();
