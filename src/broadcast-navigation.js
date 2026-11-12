"use strict";

const { normalizeProgramId } = require("./niconico-program");

const CREATE_URL = "https://live.nicovideo.jp/create";

function buildBroadcastNavigationUrl(mode, input = "") {
  if (mode === "create") {
    return { ok:true, mode:"create", url:CREATE_URL };
  }
  if (mode !== "manage") {
    return { ok:false, code:"INVALID_MODE", message:"操作モードを確認してください。" };
  }
  let programId;
  try { programId = normalizeProgramId(input); }
  catch {
    return { ok:false, code:"INVALID_PROGRAM_ID", message:"放送ID（lvから始まる番号）を確認してください。" };
  }
  return {
    ok:true,
    mode:"manage",
    programId,
    url:"https://live.nicovideo.jp/watch/" + encodeURIComponent(programId)
  };
}

module.exports = { buildBroadcastNavigationUrl };
