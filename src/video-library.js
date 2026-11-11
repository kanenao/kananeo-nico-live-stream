"use strict";

const { normalizeNiconicoVideoUrl } = require("./video-queue");

const VIDEO_LIBRARY_VERSION = 1;
const MAX_LIBRARY_ENTRIES = 20000;
const MAX_HISTORY_ENTRIES = 10000;
const MAX_IMPORT_TEXT_LENGTH = 16 * 1024 * 1024;

function safeText(value, maxLength = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function safeDate(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeDurationMs(input) {
  const direct = Number(input?.lengthMs ?? input?.durationMs);
  if (Number.isFinite(direct) && direct > 0) return Math.min(Math.floor(direct), 172800000);
  const seconds = Number(input?.duration);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.floor(seconds * 1000), 172800000);
  return 0;
}

function normalizeVideoEntry(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const candidate = safeText(input.videoId || input.watchId || input.video_id || input.url || input.id, 2048);
  const validation = normalizeNiconicoVideoUrl(candidate);
  if (!validation.ok) return null;

  const now = safeDate(options.now || new Date().toISOString());
  const tagsInput = Array.isArray(input.tags) ? input.tags : typeof input.tags === "string" ? input.tags.split(/[;,]/) : [];
  const tags = [...new Set(tagsInput.map(value => safeText(value, 40)).filter(Boolean))].slice(0, 30);

  return {
    videoId: validation.videoId,
    url: validation.url,
    title: safeText(input.title, 200) || validation.videoId,
    lengthMs: normalizeDurationMs(input),
    tags,
    memo: safeText(input.memo || input.description || "", 1000),
    source: safeText(input.source || "manual", 80) || "manual",
    createdAt: safeDate(input.createdAt || input.addedAt, now),
    updatedAt: safeDate(input.updatedAt, now),
    playCount: Math.max(0, Math.min(100000000, Math.floor(Number(input.playCount) || 0))),
    lastPlayedAt: input.lastPlayedAt ? safeDate(input.lastPlayedAt, "") : ""
  };
}

function normalizeHistoryEntry(input = {}, options = {}) {
  const entry = normalizeVideoEntry(input, options);
  if (!entry) return null;
  const playedAt = safeDate(input.playedAt || input.timestamp || input.lastPlayedAt, safeDate(options.now || new Date().toISOString()));
  return {
    id: safeText(input.id, 128) || entry.videoId + "-" + Date.parse(playedAt),
    videoId: entry.videoId,
    url: entry.url,
    title: entry.title,
    playedAt,
    queueType: ["request", "stock", "library"].includes(input.queueType) ? input.queueType : "library",
    playbackType: ["preview", "quotation"].includes(input.playbackType) ? input.playbackType : "preview"
  };
}

function createEmptyVideoLibrary() {
  return { version: VIDEO_LIBRARY_VERSION, items: [], history: [], updatedAt: new Date().toISOString() };
}

function normalizeVideoLibrary(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const now = new Date().toISOString();
  const items = [];
  const seen = new Set();
  for (const raw of Array.isArray(source.items) ? source.items : []) {
    const entry = normalizeVideoEntry(raw, { now });
    if (!entry || seen.has(entry.videoId)) continue;
    seen.add(entry.videoId);
    items.push(entry);
    if (items.length >= MAX_LIBRARY_ENTRIES) break;
  }

  const history = [];
  for (const raw of Array.isArray(source.history) ? source.history : []) {
    const item = normalizeHistoryEntry(raw, { now });
    if (item) history.push(item);
  }
  history.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));

  return {
    version: VIDEO_LIBRARY_VERSION,
    items,
    history: history.slice(0, MAX_HISTORY_ENTRIES),
    updatedAt: safeDate(source.updatedAt, now)
  };
}

function mergeVideoEntries(libraryInput, incomingInput, options = {}) {
  const library = normalizeVideoLibrary(libraryInput);
  const incoming = Array.isArray(incomingInput) ? incomingInput : [];
  const map = new Map(library.items.map(item => [item.videoId, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incoming) {
    const entry = normalizeVideoEntry(raw, options);
    if (!entry) { skipped += 1; continue; }
    const previous = map.get(entry.videoId);
    if (!previous) {
      if (map.size >= MAX_LIBRARY_ENTRIES) { skipped += 1; continue; }
      map.set(entry.videoId, entry);
      added += 1;
      continue;
    }

    const merged = {
      ...previous,
      title: previous.title === previous.videoId && entry.title !== entry.videoId ? entry.title : previous.title,
      lengthMs: previous.lengthMs || entry.lengthMs,
      tags: [...new Set([...previous.tags, ...entry.tags])].slice(0, 30),
      memo: previous.memo || entry.memo,
      source: previous.source || entry.source,
      updatedAt: safeDate(options.now || new Date().toISOString())
    };
    if (JSON.stringify(merged) !== JSON.stringify(previous)) updated += 1;
    map.set(entry.videoId, merged);
  }

  const next = {
    ...library,
    items: [...map.values()],
    updatedAt: safeDate(options.now || new Date().toISOString())
  };
  return { library: next, added, updated, skipped, total: next.items.length };
}

function addPlaybackHistory(libraryInput, playbackInput, options = {}) {
  const library = normalizeVideoLibrary(libraryInput);
  const entry = normalizeVideoEntry(playbackInput, options);
  if (!entry) return { ok: false, code: "INVALID_VIDEO", library };
  const historyEntry = normalizeHistoryEntry(playbackInput, options);
  const history = [historyEntry, ...library.history].slice(0, MAX_HISTORY_ENTRIES);
  const items = library.items.map(item => {
    if (item.videoId !== entry.videoId) return item;
    return {
      ...item,
      playCount: Math.min(100000000, item.playCount + 1),
      lastPlayedAt: historyEntry.playedAt,
      updatedAt: historyEntry.playedAt
    };
  });
  return {
    ok: true,
    library: { ...library, items, history, updatedAt: historyEntry.playedAt },
    historyEntry
  };
}

function mergeVideoHistory(libraryInput, historyInput, options = {}) {
  const library = normalizeVideoLibrary(libraryInput);
  const incoming = Array.isArray(historyInput) ? historyInput : [];
  const seen = new Set(library.history.map(item => item.id));
  const added = [];
  for (const raw of incoming) {
    const item = normalizeHistoryEntry(raw, options);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    added.push(item);
    if (added.length >= MAX_HISTORY_ENTRIES) break;
  }
  const history = [...library.history, ...added]
    .sort((a,b) => Date.parse(b.playedAt) - Date.parse(a.playedAt))
    .slice(0,MAX_HISTORY_ENTRIES);
  return {
    library:{...library,history,updatedAt:safeDate(options.now || new Date().toISOString())},
    addedHistory:added.length
  };
}

function updateVideoEntry(libraryInput, videoIdInput, changes = {}, options = {}) {
  const library = normalizeVideoLibrary(libraryInput);
  const validation = normalizeNiconicoVideoUrl(String(videoIdInput || ""));
  if (!validation.ok) return { ok:false, code:"INVALID_VIDEO_ID", library };
  const index = library.items.findIndex(item => item.videoId === validation.videoId);
  if (index < 0) return { ok:false, code:"VIDEO_NOT_FOUND", library };

  const previous = library.items[index];
  const tagsInput = Array.isArray(changes.tags)
    ? changes.tags
    : typeof changes.tags === "string" ? changes.tags.split(/[;,]/) : previous.tags;
  const tags = [...new Set(tagsInput.map(value => safeText(value, 40)).filter(Boolean))].slice(0, 30);
  const item = {
    ...previous,
    title: safeText(changes.title, 200) || validation.videoId,
    tags,
    memo: safeText(changes.memo, 1000),
    updatedAt: safeDate(options.now || new Date().toISOString())
  };
  const items = library.items.slice();
  items[index] = item;
  return {
    ok:true,
    item,
    library:{ ...library, items, updatedAt:item.updatedAt }
  };
}

function removeVideoEntry(libraryInput, videoIdInput) {
  const library = normalizeVideoLibrary(libraryInput);
  const validation = normalizeNiconicoVideoUrl(String(videoIdInput || ""));
  if (!validation.ok) return { ok: false, code: "INVALID_VIDEO_ID", library };
  const items = library.items.filter(item => item.videoId !== validation.videoId);
  return { ok: true, library: { ...library, items, updatedAt: new Date().toISOString() }, removed: items.length !== library.items.length };
}

function clearVideoHistory(libraryInput) {
  const library = normalizeVideoLibrary(libraryInput);
  return { ...library, history: [], updatedAt: new Date().toISOString() };
}

function filterVideoEntries(itemsInput, options = {}) {
  const items = Array.isArray(itemsInput) ? itemsInput : [];
  const query = safeText(options.query, 200).toLocaleLowerCase("ja-JP");
  const source = safeText(options.source, 80);
  const sort = options.sort === "oldest" ? "oldest" : options.sort === "played" ? "played" : "newest";
  let result = items.filter(item => {
    if (source && item.source !== source) return false;
    if (!query) return true;
    const haystack = [item.videoId, item.title, item.memo, ...(Array.isArray(item.tags) ? item.tags : [])].join(" ").toLocaleLowerCase("ja-JP");
    return haystack.includes(query);
  });
  result.sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (sort === "played") return (b.playCount - a.playCount) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
  return result;
}

function parseVideoImportText(textInput, options = {}) {
  if (typeof textInput !== "string" || textInput.length === 0 || textInput.length > MAX_IMPORT_TEXT_LENGTH) {
    return { ok: false, code: "INVALID_IMPORT_TEXT", entries: [], skipped: 0, message: "取り込みテキストが空か、サイズ上限を超えています。" };
  }

  const text = textInput.replace(/^\uFEFF/, "").trim();
  if (!text) return { ok: false, code: "EMPTY_IMPORT", entries: [], skipped: 0, message: "取り込む動画がありません。" };

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed.videos) ? parsed.videos : null;
      if (!records) return { ok: false, code: "INVALID_LIBRARY_JSON", entries: [], skipped: 0, message: "動画ライブラリJSONの形式を確認してください。" };
      const entries = [];
      let skipped = 0;
      for (const record of records) {
        const entry = normalizeVideoEntry(record, options);
        if (entry) entries.push(entry); else skipped += 1;
      }
      const rawHistory = !Array.isArray(parsed) && Array.isArray(parsed.history) ? parsed.history : [];
      const history = rawHistory.map(item => normalizeHistoryEntry(item, options)).filter(Boolean).slice(0,MAX_HISTORY_ENTRIES);
      return { ok: true, entries, history, skipped, message: "JSONから動画と再生履歴を読み取りました。" };
    } catch {
      return { ok: false, code: "INVALID_LIBRARY_JSON", entries: [], skipped: 0, message: "JSONを解析できませんでした。" };
    }
  }

  const entries = [];
  const seen = new Set();
  let skipped = 0;
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const urlMatch = line.match(/https?:\/\/[^\s,;]+/i);
    const idMatch = line.match(/(?:^|[^a-z0-9])((?:sm|nm|so)\d{1,12})(?:$|[^0-9])/i);
    const candidate = urlMatch?.[0] || idMatch?.[1] || "";
    if (!candidate) { skipped += 1; continue; }
    const entry = normalizeVideoEntry({ videoId: candidate, title: line.replace(candidate, "").replace(/^[\s,;\t]+|[\s,;\t]+$/g, "") || undefined, source: options.source || "text-import" }, options);
    if (!entry || seen.has(entry.videoId)) { skipped += 1; continue; }
    seen.add(entry.videoId);
    entries.push(entry);
  }
  return { ok: entries.length > 0, code: entries.length ? "OK" : "NO_VALID_VIDEOS", entries, skipped, message: entries.length ? "動画IDを読み取りました。" : "有効なニコニコ動画IDが見つかりませんでした。" };
}

module.exports = {
  VIDEO_LIBRARY_VERSION,
  MAX_LIBRARY_ENTRIES,
  MAX_HISTORY_ENTRIES,
  createEmptyVideoLibrary,
  normalizeVideoEntry,
  normalizeVideoLibrary,
  mergeVideoEntries,
  addPlaybackHistory,
  mergeVideoHistory,
  normalizeHistoryEntry,
  removeVideoEntry,
  updateVideoEntry,
  clearVideoHistory,
  filterVideoEntries,
  parseVideoImportText
};
