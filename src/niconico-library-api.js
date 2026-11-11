"use strict";

const API_ORIGIN = "https://nvapi.nicovideo.jp";
const PAGE_SIZE_WATCH_LATER = 100;
const PAGE_SIZE_LIST = 500;
const MAX_LIST_ID = 20;

function extractNiconicoListId(input, type) {
  const value = typeof input === "string" ? input.trim() : "";
  if (/^\d{1,20}$/.test(value)) return value;
  if (!value || value.length > 2048) return "";

  let url;
  try { url = new URL(value); } catch { return ""; }
  const allowed = new Set(["www.nicovideo.jp", "nicovideo.jp", "sp.nicovideo.jp"]);
  if (url.protocol !== "https:" || !allowed.has(url.hostname.toLowerCase()) ||
      url.username || url.password || (url.port && url.port !== "443")) return "";

  let match = null;
  if (type === "mylist") {
    match = url.pathname.match(/^\/(?:user\/\d+\/)?mylist\/(\d+)\/?$/i);
    if (!match) match = url.hash.match(/^#\/?(\d+)$/);
    if (!match) match = url.pathname.match(/^\/my\/mylist\/?$/i) && url.hash.match(/^#\/?(\d+)$/);
    return match ? match[1].slice(0, MAX_LIST_ID) : "";
  }
  if (type === "series") {
    match = url.pathname.match(/^\/series\/(\d+)\/?$/i);
    return match ? match[1].slice(0, MAX_LIST_ID) : "";
  }
  return "";
}

function buildNiconicoLibraryRequest(type, input = {}) {
  if (type === "watch-later") {
    const page = Number.isInteger(Number(input.page)) ? Math.max(1, Math.min(100, Number(input.page))) : 1;
    const url = API_ORIGIN + "/v1/users/me/watch-later?sortKey=addedAt&sortOrder=desc&pageSize=" + PAGE_SIZE_WATCH_LATER + "&page=" + page;
    return { ok:true, type, url, fallbackUrl:"", page, pageSize:PAGE_SIZE_WATCH_LATER };
  }

  if (type !== "mylist" && type !== "series") {
    return { ok:false, code:"UNSUPPORTED_LIST_TYPE", message:"取り込み元の種類を確認してください。" };
  }
  const listId = extractNiconicoListId(input.listId || input.url || "", type);
  if (!listId) {
    return { ok:false, code:"INVALID_LIST_ID", message:type === "mylist" ? "マイリストURLまたはIDを確認してください。" : "シリーズURLまたはIDを確認してください。" };
  }
  const encodedId = encodeURIComponent(listId);
  const url = type === "mylist"
    ? API_ORIGIN + "/v2/mylists/" + encodedId + "?pageSize=" + PAGE_SIZE_LIST
    : API_ORIGIN + "/v2/series/" + encodedId + "?pageSize=" + PAGE_SIZE_LIST;
  const fallbackUrl = type === "mylist"
    ? API_ORIGIN + "/v1/users/me/mylists/" + encodedId + "?pageSize=" + PAGE_SIZE_LIST
    : "";
  return { ok:true, type, listId, url, fallbackUrl, page:1, pageSize:PAGE_SIZE_LIST };
}

function findVideoId(item, video) {
  const candidates = [
    video?.id, video?.watchId, video?.contentId, video?.videoId,
    item?.watchId, item?.contentId, item?.videoId, item?.video_id, item?.id
  ];
  return candidates.find(value => typeof value === "string" && /^(?:sm|nm|so)\d{1,12}$/i.test(value))?.toLowerCase() || "";
}

function normalizeListItem(item, source) {
  if (!item || typeof item !== "object") return null;
  const video = item.video && typeof item.video === "object" ? item.video
    : item.content && typeof item.content === "object" ? item.content
    : item;
  const videoId = findVideoId(item, video);
  if (!videoId) return null;
  const title = typeof video.title === "string" ? video.title
    : typeof item.title === "string" ? item.title : videoId;
  const duration = Number(video.duration ?? item.duration);
  const tags = Array.isArray(video.tags) ? video.tags
    : Array.isArray(item.tags) ? item.tags : [];
  return {
    videoId,
    url:"https://www.nicovideo.jp/watch/" + videoId,
    title,
    duration:Number.isFinite(duration) && duration > 0 ? duration : 0,
    lengthMs:Number.isFinite(duration) && duration > 0 ? Math.min(172800000, Math.floor(duration * 1000)) : 0,
    tags,
    memo:typeof item.description === "string" ? item.description : "",
    source
  };
}

function parseNiconicoLibraryResponse(responseText, type) {
  if (!["watch-later", "mylist", "series"].includes(type)) {
    return { ok:false, code:"UNSUPPORTED_LIST_TYPE", message:"取り込み元の種類を確認してください。", entries:[] };
  }
  let parsed;
  try { parsed = JSON.parse(String(responseText || "")); }
  catch { return { ok:false, code:"INVALID_RESPONSE", message:"ニコニコの一覧応答を解析できませんでした。", entries:[] }; }

  const meta = parsed && typeof parsed.meta === "object" ? parsed.meta : null;
  if (meta && Number(meta.status) !== 200) {
    const errorCode = typeof meta.errorCode === "string" ? meta.errorCode.slice(0, 80) : "";
    return { ok:false, code:errorCode || "API_ERROR", message:"ニコニコの動画一覧APIがエラーを返しました。", entries:[] };
  }
  const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
  const list = type === "watch-later" ? (data.watchLater || data.watch_later || data)
    : type === "mylist" ? (data.mylist || data)
    : (data.series || data);
  let rawItems = Array.isArray(list?.items) ? list.items
    : Array.isArray(list?.videos) ? list.videos
    : Array.isArray(data.items) ? data.items : [];
  rawItems = rawItems.slice(0, PAGE_SIZE_LIST);
  const entries = [];
  const seen = new Set();
  for (const raw of rawItems) {
    const item = normalizeListItem(raw, type);
    if (!item || seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    entries.push(item);
  }
  return {
    ok:true,
    code:"OK",
    entries,
    listTitle:typeof list?.name === "string" ? list.name.slice(0, 200) : "",
    rawCount:rawItems.length,
    importedCount:entries.length,
    skippedCount:rawItems.length - entries.length,
    hasMore:type === "watch-later" && rawItems.length >= PAGE_SIZE_WATCH_LATER
  };
}

module.exports = {
  API_ORIGIN,
  PAGE_SIZE_WATCH_LATER,
  PAGE_SIZE_LIST,
  extractNiconicoListId,
  buildNiconicoLibraryRequest,
  parseNiconicoLibraryResponse
};
