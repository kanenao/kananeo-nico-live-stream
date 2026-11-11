"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateCommentRequest } = require("../src/request-policy");

const base = {
  comment:{ userId:"user-1", content:"リクエスト sm12345678" },
  videoId:"sm12345678",
  requests:[],
  stocks:[],
  ngUsers:[],
  ngWords:[],
  pendingVideoIds:[],
  settings:{ maxPerUser:2 }
};

test("accepts a valid explicit request", () => {
  assert.equal(evaluateCommentRequest(base).accepted, true);
});

test("rejects NG users and NG words", () => {
  assert.equal(evaluateCommentRequest({...base,ngUsers:["user-1"]}).code,"NG_USER");
  assert.equal(evaluateCommentRequest({...base,ngWords:["リクエスト"]}).code,"NG_WORD");
  assert.equal(evaluateCommentRequest({...base,ngWords:["SM123"]}).code,"NG_WORD");
});

test("rejects duplicates in requests, stocks, and pending validation", () => {
  assert.equal(evaluateCommentRequest({...base,requests:[{videoId:"SM12345678",status:"queued"}]}).code,"DUPLICATE");
  assert.equal(evaluateCommentRequest({...base,stocks:[{videoId:"sm12345678"}]}).code,"DUPLICATE");
  assert.equal(evaluateCommentRequest({...base,pendingVideoIds:["SM12345678"]}).code,"DUPLICATE_PENDING");
});

test("enforces global and per-user active request limits", () => {
  const full=Array.from({length:200},(_,i)=>({videoId:"sm"+(i+1),status:"queued"}));
  assert.equal(evaluateCommentRequest({...base,requests:full}).code,"QUEUE_FULL");
  assert.equal(evaluateCommentRequest({...base,requests:[
    {videoId:"sm1",status:"queued",source:"comment",requestUserId:"user-1"},
    {videoId:"sm2",status:"playing",source:"comment",requestUserId:"user-1"}
  ]}).code,"USER_LIMIT");
});

test("does not count completed, skipped, or rejected requests toward limits", () => {
  const old=[
    {videoId:"sm1",status:"completed",source:"comment",requestUserId:"user-1"},
    {videoId:"sm2",status:"skipped",source:"comment",requestUserId:"user-1"},
    {videoId:"sm3",status:"rejected",source:"comment",requestUserId:"user-1"}
  ];
  assert.equal(evaluateCommentRequest({...base,requests:old}).accepted,true);
});

test("rejects malformed video identifiers", () => {
  assert.equal(evaluateCommentRequest({...base,videoId:"https://example.com"}).code,"INVALID_VIDEO");
});
