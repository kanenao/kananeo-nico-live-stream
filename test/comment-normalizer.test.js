"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeComment,normalizeOperatorComment,normalizeNotification}=require("../src/comment-normalizer");

test("normalizes a regular comment without forwarding raw protobuf",()=>{
  const raw={no:42,content:"こんにちは",userId:"user123",userName:"viewer",timestamp:new Date("2026-01-01T00:00:00Z"),raw:{private:"secret"}};
  const value=normalizeComment(raw);
  assert.equal(value.type,"comment");
  assert.equal(value.id,"42");
  assert.equal(value.content,"こんにちは");
  assert.equal(value.userName,"viewer");
  assert.equal(Object.hasOwn(value,"raw"),false);
  assert.equal(JSON.stringify(value).includes("secret"),false);
});

test("uses a safe anonymous label and bounds oversized content",()=>{
  const value=normalizeComment({content:"x".repeat(6000),userName:"",userId:""});
  assert.equal(value.userName,"匿名");
  assert.equal(value.content.length,4000);
});

test("normalizes operator comments and history markers",()=>{
  const value=normalizeOperatorComment({content:"運営からのお知らせ",name:"運営",isHistory:true});
  assert.equal(value.type,"operatorComment");
  assert.equal(value.userName,"運営");
  assert.equal(value.isHistory,true);
});

test("normalizes gifts and notifications as display-safe events",()=>{
  const gift=normalizeNotification({userName:"Alice",itemName:"ギフト",point:100,message:"応援"}, "gift");
  const notice=normalizeNotification({message:"放送が延長されました"},"notification");
  assert.equal(gift.type,"gift");
  assert.match(gift.content,/100pt/);
  assert.match(notice.content,/延長/);
});
