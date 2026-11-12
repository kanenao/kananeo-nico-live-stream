"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBroadcastNavigationUrl } = require("../src/broadcast-navigation");

test("builds the official Niconico new-program page", () => {
  assert.deepEqual(buildBroadcastNavigationUrl("create"), {
    ok:true,
    mode:"create",
    url:"https://live.nicovideo.jp/create"
  });
});

test("opens only a validated Niconico program watch page for management", () => {
  assert.deepEqual(buildBroadcastNavigationUrl("manage","lv123456789"), {
    ok:true,
    mode:"manage",
    programId:"lv123456789",
    url:"https://live.nicovideo.jp/watch/lv123456789"
  });
  assert.equal(buildBroadcastNavigationUrl("manage","https://example.com/lv123").ok,false);
  assert.equal(buildBroadcastNavigationUrl("manage","../lv123").ok,false);
});

test("rejects unknown navigation modes", () => {
  assert.equal(buildBroadcastNavigationUrl("stop","lv123").code,"INVALID_MODE");
});
