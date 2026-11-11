"use strict";

const API_ORIGIN = "https://services-eapi.spi.nicovideo.jp";
const CONTENT_ROOT = "/v1/tools/live/contents/";

function normalizeLiveId(value) {
  return typeof value === "string" && /^lv\d{1,20}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

function normalizeVideoId(value) {
  return typeof value === "string" && /^(?:sm|nm|so)\d{1,12}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

function normalizeVolume(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback;
}

function buildQuotationUrl(programId, resource = "quotation") {
  const liveId = normalizeLiveId(programId);
  if (!liveId) {
    return { ok:false, code:"INVALID_PROGRAM_ID", message:"番組IDはlvから始まるIDを指定してください。" };
  }
  if (resource !== "quotation" && resource !== "contents") {
    return { ok:false, code:"INVALID_RESOURCE", message:"引用再生APIの操作を確認できません。" };
  }
  return {
    ok:true,
    url:API_ORIGIN + CONTENT_ROOT + encodeURIComponent(liveId) + "/quotation" +
      (resource === "contents" ? "/contents" : "")
  };
}

function buildGetCurrentQuotationRequest(programId) {
  const base = buildQuotationUrl(programId);
  return base.ok ? { ok:true, method:"GET", url:base.url } : base;
}

function buildPlayQuotationRequest(input = {}) {
  const videoId = normalizeVideoId(input.videoId);
  if (!videoId) {
    return { ok:false, code:"INVALID_VIDEO_ID", message:"引用再生できるニコニコ動画IDを指定してください。" };
  }

  const active = input.hasActiveQuotation === true;
  const endpoint = buildQuotationUrl(input.programId, active ? "contents" : "quotation");
  if (!endpoint.ok) return endpoint;

  const body = {
    contents:[{ id:videoId, type:"video" }]
  };

  if (!active) {
    body.layout = {
      main:{
        source:"quote",
        volume:normalizeVolume(input.mainVolume,1)
      },
      sub:{
        isSoundOnly:true,
        source:"self",
        volume:normalizeVolume(input.subVolume,0)
      }
    };
    body.repeat = false;
    body.enableAddViewCount = true;
  }

  return {
    ok:true,
    method:active ? "PATCH" : "POST",
    url:endpoint.url,
    body
  };
}

function buildStopQuotationRequest(programId) {
  const endpoint = buildQuotationUrl(programId);
  return endpoint.ok
    ? { ok:true, method:"DELETE", url:endpoint.url, body:{} }
    : endpoint;
}

function parseCurrentQuotationResponse(status, responseText) {
  if (status === 404) {
    return { ok:true, exists:false, currentVideoId:"" };
  }
  if (status === 401) {
    return { ok:false, code:"AUTH_REQUIRED", message:"ニコニコへのログイン期限が切れています。" };
  }
  if (status === 403) {
    return { ok:false, code:"BROADCASTER_PERMISSION_REQUIRED", message:"引用再生には放送主権限が必要です。" };
  }
  if (status !== 200) {
    return {
      ok:false,
      code:"QUOTATION_HTTP_ERROR",
      message:"現在の引用再生状態を取得できませんでした（HTTP " + Number(status || 0) + "）。"
    };
  }
  if (typeof responseText !== "string" || responseText.length === 0 || responseText.length > 256 * 1024) {
    return { ok:false, code:"QUOTATION_RESPONSE_INVALID", message:"引用再生の応答を読み取れませんでした。" };
  }

  let payload;
  try { payload = JSON.parse(responseText); }
  catch { return { ok:false, code:"QUOTATION_RESPONSE_INVALID", message:"引用再生の応答を解析できませんでした。" }; }

  const current = payload?.currentContent;
  return {
    ok:true,
    exists:!!current,
    currentVideoId:typeof current?.id === "string" ? normalizeVideoId(current.id) : "",
    currentContentType:typeof current?.type === "string" ? current.type.slice(0,40) : ""
  };
}

function parseQuotationMutationResponse(status, responseText) {
  if (status >= 200 && status < 300) {
    return { ok:true, status };
  }
  if (status === 401) {
    return { ok:false, code:"AUTH_REQUIRED", message:"ニコニコへのログイン期限が切れています。" };
  }
  if (status === 403) {
    return { ok:false, code:"BROADCASTER_PERMISSION_REQUIRED", message:"引用再生は放送主権限のあるアカウントで実行してください。" };
  }

  let message = "";
  if (typeof responseText === "string" && responseText.length <= 256 * 1024) {
    try {
      const payload = JSON.parse(responseText);
      message = typeof payload?.meta?.errorMessage === "string"
        ? payload.meta.errorMessage.slice(0,200)
        : "";
    } catch {}
  }
  return {
    ok:false,
    code:status === 400 ? "VIDEO_NOT_QUOTABLE" : "QUOTATION_MUTATION_FAILED",
    message:message || (status === 400
      ? "この動画は引用再生できない可能性があります。"
      : "引用再生の操作に失敗しました（HTTP " + Number(status || 0) + "）。")
  };
}

module.exports = {
  API_ORIGIN,
  normalizeLiveId,
  normalizeVideoId,
  buildQuotationUrl,
  buildGetCurrentQuotationRequest,
  buildPlayQuotationRequest,
  buildStopQuotationRequest,
  parseCurrentQuotationResponse,
  parseQuotationMutationResponse
};
