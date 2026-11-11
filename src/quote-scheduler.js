"use strict";

const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
const MAX_GAP_SECONDS = 300;

function createQuoteSchedule(input = {}) {
  const startedAt = Number(input.startedAt);
  const durationMs = Number(input.durationMs);
  const gapSeconds = Number(input.gapSeconds);

  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return {ok:false,code:"INVALID_START_TIME",message:"引用再生の開始時刻を確認できません。"};
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_DURATION_MS) {
    return {ok:false,code:"INVALID_DURATION",message:"動画時間を登録すると自動次動画を予約できます。"};
  }
  if (!Number.isInteger(gapSeconds) || gapSeconds < 0 || gapSeconds > MAX_GAP_SECONDS) {
    return {ok:false,code:"INVALID_GAP",message:"次動画へ移る間隔は0〜300秒で設定してください。"};
  }

  return {
    ok:true,
    startedAt,
    durationMs,
    gapSeconds,
    dueAt:startedAt + durationMs + gapSeconds * 1000
  };
}

function getRemainingMs(schedule, now = Date.now()) {
  if (!schedule || !Number.isFinite(Number(schedule.dueAt))) return null;
  const currentTime = Number(now);
  if (!Number.isFinite(currentTime)) return null;
  return Math.max(0, Number(schedule.dueAt) - currentTime);
}

function isQuoteScheduleDue(schedule, now = Date.now()) {
  const remaining = getRemainingMs(schedule, now);
  return remaining !== null && remaining <= 0;
}

module.exports = {
  MAX_DURATION_MS,
  MAX_GAP_SECONDS,
  createQuoteSchedule,
  getRemainingMs,
  isQuoteScheduleDue
};
