"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildStatisticsRequest, parseStatisticsResponse } = require("../src/program-api");

test("builds a read-only statistics request for a valid program ID", () => {
  assert.deepEqual(buildStatisticsRequest("lv123"),{
    ok:true,
    url:"https://live2.nicovideo.jp/watch/lv123/statistics",
    method:"GET"
  });
});

test("rejects unsafe program IDs", () => {
  assert.equal(buildStatisticsRequest("https://example.com/lv123").ok,false);
  assert.equal(buildStatisticsRequest("../lv123").ok,false);
});

test("parses bounded viewer and comment counters", () => {
  assert.deepEqual(parseStatisticsResponse(JSON.stringify({data:{watchCount:123,commentCount:45}})),{
    ok:true,watchCount:123,commentCount:45
  });
  assert.equal(parseStatisticsResponse(JSON.stringify({data:{watchCount:-1,commentCount:1}})).ok,false);
  assert.equal(parseStatisticsResponse("not json").ok,false);
});
