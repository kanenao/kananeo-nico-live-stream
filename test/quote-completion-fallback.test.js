"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {completionPlan,canFinishQuotedVideo,completionComment}=require("../src/quote-completion-fallback");
const START=1763800000000;
const current={autoPollEnabled:true,quoteActive:true,quoteVerified:true,
 programId:"lv123456",videoId:"sm100",storedProgramId:"lv123456",storedVideoId:"sm100",
 startedAt:START,durationMs:25000};
test("known current quote with auto poll enabled arms a completion timer after the expected duration",()=>{
 const plan=completionPlan(current,START+2000);
 assert.equal(plan.ok,true);
 assert.equal(plan.dueAt,START+26500);
 assert.equal(plan.key,"lv123456:sm100:"+START);
 assert.equal(completionPlan({...current,autoPollEnabled:false},START+2000).ok,false);
 assert.equal(completionPlan({...current,quoteVerified:false},START+2000).ok,false);
 assert.equal(completionPlan({...current,storedVideoId:"sm999"},START+2000).ok,false);
 assert.equal(completionPlan({...current,storedProgramId:"lv123457"},START+2000).ok,false);
 assert.equal(completionPlan({...current,startedAt:0},START+2000).ok,false);
 assert.equal(completionPlan({...current,durationMs:0},START+2000).ok,false);
});
test("finish only when due and same program/video/start were checked read-only",()=>{
 const plan=completionPlan(current,START+1000);
 const state={autoPollEnabled:true,quoteActive:true,quoteVerified:true,pollActive:false,
   programId:current.programId,videoId:current.videoId,startedAt:START,
   quotationOk:true,quotationExists:true,currentVideoId:current.videoId};
 assert.equal(canFinishQuotedVideo(plan,state,plan.dueAt-1),false);
 assert.equal(canFinishQuotedVideo(plan,state,plan.dueAt),true);
 assert.equal(canFinishQuotedVideo(plan,{...state,quotationExists:false},plan.dueAt),true);
 assert.equal(canFinishQuotedVideo(plan,{...state,quotationOk:false},plan.dueAt),false);
 assert.equal(canFinishQuotedVideo(plan,{...state,currentVideoId:"sm200"},plan.dueAt),false);
 assert.equal(canFinishQuotedVideo(plan,{...state,programId:"lv654321"},plan.dueAt),false);
 assert.equal(canFinishQuotedVideo(plan,{...state,startedAt:START+1000},plan.dueAt),false);
 assert.equal(canFinishQuotedVideo(plan,{...state,pollActive:true},plan.dueAt),false);
 assert.equal(canFinishQuotedVideo(plan,{...state,autoPollEnabled:false},plan.dueAt),false);
});
test("finish announcement is short, identifies 完走 and avoids claiming precise API playhead",()=>{
 for(const hasNext of [true,false]){
  const n=completionComment(hasNext);
  assert.equal(n.ok,true);assert.match(n.text,/完走/);
  assert.match(n.text,/再生予定時間/);
  assert.ok(Array.from(n.text).length<=80);
 }
 assert.match(completionComment(true).text,/次の動画へ/);
 assert.match(completionComment(false).text,/リクエストを待って/);
});
