"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const ui=read("src/renderer.js"),html=read("src/index.html");
test("new automatic poll setting starts OFF, persists and is visible in the poll UI",()=>{
 assert.match(ui,/poll:\{[^\n]+autoOnQuote:false/);
 assert.match(ui,/loaded\.poll=\{\.\.\.initial\.poll,\.\.\.\(stored\.poll\|\|\{\}\)\}/);
 assert.match(ui,/id="poll-auto-on-quote"/);
 assert.match(ui,/state\.poll\.autoOnQuote=e\.target\.checked===true/);
 assert.match(ui,/引用再生するたびに、視聴者向けアンケートを自動で開始します/);
});
test("quote start alone schedules poll; toggling off or manual stop cancels pending requests",()=>{
 assert.match(ui,/scheduleAutoPollOnQuote\(programId,validation\.videoId,startedAt\)/);
 assert.match(ui,/const key=window\.KananeoAutoPoll\.quotePollKey/);
 assert.match(ui,/autoPollAttemptKey=key/);
 assert.match(ui,/if\(!state\.poll\.autoOnQuote\|\|!quotePlayback\.active\|\|pollRuntime\.active\)return/);
 assert.match(ui,/void startAutomaticPoll\(\)/);
 assert.match(ui,/state\.poll\.autoOnQuote=false;save\(\);cancelPendingAutoPoll\(\)/);
 assert.match(ui,/if\(!state\.poll\.autoOnQuote\)cancelPendingAutoPoll\(\)/);
});
test("script loads before renderer without shared-scope collisions",()=>{
 assert.ok(html.indexOf('src="auto-poll-policy.js"')<html.indexOf('src="renderer.js"'));
 assert.ok(html.includes('src="auto-poll-policy.js"'));
});
