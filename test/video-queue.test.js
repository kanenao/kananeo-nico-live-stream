"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeNiconicoVideoUrl, findNextQueueItem } = require("../src/video-queue");

test("normalizes supported NicoNico video IDs and watch URLs", () => {
  for (const input of ["sm12345678", "https://www.nicovideo.jp/watch/sm12345678?ref=pc_userpage", "https://nico.ms/sm12345678", "https://sp.nicovideo.jp/watch/nm12345"]) {
    const result = normalizeNiconicoVideoUrl(input);
    assert.equal(result.ok, true);
    assert.equal(result.url, "https://www.nicovideo.jp/watch/" + result.videoId);
  }
});

test("rejects non-NicoNico hosts, insecure URLs, and non-video pages", () => {
  for (const input of ["https://example.com/watch/sm123", "http://www.nicovideo.jp/watch/sm123", "https://www.nicovideo.jp/user/123", "javascript:alert(1)", ""]) {
    assert.equal(normalizeNiconicoVideoUrl(input).ok, false);
  }
});

test("finds the next pending item without wrapping or replaying completed items", () => {
  const queue = [
    { id:"a", status:"completed" },
    { id:"b", status:"playing" },
    { id:"c", status:"skipped" },
    { id:"d", status:"queued" }
  ];
  assert.equal(findNextQueueItem(queue, "b").id, "d");
  assert.equal(findNextQueueItem(queue, "d"), null);
  assert.equal(findNextQueueItem(queue, "missing").id, "b");
  assert.equal(findNextQueueItem([], "a"), null);
});
