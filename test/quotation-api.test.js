"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const api = require("../src/quotation-api");

test("builds a read-only current quotation request", () => {
  assert.deepEqual(api.buildGetCurrentQuotationRequest("LV123"), {
    ok:true,
    method:"GET",
    url:"https://services-eapi.spi.nicovideo.jp/v1/tools/live/contents/lv123/quotation"
  });
  assert.equal(api.buildGetCurrentQuotationRequest("https://evil.example/lv123").ok,false);
});

test("builds a POST when no quotation exists", () => {
  const result=api.buildPlayQuotationRequest({
    programId:"lv123",
    videoId:"sm12345678",
    hasActiveQuotation:false,
    mainVolume:0.7,
    subVolume:0.2
  });
  assert.equal(result.ok,true);
  assert.equal(result.method,"POST");
  assert.equal(result.url,"https://services-eapi.spi.nicovideo.jp/v1/tools/live/contents/lv123/quotation");
  assert.deepEqual(result.body,{
    contents:[{id:"sm12345678",type:"video"}],
    layout:{
      main:{source:"quote",volume:0.7},
      sub:{isSoundOnly:true,source:"self",volume:0.2}
    },
    repeat:false,
    enableAddViewCount:true
  });
});

test("builds a PATCH when a quotation is already active", () => {
  const result=api.buildPlayQuotationRequest({
    programId:"lv123",
    videoId:"nm123",
    hasActiveQuotation:true
  });
  assert.equal(result.method,"PATCH");
  assert.equal(result.url,"https://services-eapi.spi.nicovideo.jp/v1/tools/live/contents/lv123/quotation/contents");
  assert.deepEqual(result.body,{contents:[{id:"nm123",type:"video"}]});
  assert.equal("layout" in result.body,false);
});

test("builds a DELETE request to stop the quotation", () => {
  assert.deepEqual(api.buildStopQuotationRequest("lv123"),{
    ok:true,
    method:"DELETE",
    url:"https://services-eapi.spi.nicovideo.jp/v1/tools/live/contents/lv123/quotation",
    body:{}
  });
});

test("validates IDs and constrains volume values", () => {
  assert.equal(api.buildPlayQuotationRequest({programId:"lv123",videoId:"https://evil.example"}).code,"INVALID_VIDEO_ID");
  assert.equal(api.buildPlayQuotationRequest({programId:"../x",videoId:"sm123"}).code,"INVALID_PROGRAM_ID");
  assert.equal(api.buildPlayQuotationRequest({programId:"lv123",videoId:"sm123",mainVolume:5}).body.layout.main.volume,1);
  assert.equal(api.buildPlayQuotationRequest({programId:"lv123",videoId:"sm123",subVolume:-1}).body.layout.sub.volume,0);
});

test("treats HTTP 404 as no quotation and rejects malformed current state", () => {
  assert.deepEqual(api.parseCurrentQuotationResponse(404,""),{ok:true,exists:false,currentVideoId:""});
  const current=api.parseCurrentQuotationResponse(200,JSON.stringify({currentContent:{id:"sm12345678",type:"video"}}));
  assert.equal(current.exists,true);
  assert.equal(current.currentVideoId,"sm12345678");
  assert.equal(api.parseCurrentQuotationResponse(200,"bad").ok,false);
});

test("maps login, permission, and non-quotable failures to Japanese messages", () => {
  assert.equal(api.parseCurrentQuotationResponse(401,"").code,"AUTH_REQUIRED");
  assert.equal(api.parseCurrentQuotationResponse(403,"").code,"BROADCASTER_PERMISSION_REQUIRED");
  assert.equal(api.parseQuotationMutationResponse(400,JSON.stringify({meta:{errorMessage:"引用できません"}})).message,"引用できません");
  assert.equal(api.parseQuotationMutationResponse(200,"").ok,true);
});
