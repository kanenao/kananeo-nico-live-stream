"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const renderer=fs.readFileSync(path.resolve(__dirname,"../src/renderer.js"),"utf8");
test("saving poll settings keeps opt-in autoOnQuote instead of silently disabling it",()=>{
 const section=renderer.slice(renderer.indexOf("function savePollSettings(){"),renderer.indexOf("function setPollRuntime("));
 assert.match(section,/state\.poll=\{\.\.\.state\.poll,question,wait,result/);
 assert.doesNotMatch(section,/state\.poll=\{question,wait,result/);
});
test("auto playback uses the verified current broadcast end, never the old cached end",()=>{
 const section=renderer.slice(renderer.indexOf("async function maybeAutoPlayOnOwnLive("),renderer.indexOf("function applyOwnMonitorStatus("));
 const endIdx=section.indexOf("state.lastProgramEndAt=Number.isFinite(endTime)");
 const selectedIdx=section.indexOf("const selected=await window.kananeoApp.niconico.selectPlaybackCandidate(");
 const markIdx=section.indexOf("state.playback.lastAutoPlayProgramId=id");
 assert.ok(endIdx>=0&&selectedIdx>endIdx&&markIdx>selectedIdx);
 assert.match(section,/if\(!selected\)\{/);
 assert.match(section,/if\(quotePlayback\.active&&quotePlayback\.programId===id\)/);
 assert.match(section,/getCurrentQuotation\(\{programId:id\}\)/);
 assert.match(section,/setAutoLiveQuoteMessage/);
});
test("automatic polls verify current video after quote start and retain valid timestamps",()=>{
 const section=renderer.slice(renderer.indexOf("async function startAutomaticPoll("),renderer.indexOf("async function stopAutomaticPoll("));
 assert.match(section,/for\(let attempt=0;attempt<3;attempt\+\+\)/);
 assert.match(section,/String\(observed\.currentVideoId\|\|""\)\.toLowerCase\(\)===expectedVideoId/);
 assert.match(section,/再生開始時刻は保持します/);
 assert.match(renderer,/const trusted=window\.KananeoQuoteTiming\.trustedQuoteStart\(\{/);
 assert.match(renderer,/durationMs:storedQuoteDurationMs\(activeQuotedQueueItem\(\)\)/);
});
