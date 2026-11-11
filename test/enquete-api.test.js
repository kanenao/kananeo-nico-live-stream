"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEnqueteRequest,
  mapEnqueteHttpError,
  parseEnqueteResultResponse
} = require("../src/enquete-api");

test("builds the documented start, result, and finish requests", () => {
  const base = "https://live2.nicovideo.jp/unama/watch/lv123/enquete";
  const start = buildEnqueteRequest("start","lv123",{
    question:"続けますか？",
    choices:["もう一度","次の動画へ"],
    waitSeconds:15,
    resultSeconds:10
  });
  assert.equal(start.ok,true);
  assert.equal(start.url,base);
  assert.equal(start.method,"POST");
  assert.deepEqual(JSON.parse(start.body),{question:"続けますか？",items:["もう一度","次の動画へ"]});
  assert.deepEqual(buildEnqueteRequest("result","lv123"),{ok:true,url:base+"/result",method:"POST"});
  assert.deepEqual(buildEnqueteRequest("finish","lv123"),{ok:true,url:base,method:"DELETE"});
});

test("rejects invalid program IDs and unsupported actions", () => {
  assert.equal(buildEnqueteRequest("start","https://example.com",{}).code,"INVALID_PROGRAM_ID");
  assert.equal(buildEnqueteRequest("unknown","lv123").code,"INVALID_ACTION");
});

test("maps permission and state errors without returning server response bodies", () => {
  assert.equal(mapEnqueteHttpError(401).code,"AUTH_REQUIRED");
  assert.equal(mapEnqueteHttpError(403).code,"BROADCASTER_PERMISSION_REQUIRED");
  assert.equal(mapEnqueteHttpError(404).code,"PROGRAM_NOT_FOUND");
  assert.equal(mapEnqueteHttpError(409).code,"ENQUETE_CONFLICT");
  assert.match(mapEnqueteHttpError(503).message,/503/);
});

test("parses valid poll result payloads and bounds their contents", () => {
  const parsed = parseEnqueteResultResponse(JSON.stringify({
    data:{title:"投票結果",items:[{name:"もう一度",rate:60},{name:"次の動画へ",rate:40}]}
  }));
  assert.equal(parsed.ok,true);
  assert.equal(parsed.items[0].rate,60);
  assert.equal(parseEnqueteResultResponse("invalid").ok,false);
  assert.equal(parseEnqueteResultResponse(JSON.stringify({data:{items:[{name:"x",rate:120},{name:"y",rate:0}]}})).code,"ENQUETE_RESULT_INVALID");
});
