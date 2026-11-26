"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const lifecycle=require("../src/quote-frame-lifecycle");
const renderer=read("src/renderer.js"),quick=read("src/broadcast-quick-tools.js");
const css=read("src/style.css"),index=read("src/index.html"),program=read("src/program-control.js");
const pkg=JSON.parse(read("package.json"));
const now=Date.parse("2026-11-24T05:30:00Z");
const past=now-30000;
test("frame progress freezes at broadcast end even if the application keeps running",()=>{
 const f={programId:"lv123",lastProgramId:"lv123",frameEndsAt:past/1000,status:"ON_AIR"};
 assert.equal(lifecycle.frameClockTime(f,now),past);
 assert.equal(lifecycle.frameClockTime(f,now+600000),past);
 assert.equal(lifecycle.shouldVerifyFrame(f,now),true);
});
test("an actually extended broadcast can resume its clock after verification",()=>{
 const f={programId:"lv123",lastProgramId:"lv123",frameEndsAt:(now+600000)/1000,status:"ON_AIR"};
 assert.equal(lifecycle.shouldVerifyFrame(f,now),false);
 assert.equal(lifecycle.frameClockTime(f,now),now);
 assert.equal(lifecycle.frameClockTime(f,now+610000),now+600000);
});
test("never use another program's end time to freeze a different quote",()=>{
 assert.equal(lifecycle.frameClockTime({programId:"lv123",lastProgramId:"lv456",frameEndsAt:past/1000},now),now);
});
test("unknown end time only freezes after a verified end and valid frozen time",()=>{
 assert.equal(lifecycle.frameClockTime({programId:"lv123",lastProgramId:"lv123",frameEndsAt:0,status:"ON_AIR"},now),now);
 assert.equal(lifecycle.frameClockTime({programId:"lv123",lastProgramId:"lv123",frameEndsAt:0,status:"ENDED",frozenAt:past},now),past);
});
test("state verifier rejects unrelated IDs or ambiguous failure",()=>{
 assert.equal(lifecycle.evaluateFrameStatus({ok:false},"lv123").kind,"unknown");
 assert.equal(lifecycle.evaluateFrameStatus({ok:true,programId:"lv456",programStatus:"ENDED"},"lv123").kind,"unknown");
 assert.equal(lifecycle.evaluateFrameStatus({ok:true,programId:"lv123",programStatus:"ENDED"},"lv123").kind,"ended");
 assert.equal(lifecycle.evaluateFrameStatus({ok:true,programId:"lv123",programStatus:"ON_AIR",endTime:(now+600000)/1000},"lv123",now).kind,"live");
});
test("renderer persists the last verified position and stops timers when frame ends",()=>{
 for(const value of [
  "function finalizeEndedQuotedFrame(", "window.KananeoQuoteResume.checkpointFromProgress",
  "state.playback.quoteResumeCheckpoint=saved","clearQuoteAutoTimer(",
  "stopPollDeadlineGuard();", "cancelPollWait();","pollRepeatUntil=0",
  "state.player.quoteStartedAt=0","state.player.quoteExpectedEndAt=0",
  "function verifyQuotedFrameAfterDeadline(", "niconico.checkProgram(programId)",
  "quoteFrameTime(now)","void verifyQuotedFrameAfterDeadline()"
 ])assert.ok(renderer.includes(value),value);
 assert.match(renderer,/currentQuoteProgress\(cap\)/);
 assert.match(renderer,/quoteFrameTime\(now\)/);
 assert.match(renderer,/now-quoteFrameRuntime\.lastCheckedAt<15000/);
 assert.match(renderer,/state\.lastProgramId\|\|""\)\.toLowerCase\(\)!==String\(quotePlayback\.programId\|\|""\)/);
 assert.match(index,/<script src="quote-frame-lifecycle.js"><\/script>/);
});
test("a next-frame transition checkpoints the previous program before replacing IDs",()=>{
 assert.match(renderer,/if\(quotePlayback\.active&&quotePlayback\.programId!==programId\)finalizeEndedQuotedFrame\(quotePlayback\.programId\)/);
 assert.match(renderer,/const continuation=window\.KananeoQuoteResume\.continueInfo\(state\.playback\.quoteResumeCheckpoint,id\)/);
 assert.match(renderer,/引用再生APIの途中シークが未確認/);
 assert.match(renderer,/getElementById\("broadcast-resume-checkpoint"\)/);
 assert.match(quick,/id="broadcast-resume-checkpoint"/);
});
test("STAGE automatically requests fullscreen on explicit view start and supports exit",()=>{
 assert.match(renderer,/id="broadcast-stage"/);
 assert.match(renderer,/data-stage-fullscreen/);
 assert.match(renderer,/function toggleStageFullscreen\(automatic=false\)/);
 assert.match(renderer,/stage\.requestFullscreen\(\)/);
 assert.match(renderer,/toggleStageFullscreen\(true\)/);
 assert.match(renderer,/data-live-video-close/);
 assert.match(renderer,/document\.addEventListener\("fullscreenchange"/);
 assert.match(css,/#broadcast-stage:fullscreen/);
 assert.match(css,/#broadcast-stage:fullscreen \.broadcast-player-body/);
});
test("STAGE broadcast end uses verified original API with explicit confirmation",()=>{
 assert.match(renderer,/data-broadcast-program-end/);
 assert.match(renderer,/confirm\("自分の放送 "/);
 assert.match(renderer,/niconico\.controlProgram\(id,"end"\)/);
 assert.match(renderer,/if\(response\?\.ok&&response\.verified\)/);
 assert.match(renderer,/finalizeEndedQuotedFrame\(id\)/);
 assert.match(program,/function canMutateProgram/);
 assert.match(program,/action==="end"/);
 assert.match(css,/\.broadcast-stage-end/);
});
test("repeat poll offers real-time countdown in broadcast and poll views",()=>{
 assert.match(renderer,/function pollCountdownText\(now=Date\.now\(\)\)/);
 assert.match(renderer,/Math\.ceil\(\(pollRepeatUntil-now\)\/1000\)/);
 assert.match(renderer,/function updatePollRepeatCountdownUi\(/);
 assert.match(renderer,/id="poll-repeat-countdown"/);
 assert.match(quick,/id="broadcast-poll-countdown"/);
 assert.match(renderer,/waitForPoll\(plan\.delaySeconds\*1000,token,"repeat"\)/);
 assert.match(renderer,/pollRepeatUntil=0;updatePollRepeatCountdownUi\(\)/);
 assert.match(renderer,/updatePollRepeatCountdownUi\(\);void verifyQuotedFrameAfterDeadline\(\)/);
});
test("released version progresses alpha serial continuously",()=>{
 assert.equal(pkg.version,"0.9.7-alpha.109");
 assert.match(index,/ALPHA 109/);
});
