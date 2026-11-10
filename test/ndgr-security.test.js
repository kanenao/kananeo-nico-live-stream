"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {isTrustedNdgrUri}=require("../src/ndgr-security");

test("accepts expected NDGR HTTPS endpoints",()=>{
  assert.equal(isTrustedNdgrUri("https://mpn.live.nicovideo.jp/api/view/v4/test","message"),true);
  assert.equal(isTrustedNdgrUri("https://mpn.live.nicovideo.jp/data/segment/v4/test","segment"),true);
  assert.equal(isTrustedNdgrUri("https://mpn.live.nicovideo.jp/data/backward/v4/test","backward"),true);
});

test("rejects lookalike hosts, insecure schemes and wrong endpoint families",()=>{
  assert.equal(isTrustedNdgrUri("https://mpn.live.nicovideo.jp.evil.example/api/view/v4/x","message"),false);
  assert.equal(isTrustedNdgrUri("http://mpn.live.nicovideo.jp/api/view/v4/x","message"),false);
  assert.equal(isTrustedNdgrUri("https://example.com/data/segment/v4/x","segment"),false);
  assert.equal(isTrustedNdgrUri("https://mpn.live.nicovideo.jp/api/view/v4/x","segment"),false);
});
