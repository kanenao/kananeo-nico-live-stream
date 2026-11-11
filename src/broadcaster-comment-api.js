"use strict";

const { URLSearchParams } = require("node:url");

const COMMENT_API_BASE = "https://live2.nicovideo.jp/unama/api/v3/programs/";
const MAX_COMMENT_LENGTH = 80;

function buildBroadcasterCommentRequest(input = {}) {
  const programId = typeof input.programId === "string" ? input.programId.trim().toLowerCase() : "";
  const csrfToken = typeof input.csrfToken === "string" ? input.csrfToken.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim().replace(/\r\n?/g, "\n") : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const command = typeof input.command === "string" ? input.command.trim() : "";

  if (!/^lv\d{1,12}$/.test(programId)) {
    return { ok:false, code:"INVALID_PROGRAM_ID", message:"放送IDを確認してください。" };
  }
  if (!csrfToken || csrfToken.length > 4096 || /[\r\n]/.test(csrfToken)) {
    return { ok:false, code:"CSRF_TOKEN_MISSING", message:"番組ページから送信用トークンを取得できませんでした。" };
  }
  if (!text || text.length > MAX_COMMENT_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    return { ok:false, code:"INVALID_COMMENT", message:"運営コメントは1〜80文字で入力してください。" };
  }
  if (name.length > 64 || command.length > 64 || /[\r\n]/.test(name + command)) {
    return { ok:false, code:"INVALID_OPTIONS", message:"コメントの名前またはコマンドが長すぎます。" };
  }

  const body = new URLSearchParams({
    text,
    name,
    isPermanent:input.isPermanent === true ? "true" : "false",
    command
  }).toString();

  return {
    ok:true,
    url:COMMENT_API_BASE + programId + "/broadcaster_comment",
    method:"PUT",
    headers:{
      Accept:"application/json",
      "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
      "X-Public-Api-Token":csrfToken
    },
    body
  };
}

function parseBroadcasterCommentResponse(responseText, httpStatus = 200) {
  if (httpStatus === 401 || httpStatus === 403) {
    return { ok:false, code:"BROADCASTER_PERMISSION_REQUIRED", message:"運営コメントを送信できません。配信主アカウントでログインしているか確認してください。" };
  }
  if (httpStatus === 429) {
    return { ok:false, code:"BROADCASTER_RATE_LIMITED", message:"コメントの投稿間隔が短すぎます。少し時間を空けてください。" };
  }
  if (httpStatus < 200 || httpStatus >= 300) {
    return { ok:false, code:"BROADCASTER_HTTP_ERROR", message:"運営コメントAPIがエラーを返しました（HTTP " + httpStatus + "）。" };
  }

  let parsed = null;
  if (typeof responseText === "string" && responseText.trim()) {
    try { parsed = JSON.parse(responseText); }
    catch { return { ok:false, code:"BROADCASTER_RESPONSE_INVALID", message:"運営コメントAPIの応答を解析できませんでした。" }; }
  }
  const meta = parsed && typeof parsed.meta === "object" ? parsed.meta : null;
  if (meta && Number(meta.status) !== 200) {
    const errorCode = typeof meta.errorCode === "string" ? meta.errorCode.slice(0, 80) : "";
    if (errorCode === "AUTHENTICATION_FAILED" || errorCode === "FORBIDDEN") {
      return { ok:false, code:"BROADCASTER_PERMISSION_REQUIRED", message:"運営コメントの送信権限がありません。配信主アカウントでログインしてください。" };
    }
    if (errorCode === "RATE_LIMITED" || errorCode === "TOO_MANY_REQUESTS") {
      return { ok:false, code:"BROADCASTER_RATE_LIMITED", message:"コメントの投稿間隔が短すぎます。少し時間を空けてください。" };
    }
    return { ok:false, code:"BROADCASTER_API_ERROR", message:"運営コメントAPIが送信を受け付けませんでした。" };
  }
  return { ok:true, code:"SENT", message:"運営コメントを送信しました。" };
}

module.exports = { buildBroadcasterCommentRequest, parseBroadcasterCommentResponse, MAX_COMMENT_LENGTH };
