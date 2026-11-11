"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  normalizeCommentSpeechSettings,
  createCommentSpeechText,
  appendSpeechQueue
}=require("../src/comment-speech");

test("normalizes speech settings and clamps values",()=>{
  const settings=normalizeCommentSpeechSettings({enabled:1,includeName:true,rate:9,pitch:-1,volume:2,maxQueue:999,voiceURI:"x".repeat(600)});
  assert.equal(settings.enabled,false);
  assert.equal(settings.includeName,true);
  assert.equal(settings.rate,2);
  assert.equal(settings.pitch,0);
  assert.equal(settings.volume,1);
  assert.equal(settings.maxQueue,200);
  assert.equal(settings.voiceURI.length,512);
});

test("builds a Japanese speech line using a registered nickname",()=>{
  const result=createCommentSpeechText(
    {type:"comment",userName:"Original",content:"こんにちは"},
    {nickname:"コテハン"},
    {enabled:true,includeName:true}
  );
  assert.equal(result.ok,true);
  assert.equal(result.text,"コテハン、こんにちは");
});

test("skips history, unsupported event types, disabled settings, and NG words",()=>{
  const enabled={enabled:true};
  assert.equal(createCommentSpeechText({type:"comment",content:"old",isHistory:true},null,enabled).code,"HISTORY");
  assert.equal(createCommentSpeechText({type:"gift",content:"gift"},null,enabled).code,"UNSUPPORTED_TYPE");
  assert.equal(createCommentSpeechText({type:"comment",content:"hello"},null,{}).code,"DISABLED");
  assert.equal(createCommentSpeechText({type:"comment",content:"これはNGワード"},null,enabled,["NGワード"]).code,"NG_WORD");
});

test("operator comments are opt-in and long text is bounded",()=>{
  assert.equal(createCommentSpeechText({type:"operatorComment",content:"通知"},null,{enabled:true}).code,"UNSUPPORTED_TYPE");
  const result=createCommentSpeechText({type:"operatorComment",content:"a".repeat(400)},null,{enabled:true,speakOperator:true});
  assert.equal(result.ok,true);
  assert.equal(Array.from(result.text).length,300);
});

test("speech queue drops oldest items when it reaches its cap",()=>{
  const result=appendSpeechQueue(["one","two","three"],"four",3);
  assert.deepEqual(result.queue,["two","three","four"]);
  assert.equal(result.dropped,1);
  assert.equal(appendSpeechQueue(result.queue,"",3).added,false);
});
