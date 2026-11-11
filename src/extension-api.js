"use strict";

const API_BASE = "https://live2.nicovideo.jp/watch/";

function buildExtensionOptionsRequest(programId) {
  if (typeof programId !== "string" || !/^lv\d{1,20}$/i.test(programId)) {
    return {ok:false,code:"INVALID_PROGRAM_ID",message:"番組IDはlvから始まるIDを指定してください。"};
  }
  return {
    ok:true,
    url:API_BASE + encodeURIComponent(programId.toLowerCase()) + "/extension",
    method:"GET"
  };
}

function parseExtensionOptionsResponse(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 * 1024) {
    return {ok:false,code:"EXTENSION_RESPONSE_INVALID",message:"延長方法を読み取れませんでした。"};
  }
  let payload;
  try { payload = JSON.parse(value); }
  catch { return {ok:false,code:"EXTENSION_RESPONSE_INVALID",message:"延長方法を読み取れませんでした。"}; }

  const methods = payload?.data?.methods;
  if (!Array.isArray(methods) || methods.length > 20) {
    return {ok:false,code:"EXTENSION_METHODS_MISSING",message:"現在の放送で利用できる延長方法を確認できませんでした。"};
  }
  const normalized = methods.map(method => ({
    type:typeof method?.type === "string" ? method.type.trim().slice(0,40) : "",
    minutes:Number(method?.minutes)
  }));
  if (normalized.some(method => !method.type || !Number.isInteger(method.minutes) || method.minutes <= 0 || method.minutes > 360)) {
    return {ok:false,code:"EXTENSION_METHODS_INVALID",message:"延長方法の内容が想定と異なります。"};
  }
  return {ok:true,methods:normalized};
}

module.exports = { buildExtensionOptionsRequest, parseExtensionOptionsResponse };
