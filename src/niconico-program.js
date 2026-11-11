"use strict";

const TRUSTED_WATCH_HOSTS = new Set(["live.nicovideo.jp", "live2.nicovideo.jp"]);

class NiconicoPageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NiconicoPageError";
    this.code = code;
  }
}

function normalizeProgramId(input) {
  if (typeof input !== "string") {
    throw new NiconicoPageError("INVALID_PROGRAM_ID", "放送IDまたはニコ生の放送URLを入力してください。");
  }
  const value = input.trim();
  if (/^lv\d+$/i.test(value)) return value.toLowerCase();

  let parsed;
  try { parsed = new URL(value); }
  catch {
    throw new NiconicoPageError("INVALID_PROGRAM_ID", "放送IDの形式を確認してください。例：lv123456789");
  }
  if (parsed.protocol !== "https:" || !TRUSTED_WATCH_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new NiconicoPageError("UNTRUSTED_URL", "ニコニコ生放送の公式URLを入力してください。");
  }
  const match = parsed.pathname.match(/^\/watch\/(lv\d+)\/?$/i);
  if (!match) throw new NiconicoPageError("INVALID_PROGRAM_ID", "URLから放送IDを読み取れませんでした。");
  return match[1].toLowerCase();
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractEmbeddedData(html) {
  if (typeof html !== "string" || html.length === 0) {
    throw new NiconicoPageError("EMPTY_RESPONSE", "ニコ生の番組ページが空でした。");
  }
  const scriptTag = html.match(/<script\b[^>]*\bid\s*=\s*(["'])embedded-data\1[^>]*>/i);
  if (!scriptTag) {
    throw new NiconicoPageError("EMBEDDED_DATA_MISSING", "番組情報を読み取れませんでした。ページ仕様が変更された可能性があります。");
  }
  const props = scriptTag[0].match(/\bdata-props\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!props) throw new NiconicoPageError("EMBEDDED_DATA_MISSING", "番組ページに data-props がありません。");
  try {
    const parsed = JSON.parse(decodeHtmlAttribute(props[2]));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new NiconicoPageError("EMBEDDED_DATA_INVALID", "番組情報のJSONを解析できませんでした。");
  }
}

function extractBroadcasterCommentToken(html) {
  const embedded = extractEmbeddedData(html);
  const props = embedded.props && typeof embedded.props === "object" ? embedded.props : embedded;
  const token = props.site?.relive?.csrfToken;
  return typeof token === "string" && token.length > 0 && token.length <= 4096 && !/[\\r\\n]/.test(token)
    ? token
    : "";
}

function isTrustedWebSocketEndpoint(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "wss:" &&
      (url.hostname === "nicovideo.jp" || url.hostname.endsWith(".nicovideo.jp"));
  } catch {
    return false;
  }
}

function inspectWatchPage(html, programId) {
  const embedded = extractEmbeddedData(html);
  const props = embedded.props && typeof embedded.props === "object" ? embedded.props : embedded;
  const program = props.program && typeof props.program === "object" ? props.program : {};
  const title = program.title || program.program?.title || props.site?.program?.title || null;
  const webSocketUrl = props.site?.relive?.webSocketUrl;
  const endTime = Number(program.endTime);
  return {
    programId: normalizeProgramId(programId),
    title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : null,
    programStatus:typeof program.status === "string" ? program.status.slice(0,40) : null,
    endTime:Number.isFinite(endTime) && endTime > 0 ? endTime : null,
    watchingApiAvailable: isTrustedWebSocketEndpoint(webSocketUrl),
    pageDataFound: true
  };
}

module.exports = {
  NiconicoPageError,
  normalizeProgramId,
  extractEmbeddedData,
  extractBroadcasterCommentToken,
  inspectWatchPage,
  isTrustedWebSocketEndpoint
};
