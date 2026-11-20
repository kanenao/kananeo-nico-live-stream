"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const resume=require("../src/quote-resume");
const renderer=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"../src/index.html"),"utf8");
const now=1780000012000;
const input={programId:"lv123",videoId:"sm456",storedProgramId:"lv123",storedVideoId:"sm456",
 startedAt:now-12000,durationMs:120000};
test("live quotation clock measures elapsed and remaining time without exceeding bounds",()=>{
 const p=resume.quoteProgress(input,now);
 assert.equal(p.ok,true);
 assert.equal(p.elapsedMs,12000);
 assert.equal(p.remainingMs,108000);
 assert.equal(p.percent,10);
 const end=resume.quoteProgress(input,now+200000);
 assert.equal(end.elapsedMs,120000);
 assert.equal(end.percent,100);
});
test("untrusted timestamps, mismatched program/video and unknown duration do not display guessed time",()=>{
 for(const options of [
 {storedProgramId:"lv999"},{storedVideoId:"sm789"},{startedAt:now+10000},{startedAt:0},
 {durationMs:0},{durationMs:-1},{videoId:"http://example.org/video"},
 {programId:"../../lv123"}
 ]){
  assert.equal(resume.quoteProgress({...input,...options},now).ok,false);
 }
 assert.equal(resume.quoteProgress(input,now+86400001).ok,false);
});
test("only verified, unfinished playback makes a cross-frame checkpoint",()=>{
 const p=resume.quoteProgress(input,now);
 assert.equal(resume.checkpointFromProgress(p,{now,verified:false}),null);
 assert.equal(resume.checkpointFromProgress(p,{now,verified:true}).offsetMs,12000);
 assert.equal(resume.checkpointFromProgress(resume.quoteProgress(input,now+118000),
  {now:now+118000,verified:true}),null);
});
test("checkpoint survives a new frame but does not assert unsupported seek",()=>{
 const p=resume.quoteProgress(input,now);
 const saved=resume.checkpointFromProgress(p,{now,verified:true,title:"前枠で流していた曲"});
 const continuation=resume.continueInfo(saved,"lv789",now+30000);
 assert.equal(continuation.ok,true);
 assert.equal(continuation.videoId,"sm456");
 assert.equal(continuation.offsetMs,12000);
 assert.equal(continuation.seekSupported,false);
 assert.equal(continuation.canAutoResume,false);
 assert.equal(resume.continueInfo(saved,"lv123",now+30000).ok,false);
 assert.equal(resume.continueInfo(saved,"lv789",now+7*60*60*1000).ok,false);
 assert.equal(resume.continueInfo({...saved,offsetMs:120000},"lv789",now+30000).ok,false);
});
test("renderer shows separate quotation progress and persists a marker every five seconds",()=>{
 assert.match(index,/<script src="quote-resume\.js"><\/script>/);
 assert.ok(index.indexOf("quote-resume.js")<index.indexOf("renderer.js"));
 assert.match(renderer,/function currentQuoteProgress\(/);
 assert.match(renderer,/quoteProgress\(\{/);
 assert.match(renderer,/quoteResumeCheckpoint=c/);
 assert.match(renderer,/Math\.floor\(previous\.offsetMs\/5000\)/);
 assert.match(renderer,/id="quote-time-label"/);
 assert.match(renderer,/id="quote-time-progress"/);
 assert.match(renderer,/id="quote-resume-checkpoint"/);
 assert.match(renderer,/updateQuoteScheduleUi\(\);updateQuoteProgressUi\(\)/);
 assert.match(renderer,/動画の実再生位置をAPIから取得した値ではありません/);
});
test("next-frame autoplay holds rather than restarting at zero and pretending to seek",()=>{
 const begin=renderer.indexOf("async function maybeAutoPlayOnOwnLive("),end=renderer.indexOf("async function ",begin+15);
 assert.ok(begin>=0&&end>begin);
 const block=renderer.slice(begin,end);
 assert.match(block,/const continuation=window\.KananeoQuoteResume\.continueInfo\(state\.playback\.quoteResumeCheckpoint,id\)/);
 assert.match(block,/if\(state\.automation\.keepPosition&&continuation\.ok\)/);
 const guard=block.indexOf("if(state.automation.keepPosition&&continuation.ok)");
 const select=block.indexOf("selectPlaybackCandidate");
 assert.ok(guard< select,"guard must run before a new video is selected");
 assert.match(block.slice(guard,select),/return;/);
 assert.match(block,/引用再生APIの途中シークが未確認/);
 assert.match(renderer,/state\.playback\.quoteResumeCheckpoint=null/);
 assert.match(renderer,/data-quote-clear-checkpoint/);
});
test("quotation request remains unchanged; never send fabricated seek/start offset",()=>{
 const fsQuotation=fs.readFileSync(path.join(__dirname,"../src/quotation-api.js"),"utf8");
 assert.doesNotMatch(fsQuotation,/body\.(?:startAt|seek|offset|position)\s*=/);
 assert.match(fsQuotation,/contents:\[\{ id:videoId, type:"video" \}\]/);
});
