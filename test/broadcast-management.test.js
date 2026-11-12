"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  VERIFICATION_TTL_MS,
  normalizeProgramStatus,
  createBroadcastVerification,
  isBroadcastVerificationFresh
} = require("../src/broadcast-management");

test("normalizes known broadcast status values", () => {
  assert.deepEqual(normalizeProgramStatus("ON_AIR"), {
    code: "ON_AIR", label: "放送中", isLive: true
  });
  assert.equal(normalizeProgramStatus("test").label, "テスト放送");
  assert.equal(normalizeProgramStatus("ENDED").label, "終了");
  assert.equal(normalizeProgramStatus("unknown").label, "状態未確認");
});

test("creates verification only from a successful and valid program check", () => {
  const result = createBroadcastVerification({
    ok: true,
    programId: "LV123456789",
    title: "テスト配信",
    programStatus: "ON_AIR",
    endTime: 1900000000
  }, 100000);

  assert.deepEqual(result, {
    programId: "lv123456789",
    title: "テスト配信",
    status: "ON_AIR",
    statusLabel: "放送中",
    isLive: true,
    endTime: 1900000000,
    checkedAt: 100000
  });
  assert.equal(createBroadcastVerification({ok:false,programId:"lv123"}), null);
  assert.equal(createBroadcastVerification({ok:true,programId:"https://example.com/lv123"}), null);
  assert.equal(createBroadcastVerification({ok:true,programId:"lv123"}, 0), null);
});

test("requires a fresh verification for the exact target program ID", () => {
  const verification = createBroadcastVerification({
    ok: true, programId: "lv123456789", programStatus: "ENDED"
  }, 100000);

  assert.equal(isBroadcastVerificationFresh(verification, "lv123456789", 100000), true);
  assert.equal(isBroadcastVerificationFresh(verification, "LV123456789", 100000 + VERIFICATION_TTL_MS), true);
  assert.equal(isBroadcastVerificationFresh(verification, "lv123456789", 100001 + VERIFICATION_TTL_MS), false);
  assert.equal(isBroadcastVerificationFresh(verification, "lv987654321", 100001), false);
  assert.equal(isBroadcastVerificationFresh(verification, "", 100001), false);
  assert.equal(isBroadcastVerificationFresh(verification, "lv123456789", 99999), false);
  assert.equal(isBroadcastVerificationFresh(null, "lv123456789", 100001), false);
});
