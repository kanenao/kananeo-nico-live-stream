"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  normalizeCommentSpeechSettings,
  normalizeMutedUserIds,
  isUserSpeechMuted,
  setUserSpeechMuted,
  selectSpeechVoice,
  createCommentSpeechText,
  appendSpeechQueue,
  removeSpeechQueueByUser,
  removeSpeechQueueItem
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

test("prefers a Japanese voice unless a saved voice is explicitly selected",()=>{
  const voices=[
    {voiceURI:"english",lang:"en-US",default:true},
    {voiceURI:"japanese",lang:"ja-JP",default:false}
  ];
  assert.equal(selectSpeechVoice(voices).voiceURI,"japanese");
  assert.equal(selectSpeechVoice(voices,"english").voiceURI,"english");
  assert.equal(selectSpeechVoice([]),null);
});

test("normalizes per-user mute IDs and toggles one user at a time",()=>{
  const base=normalizeCommentSpeechSettings({mutedUserIds:[" 123 ","123","456","","789"]});
  assert.deepEqual(base.mutedUserIds,["123","456","789"]);
  assert.equal(isUserSpeechMuted(base,"123"),true);
  const unmuted=setUserSpeechMuted(base,"123",false);
  assert.equal(unmuted.ok,true);
  assert.equal(unmuted.muted,false);
  assert.deepEqual(unmuted.settings.mutedUserIds,["456","789"]);
  const toggled=setUserSpeechMuted(unmuted.settings,"321");
  assert.equal(toggled.muted,true);
  assert.equal(isUserSpeechMuted(toggled.settings,"321"),true);
  assert.equal(setUserSpeechMuted(base,"").code,"INVALID_USER_ID");
});

test("caps muted users and refuses additions beyond the limit",()=>{
  const ids=Array.from({length:2000},(_,index)=>String(index+1));
  const settings=normalizeCommentSpeechSettings({mutedUserIds:ids});
  assert.equal(settings.mutedUserIds.length,2000);
  assert.equal(setUserSpeechMuted(settings,"2001").code,"MUTE_LIMIT");
  assert.equal(setUserSpeechMuted(settings,"1",false).ok,true);
});

test("skips comments from individually muted users",()=>{
  const result=createCommentSpeechText(
    {type:"comment",userId:"999",content:"This should not be read"},
    null,
    {enabled:true,mutedUserIds:["999"]}
  );
  assert.equal(result.ok,false);
  assert.equal(result.code,"USER_MUTED");
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


test("stores speaker metadata with queued comments and removes muted users immediately",()=>{
  const queued=appendSpeechQueue(
    [{text:"先頭",userId:"other",userName:"別ユーザー"}],
    {text:"読み上げ対象外",userId:" 123 ",userName:"対象ユーザー"},
    10
  );
  assert.equal(queued.added,true);
  assert.deepEqual(queued.queue[1],{text:"読み上げ対象外",userId:"123",userName:"対象ユーザー"});
  const removed=removeSpeechQueueByUser(queued.queue,"123");
  assert.equal(removed.removed,1);
  assert.deepEqual(removed.queue,[{text:"先頭",userId:"other",userName:"別ユーザー"}]);
  assert.equal(removeSpeechQueueByUser(removed.queue,"").removed,0);
});

test("removes one pending speech item by index and rejects invalid indexes",()=>{
  const queue=["one",{text:"two",userId:"2"},"three"];
  const removed=removeSpeechQueueItem(queue,1);
  assert.equal(removed.ok,true);
  assert.deepEqual(removed.removed,{text:"two",userId:"2"});
  assert.deepEqual(removed.queue,["one","three"]);
  assert.equal(removeSpeechQueueItem(queue,9).ok,false);
  assert.equal(removeSpeechQueueItem(queue,-1).ok,false);
});

test("rejects empty queue metadata without mutating the original queue",()=>{
  const original=["existing"];
  const result=appendSpeechQueue(original,{text:"  ",userId:"1"},10);
  assert.equal(result.added,false);
  assert.deepEqual(result.queue,original);
  assert.deepEqual(original,["existing"]);
});
