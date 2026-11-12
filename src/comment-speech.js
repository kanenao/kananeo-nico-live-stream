"use strict";

const DEFAULT_COMMENT_SPEECH_SETTINGS = Object.freeze({
  enabled:false,
  includeName:false,
  speakOperator:false,
  rate:1,
  pitch:1,
  volume:1,
  voiceURI:"",
  maxQueue:100,
  mutedUserIds:[]
});

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeCommentSpeechSettings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    enabled:source.enabled === true,
    includeName:source.includeName === true,
    speakOperator:source.speakOperator === true,
    rate:clampNumber(source.rate,0.5,2,DEFAULT_COMMENT_SPEECH_SETTINGS.rate),
    pitch:clampNumber(source.pitch,0,2,DEFAULT_COMMENT_SPEECH_SETTINGS.pitch),
    volume:clampNumber(source.volume,0,1,DEFAULT_COMMENT_SPEECH_SETTINGS.volume),
    voiceURI:typeof source.voiceURI === "string" ? source.voiceURI.slice(0,512) : "",
    maxQueue:Math.floor(clampNumber(source.maxQueue,10,200,DEFAULT_COMMENT_SPEECH_SETTINGS.maxQueue)),
    mutedUserIds:normalizeMutedUserIds(source.mutedUserIds)
  };
}

function normalizeMutedUserIds(input) {
  if (!Array.isArray(input)) return [];
  const result = [];
  const seen = new Set();
  for (const raw of input) {
    const userId = String(raw ?? "").replace(/\s+/g, "").slice(0,128);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    result.push(userId);
    if (result.length >= 2000) break;
  }
  return result;
}

function isUserSpeechMuted(settingsInput, userIdInput) {
  const userId = String(userIdInput ?? "").replace(/\s+/g, "").slice(0,128);
  if (!userId) return false;
  return normalizeCommentSpeechSettings(settingsInput).mutedUserIds.includes(userId);
}

function setUserSpeechMuted(settingsInput, userIdInput, mutedInput) {
  const settings = normalizeCommentSpeechSettings(settingsInput);
  const userId = String(userIdInput ?? "").replace(/\s+/g, "").slice(0,128);
  if (!userId) return {ok:false,code:"INVALID_USER_ID",settings};
  const muted = typeof mutedInput === "boolean"
    ? mutedInput : !settings.mutedUserIds.includes(userId);
  const next = new Set(settings.mutedUserIds);
  if (muted) next.add(userId);
  else next.delete(userId);
  settings.mutedUserIds = [...next].slice(0,2000);
  return {ok:true,muted,userId,settings};
}

function selectSpeechVoice(voicesInput, preferredURI = "") {
  const voices = Array.isArray(voicesInput) ? voicesInput.filter(voice => voice && typeof voice === "object") : [];
  if (!voices.length) return null;
  const preferred = String(preferredURI || "");
  if (preferred) {
    const exact = voices.find(voice => voice.voiceURI === preferred);
    if (exact) return exact;
  }
  return voices.find(voice => /^ja(?:[-_]|$)/i.test(String(voice.lang || "")))
    || voices.find(voice => voice.default === true)
    || voices[0];
}

function createCommentSpeechText(comment, profile, settingsInput = {}, ngWordsInput = []) {
  const settings = normalizeCommentSpeechSettings(settingsInput);
  if (!settings.enabled) return {ok:false,code:"DISABLED"};
  if (!comment || typeof comment !== "object" || Array.isArray(comment)) return {ok:false,code:"INVALID_COMMENT"};
  if (comment.isHistory === true || comment.isBacklog === true) return {ok:false,code:"HISTORY"};
  if (isUserSpeechMuted(settings,comment.userId)) return {ok:false,code:"USER_MUTED"};
  const type = String(comment.type || "");
  if (type !== "comment" && !(type === "operatorComment" && settings.speakOperator)) {
    return {ok:false,code:"UNSUPPORTED_TYPE"};
  }
  const content = String(comment.content || comment.text || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"")
    .replace(/[\r\n]+/g," ")
    .trim();
  if (!content) return {ok:false,code:"EMPTY"};
  const lower = content.toLocaleLowerCase("ja-JP");
  const ngWords = Array.isArray(ngWordsInput) ? ngWordsInput : [];
  if (ngWords.some(word => {
    const value = String(word || "").trim().toLocaleLowerCase("ja-JP");
    return value && lower.includes(value);
  })) return {ok:false,code:"NG_WORD"};

  const safeContent = Array.from(content).slice(0,300).join("");
  const nickname = String(profile?.nickname || comment.userName || "").replace(/[\r\n]+/g," ").trim().slice(0,80);
  const text = settings.includeName && nickname ? nickname + "、" + safeContent : safeContent;
  return {ok:true,text,settings};
}

function appendSpeechQueue(queueInput, speechItem, maxQueue = 100) {
  const queue = Array.isArray(queueInput) ? queueInput.slice() : [];
  const cap = Math.floor(clampNumber(maxQueue,1,200,100));
  const text = typeof speechItem === "string" ? speechItem.trim() : "";
  if (!text) return {queue,added:false,dropped:0};
  const next = [...queue,text];
  const dropped = Math.max(0,next.length-cap);
  return {queue:next.slice(dropped),added:true,dropped};
}

const api = Object.freeze({
  DEFAULT_COMMENT_SPEECH_SETTINGS,
  normalizeCommentSpeechSettings,
  normalizeMutedUserIds,
  isUserSpeechMuted,
  setUserSpeechMuted,
  selectSpeechVoice,
  createCommentSpeechText,
  appendSpeechQueue
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.KananeoCommentSpeech = api;
