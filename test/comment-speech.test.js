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
