"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeProgramId, extractEmbeddedData, inspectWatchPage, NiconicoPageError } = require("../src/niconico-program");

test("normalizes a bare program ID", () => {
  assert.equal(normalizeProgramId(" LV123456789 "), "lv123456789");
});

test("extracts IDs from trusted Nico Live watch URLs", () => {
  assert.equal(normalizeProgramId("https://live2.nicovideo.jp/watch/lv123456789?ref=share"), "lv123456789");
  assert.equal(normalizeProgramId("https://live.nicovideo.jp/watch/LV123456789/"), "lv123456789");
});

test("rejects lookalike domains and unrelated paths", () => {
  assert.throws(() => normalizeProgramId("https://live.nicovideo.jp.evil.example/watch/lv123"), NiconicoPageError);
  assert.throws(() => normalizeProgramId("http://live.nicovideo.jp/watch/lv123"), NiconicoPageError);
  assert.throws(() => normalizeProgramId("https://live.nicovideo.jp/user/123"), NiconicoPageError);
});

test("parses escaped embedded data", () => {
  const payload = { program: { title: "テスト配信", status:"ON_AIR", endTime:1794326400 }, site: { relive: { webSocketUrl: "wss://a.live.nicovideo.jp/wsapi/v2/watch/lv123" } } };
  const html = '<script id="embedded-data" data-props="' + JSON.stringify(payload).replace(/"/g, "&quot;") + '"></script>';
  assert.deepEqual(extractEmbeddedData(html), payload);
  assert.deepEqual(inspectWatchPage(html, "lv123"), {
    programId: "lv123", title: "テスト配信", programStatus:"ON_AIR", endTime:1794326400, watchingApiAvailable: true, pageDataFound: true
  });
});

test("does not trust arbitrary websocket destinations", () => {
  const html = '<script id="embedded-data" data-props=\'{"site":{"relive":{"webSocketUrl":"wss://attacker.example/socket"}}}\'></script>';
  assert.equal(inspectWatchPage(html, "lv123").watchingApiAvailable, false);
});

test("reports missing and malformed embedded data", () => {
  assert.throws(() => extractEmbeddedData("<html>no embedded data</html>"), { code: "EMBEDDED_DATA_MISSING" });
  assert.throws(() => extractEmbeddedData('<script id="embedded-data" data-props="{bad json}"></script>'), { code: "EMBEDDED_DATA_INVALID" });
});
