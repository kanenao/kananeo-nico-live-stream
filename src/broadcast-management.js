"use strict";
// Keep declarations private: classic browser scripts share one global lexical scope.
(() => {

const VERIFICATION_TTL_MS = 90 * 1000;

const STATUS_LABELS = Object.freeze({
  ON_AIR: "放送中",
  ONAIR: "放送中",
  TEST: "テスト放送",
  RESERVED: "予約",
  RESERVE: "予約",
  SCHEDULED: "放送前",
  WAITING: "放送前",
  ENDED: "終了",
  END: "終了",
  CLOSED: "終了"
});

function normalizeProgramStatus(status) {
  const code = typeof status === "string" ? status.trim().toUpperCase() : "";
  return {
    code,
    label: STATUS_LABELS[code] || "状態未確認",
    isLive: code === "ON_AIR" || code === "ONAIR" || code === "TEST"
  };
}

function createBroadcastVerification(program, checkedAt = Date.now()) {
  if (!program || program.ok !== true) return null;

  const programId = String(program.programId || "").trim().toLowerCase();
  const timestamp = Number(checkedAt);
  if (!/^lv\d+$/.test(programId) || !Number.isFinite(timestamp) || timestamp <= 0) return null;

  const status = normalizeProgramStatus(program.programStatus);
  const endTime = Number(program.endTime);

  return {
    programId,
    title: typeof program.title === "string" && program.title.trim()
      ? program.title.trim().slice(0, 200)
      : programId,
    status: status.code,
    statusLabel: status.label,
    isLive: status.isLive,
    endTime: Number.isFinite(endTime) && endTime > 0 ? endTime : null,
    checkedAt: timestamp
  };
}

function isBroadcastVerificationFresh(verification, programId, now = Date.now()) {
  if (!verification || typeof verification !== "object") return false;
  const expectedId = String(programId || "").trim().toLowerCase();
  const checkedAt = Number(verification.checkedAt);
  const currentTime = Number(now);
  if (!/^lv\d+$/.test(expectedId) || expectedId !== verification.programId) return false;
  if (!Number.isFinite(checkedAt) || !Number.isFinite(currentTime)) return false;
  const age = currentTime - checkedAt;
  return age >= 0 && age <= VERIFICATION_TTL_MS;
}

 
function evaluateAutoNextFrame(runtime, programs, lastTriggeredId = "") {
  const validId = value => /^lv\d{1,20}$/.test(String(value || "").toLowerCase());
  const armed = validId(runtime?.armedProgramId) ? String(runtime.armedProgramId).toLowerCase() : "";
  const rows = (Array.isArray(programs) ? programs : []).filter(item => validId(item?.programId));
  const id = item => String(item?.programId || "").toLowerCase();
  const status = item => String(item?.programStatus || "").toUpperCase();
  const live = rows.find(item => ["ON_AIR","ONAIR","TEST"].includes(status(item)));
  if (live) return {armedProgramId:id(live),triggerProgramId:"",reason:"watching-live"};
  if (!armed) return {armedProgramId:"",triggerProgramId:"",reason:"awaiting-live"};
  const previous = rows.find(item => id(item) === armed);
  if (!previous || !["ENDED","END","CLOSED"].includes(status(previous)))
    return {armedProgramId:armed,triggerProgramId:"",reason:"awaiting-ended-status"};
  if (rows.some(item => id(item) !== armed && ["RESERVED","RESERVE","SCHEDULED","WAITING"].includes(status(item))))
    return {armedProgramId:"",triggerProgramId:"",reason:"next-already-exists"};
  if (String(lastTriggeredId || "").toLowerCase() === armed)
    return {armedProgramId:"",triggerProgramId:"",reason:"already-triggered"};
  return {armedProgramId:armed,triggerProgramId:armed,reason:"ended"};
}

const api = Object.freeze({
  evaluateAutoNextFrame,
  VERIFICATION_TTL_MS,
  normalizeProgramStatus,
  createBroadcastVerification,
  isBroadcastVerificationFresh
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.KananeoBroadcastManagement = api;
})();
