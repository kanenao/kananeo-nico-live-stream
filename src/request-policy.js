"use strict";

const ACTIVE_STATUSES = new Set(["queued", "playing", "pending", "reserved"]);

function evaluateCommentRequest(input = {}) {
  const comment = input.comment && typeof input.comment === "object" ? input.comment : {};
  const userId = typeof comment.userId === "string" ? comment.userId.slice(0, 256) : "";
  const content = typeof comment.content === "string" ? comment.content.slice(0, 4000) : "";
  const videoId = typeof input.videoId === "string" ? input.videoId.toLowerCase().slice(0, 32) : "";
  const requests = Array.isArray(input.requests) ? input.requests.slice(0, 1000) : [];
  const stocks = Array.isArray(input.stocks) ? input.stocks.slice(0, 1000) : [];
  const ngUsers = Array.isArray(input.ngUsers) ? input.ngUsers.slice(0, 1000) : [];
  const ngWords = Array.isArray(input.ngWords) ? input.ngWords.slice(0, 500) : [];
  const pending = Array.isArray(input.pendingVideoIds) ? input.pendingVideoIds.slice(0, 500) : [];
  const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
  const active = item => item && ACTIVE_STATUSES.has(String(item.status || "queued"));

  const reject = (code, message) => ({ accepted:false, code, message });
  if (!content || !videoId || !/^(?:sm|nm|so)\d{1,12}$/.test(videoId)) {
    return reject("INVALID_VIDEO", "動画IDまたはコメント内容を確認できません。");
  }
  if (ngUsers.some(value => String(value) === userId && userId)) {
    return reject("NG_USER", "NGユーザーからのリクエストです。");
  }
  const normalizedContent = content.toLocaleLowerCase("ja-JP");
  if (ngWords.some(value => {
    const word = String(value || "").trim().toLocaleLowerCase("ja-JP");
    return word && normalizedContent.includes(word);
  })) {
    return reject("NG_WORD", "NGワードを含むリクエストです。");
  }
  if (pending.some(value => String(value).toLowerCase() === videoId)) {
    return reject("DUPLICATE_PENDING", "同じ動画の受付処理が進行中です。");
  }
  if ([...requests, ...stocks].some(item => String(item?.videoId || "").toLowerCase() === videoId)) {
    return reject("DUPLICATE", "同じ動画は既にキューまたはストックにあります。");
  }
  const activeRequests = requests.filter(active);
  const queueLimit = 200;
  if (activeRequests.length >= queueLimit) {
    return reject("QUEUE_FULL", "リクエストキューが上限200件に達しています。");
  }
  const maxPerUser = Math.min(50, Math.max(1, Number(settings.maxPerUser) || 5));
  if (userId && activeRequests.filter(item =>
    item.source === "comment" && String(item.requestUserId || "") === userId
  ).length >= maxPerUser) {
    return reject("USER_LIMIT", "このユーザーの未再生リクエスト上限に達しています。");
  }
  return { accepted:true, code:"ACCEPTED", message:"リクエストを受け付けられます。" };
}

module.exports = { evaluateCommentRequest };
