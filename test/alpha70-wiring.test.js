"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const renderer=read("src/renderer.js"),index=read("src/index.html");
test("renderer loads quote safety before it is used for live/poll timing",()=>{
 const timing=index.indexOf('<script src="quote-timing-safety.js"></script>');
 const rendererPos=index.indexOf('<script src="renderer.js"></script>');
 assert.ok(timing>0&&rendererPos>timing);
 assert.match(renderer,/window\.KananeoQuoteTiming\.findQuotedItem/);
 assert.match(renderer,/window\.KananeoQuoteTiming\.trustedQuoteTiming/);
});
test("no metadata from an unrelated queued video is used for the active poll",()=>{
 assert.match(renderer,/storedQuoteDurationMs\(activeQuotedQueueItem\(\)\)/);
 assert.doesNotMatch(renderer,/storedQuoteDurationMs\(currentQueueItem\(\)\)/);
 assert.match(renderer,/quotePlayback\.videoId!==id/);
});
test("quote refresh discards untrusted or expired timestamps, and startup clears old timing",()=>{
 assert.match(renderer,/loaded\.player\.quoteStartedAt=0/);
 assert.match(renderer,/loaded\.player\.quoteDurationMs=0/);
 assert.match(renderer,/state\.player\.quoteVideoId=result\.currentVideoId\|\|""/);
 assert.match(renderer,/const trusted=window\.KananeoQuoteTiming\.trustedQuoteTiming/);
 assert.match(renderer,/引用再生中ですが正確な再生開始時刻を確認できません/);
});
test("poll checks the live quote before starting and reports metadata API failures",()=>{
 assert.match(renderer,/const currentQuote=await refreshQuotePlayback\(\{silent:true\}\)/);
 assert.match(renderer,/quoteMetadataMessage/);
 assert.match(renderer,/UNKNOWN_VIDEO_DURATION/);
});
test("live auto-play does not re-arm the same broadcast when toggle is switched",()=>{
 assert.match(renderer,/lastAutoPlayProgramId===id/);
 assert.doesNotMatch(renderer,/if\(enabled\)state\.playback\.lastAutoPlayProgramId=""/);
});
