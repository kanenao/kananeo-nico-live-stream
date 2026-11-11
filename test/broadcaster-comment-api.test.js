"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBroadcasterCommentRequest, parseBroadcasterCommentResponse } = require("../src/broadcaster-comment-api");

test("builds a restricted broadcaster comment request using URL-encoded form data", () => {
  const request = buildBroadcasterCommentRequest({
    programId:"LV123456789",
    csrfToken:"csrf-example",
    text:">>12 リクエストを受け付けました"
  });
  assert.equal(request.ok,true);
  assert.equal(request.method,"PUT");
  assert.equal(request.url,"https://live2.nicovideo.jp/unama/api/v3/programs/lv123456789/broadcaster_comment");
  assert.equal(request.headers["X-Public-Api-Token"],"csrf-example");
  assert.equal(request.headers["Content-Type"],"application/x-www-form-urlencoded;charset=UTF-8");
  const body = new URLSearchParams(request.body);
  assert.equal(body.get("text"),">>12 リクエストを受け付けました");
  assert.equal(body.get("isPermanent"),"false");
});

test("rejects invalid IDs, missing tokens, and overlong comments", () => {
  assert.equal(buildBroadcasterCommentRequest({programId:"lv1.evil",csrfToken:"x",text:"test"}).code,"INVALID_PROGRAM_ID");
  assert.equal(buildBroadcasterCommentRequest({programId:"lv1",text:"test"}).code,"CSRF_TOKEN_MISSING");
  assert.equal(buildBroadcasterCommentRequest({programId:"lv1",csrfToken:"x",text:"あ".repeat(81)}).code,"INVALID_COMMENT");
});

test("maps authentication and rate-limit responses", () => {
  assert.equal(parseBroadcasterCommentResponse("",401).code,"BROADCASTER_PERMISSION_REQUIRED");
  assert.equal(parseBroadcasterCommentResponse("",429).code,"BROADCASTER_RATE_LIMITED");
  assert.equal(parseBroadcasterCommentResponse('{"meta":{"status":401,"errorCode":"AUTHENTICATION_FAILED"}}',200).code,"BROADCASTER_PERMISSION_REQUIRED");
});

test("accepts a successful API response and rejects malformed JSON", () => {
  assert.equal(parseBroadcasterCommentResponse('{"meta":{"status":200,"errorCode":"OK"}}',200).ok,true);
  assert.equal(parseBroadcasterCommentResponse("{broken",200).code,"BROADCASTER_RESPONSE_INVALID");
  assert.equal(parseBroadcasterCommentResponse("",200).code,"BROADCASTER_RESPONSE_INVALID");
  assert.equal(parseBroadcasterCommentResponse('{"success":true}',200).code,"BROADCASTER_RESPONSE_INVALID");
  assert.equal(parseBroadcasterCommentResponse("",500).code,"BROADCASTER_HTTP_ERROR");
});
