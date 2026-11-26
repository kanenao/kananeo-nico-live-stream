"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const lifecycle=require("../src/quote-frame-lifecycle");
const r=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
test("only the matching valid frame may be marked ended",()=>{
 assert.equal(lifecycle.sameFrame("LV123","lv123"),true);
 assert.equal(lifecycle.sameFrame("",""),false);
 assert.equal(lifecycle.sameFrame("lv123","lv456"),false);
 assert.equal(lifecycle.isConfirmedFrameEnd("lv123","lv456","ENDED"),false);
 assert.equal(lifecycle.isConfirmedFrameEnd("lv123","lv123","ENDED"),true);
 assert.equal(lifecycle.isConfirmedFrameEnd("lv123","lv123","ON_AIR"),false);
});
test("verified early end freezes at actual cutoff even before scheduled end",()=>{
 const t=1000000;
 const f={programId:"lv123",lastProgramId:"lv123",frameEndsAt:1200,status:"ENDED",frozenAt:t};
 assert.equal(lifecycle.frameClockTime(f,t+50000),t);
 assert.equal(lifecycle.frameClockTime(f,t+500000),t);
 assert.equal(lifecycle.frameClockTime({...f,frameEndsAt:900},t+500000),900000);
});
test("renderer guards old frame mutations, ignores superseded quotation responses and reports checkpoint failure accurately",()=>{
 const end=r.slice(r.indexOf("function finalizeEndedQuotedFrame("),r.indexOf("async function verifyQuotedFrameAfterDeadline("));
 const check=r.slice(r.indexOf("async function verifyQuotedFrameAfterDeadline("),r.indexOf("function currentQuoteProgress("));
 assert.match(end,/if\(sameFrame\)state\.lastProgramStatus="ENDED"/);
 assert.match(end,/if\(saved\)\{state\.playback\.quoteResumeCheckpoint=saved;savedPosition=true;\}/);
 assert.match(end,/新しい再生位置は記録できませんでした/);
 assert.match(check,/isConfirmedFrameEnd\(programId,state\.lastProgramId,state\.lastProgramStatus\)/);
 assert.match(check,/quotePlayback!==checkedPlayback\|\|state\.player\.quoteStartedAt!==checkedStartedAt/);
 assert.match(check,/status\.kind==="live"&&window\.KananeoFrameLifecycle\.sameFrame\(programId,state\.lastProgramId\)/);
});
