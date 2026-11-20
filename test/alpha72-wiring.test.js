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
test("quote start schedules poll after prior cleanup; manual stop cancels only this round",()=>{
 assert.match(ui,/scheduleAutoPollOnQuote\(programId,validation\.videoId,startedAt\)/);
 assert.match(ui,/const key=window\.KananeoAutoPoll\.quotePollKey/);
 assert.match(ui,/autoPollAttemptKey=key/);
 assert.match(ui,/if\(!state\.poll\.autoOnQuote\|\|!quotePlayback\.active\|\|autoPollAttemptKey===key\)return/);
 assert.match(ui,/const busy=pollRuntime\.active\|\|pollStartPending/);
 assert.match(ui,/autoPollPendingTimer=setTimeout\(tryStart,1000\)/);
 assert.match(ui,/void startAutomaticPoll\(\)/);
 const stop=ui.slice(ui.indexOf('if(b.hasAttribute("data-poll-stop")){'),ui.indexOf('if(b.hasAttribute("data-comment-start")){'));
 assert.match(stop,/cancelPendingAutoPoll\(\)/);
 assert.match(stop,/stopAutomaticPoll\(\)/);
 assert.doesNotMatch(stop,/autoOnQuote=false/);
 assert.match(ui,/if\(!state\.poll\.autoOnQuote\)\{/);
 assert.match(ui,/autoPollWaitingForRequestKey=""/);
 assert.match(ui,/cancelPendingAutoPoll\(\)/);
});
test("script loads before renderer without shared-scope collisions",()=>{
 assert.ok(html.indexOf('src="auto-poll-policy.js"')<html.indexOf('src="renderer.js"'));
 assert.ok(html.includes('src="auto-poll-policy.js"'));
});
