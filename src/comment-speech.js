"use strict";

const DEFAULT_COMMENT_SPEECH_SETTINGS = Object.freeze({
  enabled:false,
  includeName:false,
  speakOperator:false,
  rate:1,
  pitch:1,
  volume:1,
  voiceURI:"",
  maxQueue:100
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
    maxQueue:Math.floor(clampNumber(source.maxQueue,10,200,DEFAULT_COMMENT_SPEECH_SETTINGS.maxQueue))
  };
}

function createCommentSpeechText(comment, profile, settingsInput = {}, ngWordsInput = []) {
  const settings = normalizeCommentSpeechSettings(settingsInput);
  if (!settings.enabled) return {ok:false,code:"DISABLED"};
  if (!comment || typeof comment !== "object" || Array.isArray(comment)) return {ok:false,code:"INVALID_COMMENT"};
  if (comment.isHistory === true || comment.isBacklog === true) return {ok:false,code:"HISTORY"};
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
  createCommentSpeechText,
  appendSpeechQueue
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.KananeoCommentSpeech = api;
