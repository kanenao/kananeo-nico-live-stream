"use strict";

const { normalizeEnqueteDefinition } = require("./poll-engine");
const API_BASE = "https://live2.nicovideo.jp/unama/watch/";

function buildEnqueteRequest(action, programId, input = {}) {
  if (typeof programId !== "string" || !/^lv\d{1,20}$/i.test(programId)) {
    return { ok:false, code:"INVALID_PROGRAM_ID", message:"番組IDはlvから始まるIDを指定してください。" };
  }

  const base = API_BASE + encodeURIComponent(programId.toLowerCase()) + "/enquete";
  if (action === "start") {
    const definition = normalizeEnqueteDefinition(input);
    if (!definition.ok) return definition;
    return {
      ok:true,
      url:base,
      method:"POST",
      body:JSON.stringify({question:definition.question,items:definition.choices})
    };
  }
  if (action === "result") {
    return {ok:true,url:base + "/result",method:"POST"};
  }
  if (action === "finish") {
    return {ok:true,url:base,method:"DELETE"};
  }
  return {ok:false,code:"INVALID_ACTION",message:"アンケート操作を確認できません。"};
}

function mapEnqueteHttpError(status) {
  const errors = {
    401:{code:"AUTH_REQUIRED",message:"ログインの有効期限が切れました。公式ログインを確認してください。"},
    403:{code:"BROADCASTER_PERMISSION_REQUIRED",message:"アンケート操作が拒否されました。放送主アカウントでログインしているか確認してください。"},
    404:{code:"PROGRAM_NOT_FOUND",message:"放送ページが見つかりません。放送IDと放送状態を確認してください。"},
    409:{code:"ENQUETE_CONFLICT",message:"現在のアンケート状態と操作が一致しません。画面を更新して確認してください。"}
  };
  return errors[status] || {
    code:"ENQUETE_HTTP_ERROR",
    message:"アンケートAPIがエラーを返しました（HTTP " + Number(status || 0) + "）。"
  };
}

function parseEnqueteResultResponse(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 256 * 1024) {
    return {ok:false,code:"ENQUETE_RESPONSE_INVALID",message:"アンケート結果を読み取れませんでした。"};
  }
  let payload;
  try { payload = JSON.parse(value); }
  catch { return {ok:false,code:"ENQUETE_RESPONSE_INVALID",message:"アンケート結果を読み取れませんでした。"}; }

  const data = payload && payload.data;
  if (!data || !Array.isArray(data.items) || data.items.length < 2 || data.items.length > 10) {
    return {ok:false,code:"ENQUETE_RESULT_MISSING",message:"アンケート結果がまだ取得できません。投票が終了しているか確認してください。"};
  }
  const items = data.items.map(item => ({
    name:typeof item?.name === "string" ? item.name.slice(0,50) : "",
    rate:Number(item?.rate)
  }));
  if (items.some(item => !item.name || !Number.isFinite(item.rate) || item.rate < 0 || item.rate > 100)) {
    return {ok:false,code:"ENQUETE_RESULT_INVALID",message:"アンケート結果の内容が想定と異なります。自動進行を停止しました。"};
  }
  return {
    ok:true,
    title:typeof data.title === "string" ? data.title.slice(0,100) : "",
    items
  };
}

module.exports = { buildEnqueteRequest, mapEnqueteHttpError, parseEnqueteResultResponse };
