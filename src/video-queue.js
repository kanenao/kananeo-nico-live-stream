"use strict";

const VIDEO_ID_PATTERN = /^(?:sm|nm|so)\d{1,12}$/i;
const ALLOWED_HOSTS = new Set([
  "www.nicovideo.jp",
  "nicovideo.jp",
  "sp.nicovideo.jp",
  "nico.ms"
]);

function normalizeNiconicoVideoUrl(input) {
  if (typeof input !== "string" || input.trim().length === 0 || input.length > 2048) {
    return { ok:false, code:"INVALID_VIDEO_URL", message:"ニコニコ動画のURLまたは動画IDを入力してください。" };
  }

  const value = input.trim();
  let videoId = "";

  if (VIDEO_ID_PATTERN.test(value)) {
    videoId = value.toLowerCase();
  } else {
    let url;
    try {
      url = new URL(value);
    } catch {
      return { ok:false, code:"INVALID_VIDEO_URL", message:"URLの形式を確認してください。動画ID（sm12345678等）でも登録できます。" };
    }

    if (url.protocol !== "https:" || url.username || url.password || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      return { ok:false, code:"UNSUPPORTED_VIDEO_HOST", message:"現在はHTTPSのニコニコ動画 watch URLのみ対応しています。" };
    }

    const match = url.pathname.match(/^\/(?:watch\/)?((?:sm|nm|so)\d{1,12})\/?$/i);
    if (!match) {
      return { ok:false, code:"UNSUPPORTED_VIDEO_URL", message:"動画ページのURLを指定してください。チャンネル・マイリスト・検索URLには未対応です。" };
    }
    videoId = match[1].toLowerCase();
  }

  return {
    ok:true,
    videoId,
    url:"https://www.nicovideo.jp/watch/" + videoId,
    message:"ニコニコ動画のURLを確認しました。"
  };
}

function findNextQueueItem(items, currentId) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const currentIndex = items.findIndex(item => item && item.id === currentId);
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  for (let index = start; index < items.length; index += 1) {
    const item = items[index];
    if (item && item.status !== "completed" && item.status !== "skipped") return item;
  }
  return null;
}

module.exports = { normalizeNiconicoVideoUrl, findNextQueueItem };
