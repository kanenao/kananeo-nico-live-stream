"use strict";

const API_BASE = "https://live2.nicovideo.jp/watch/";

function buildStatisticsRequest(programId) {
  if (typeof programId !== "string" || !/^lv\d{1,20}$/i.test(programId)) {
    return {ok:false,code:"INVALID_PROGRAM_ID",message:"番組IDはlvから始まるIDを指定してください。"};
  }
  return {
    ok:true,
    url:API_BASE + encodeURIComponent(programId.toLowerCase()) + "/statistics",
    method:"GET"
  };
}

function parseStatisticsResponse(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 * 1024) {
    return {ok:false,code:"STATISTICS_RESPONSE_INVALID",message:"番組統計を読み取れませんでした。"};
  }
  let payload;
  try { payload = JSON.parse(value); }
  catch { return {ok:false,code:"STATISTICS_RESPONSE_INVALID",message:"番組統計を読み取れませんでした。"}; }

  const data = payload && payload.data;
  const watchCount = Number(data?.watchCount);
  const commentCount = Number(data?.commentCount);
  if (!data || !Number.isSafeInteger(watchCount) || !Number.isSafeInteger(commentCount) ||
      watchCount < 0 || commentCount < 0 || watchCount > 1000000000 || commentCount > 1000000000) {
    return {ok:false,code:"STATISTICS_DATA_INVALID",message:"番組統計の値が想定と異なります。"};
  }
  return {ok:true,watchCount,commentCount};
}

module.exports = { buildStatisticsRequest, parseStatisticsResponse };
