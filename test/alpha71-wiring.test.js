"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const renderer=fs.readFileSync(path.join(root,"src","renderer.js"),"utf8");

test("a quote started by the app keeps its time while video duration loads",()=>{
 assert.match(renderer,/const timingContext=\{/);
 assert.match(renderer,/trustedQuoteStart\(timingContext\)/);
 assert.match(renderer,/Number\(state\.player\.quoteDurationMs\)<=0/);
 assert.match(renderer,/開始時刻を保持し、動画の長さを取得しています/);
 assert.match(renderer,/void ensureCurrentQuoteDuration\(\)/);
});
test("metadata retries are bounded but manual fetch overrides the cooldown",()=>{
 assert.match(renderer,/quoteMetadataAttempt=\{key:"",at:0\}/);
 assert.match(renderer,/quoteMetadataPending\?\.key===key/);
 assert.match(renderer,/Date\.now\(\)-quoteMetadataAttempt\.at<60000/);
 assert.match(renderer,/ensureCurrentQuoteDuration\(\{force:true\}\)/);
});
test("a duration fetched for one program cannot inherit a start time from another",()=>{
 assert.match(renderer,/if\(!window\.KananeoQuoteTiming\.trustedQuoteStart\(\{/);
 assert.match(renderer,/state\.player\.quoteStartedAt=0/);
 assert.match(renderer,/quotePlayback\.programId!==programId\|\|quotePlayback\.videoId!==id/);
});
test("poll UI explains when the start time, not video duration, is missing",()=>{
 assert.match(renderer,/条件未確認・時間不足で省略/);
 assert.match(renderer,/引用再生を開始し直してください/);
 assert.match(renderer,/動画の長さだけでは開始時刻を推定できません/);
});
