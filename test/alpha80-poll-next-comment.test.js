"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const renderer=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
const {formatPollResultComment}=require("../src/poll-result-comment");
const autoPoll=require("../src/auto-poll-policy");
const index=fs.readFileSync(path.join(__dirname,"../src/index.html"),"utf8");

function extract(from,to){
 const first=renderer.indexOf(from),last=renderer.indexOf(to,first+from.length);
 assert.ok(first>=0&&last>first,"Source function boundaries "+from);
 return renderer.slice(first,last).trim();
}
const scheduleSource=extract("function scheduleAutoPollOnQuote(", "function activePollMedia(");
const broadcasterSource=extract("function postAutomatedBroadcasterComment(", "async function processRequestReplyQueue()");

test("verified vote results are formatted as broadcaster comments within 80 characters",()=>{
 const result=formatPollResultComment({
  round:2,choices:["もう一度","次の動画へ"],
  items:[{name:"もう一度",rate:55.6},{name:"次の動画へ",rate:44.4}],
  decision:"repeat"
 });
 assert.equal(result.ok,true);
 assert.match(result.text,/【投票結果2回】/);
 assert.match(result.text,/55\.6%/);
 assert.match(result.text,/44\.4%/);
 assert.match(result.text,/再投票/);
 assert.ok(Array.from(result.text).length<=80);
 const next=formatPollResultComment({
  round:1,choices:["続ける","次へ"],
  items:[{name:"続ける",rate:20},{name:"次へ",rate:80}],decision:"next"
 });
 assert.equal(next.ok,true);
 assert.match(next.text,/次動画へ/);
});
test("no broadcaster comment is produced for unverified or malformed result",()=>{
 const input={round:1,choices:["継続","次へ"],decision:"next"};
 assert.equal(formatPollResultComment({...input,items:[{name:"違う動画",rate:100}]}).ok,false);
 assert.equal(formatPollResultComment({...input,items:[{name:"継続",rate:NaN},{name:"次へ",rate:1}]}).ok,false);
 assert.equal(formatPollResultComment({...input,items:[{name:"継続",rate:10},{name:"次へ",rate:120}]}).ok,false);
 assert.equal(formatPollResultComment({...input,items:[{name:"継続",rate:50},{name:"継続",rate:50},{name:"次へ",rate:50}]}).ok,false);
 assert.equal(formatPollResultComment({...input,items:[{name:"継続",rate:50},{name:"次へ",rate:50}],decision:"invalid"}).ok,false);
});
test("long custom choices remain within the Nico broadcaster length limit",()=>{
 const long="い".repeat(70);
 const result=formatPollResultComment({round:100,choices:[long,long+"次"],
  items:[{name:long,rate:0},{name:long+"次",rate:100}],decision:"next"});
 assert.equal(result.ok,false,"Ambiguous truncation must not create misleading labels");
});
function mockScheduleContext(){
 const scheduled=[];
 const state={poll:{autoOnQuote:true},player:{quoteStartedAt:1780000000000},logs:[]};
 const ctx={
  state,quotePlayback:{active:true,programId:"lv123",videoId:"sm123"},
  pollRuntime:{active:false,status:"next"},pollStartPending:true,
  autoPollAttemptKey:"lv123:sm111:1779999999000",autoPollPendingTimer:null,
  window:{KananeoAutoPoll:autoPoll},save:()=>{},
  scheduled,starts:0,
  setTimeout:(fn,ms)=>{const task={fn,ms,cancelled:false};scheduled.push(task);return task;},
  clearTimeout:task=>{if(task)task.cancelled=true;}
 };
 ctx.cancelPendingAutoPoll=()=>{if(ctx.autoPollPendingTimer)ctx.clearTimeout(ctx.autoPollPendingTimer);ctx.autoPollPendingTimer=null;};
 ctx.startAutomaticPoll=()=>{ctx.starts++;};
 const schedule=vm.runInNewContext("("+scheduleSource+")",ctx);
 function tick(){const task=scheduled.shift();assert.ok(task,"Expected scheduled callback");if(!task.cancelled)task.fn();}
 return {schedule,ctx,tick};
}
test("next video's auto poll waits for prior poll cleanup instead of consuming its attempt",()=>{
 const {schedule,ctx,tick}=mockScheduleContext();
 schedule("lv123","sm123",ctx.state.player.quoteStartedAt);
 assert.equal(ctx.autoPollAttemptKey,"lv123:sm111:1779999999000");
 tick();
 assert.equal(ctx.starts,0);
 assert.ok(ctx.autoPollPendingTimer,"handoff is rescheduled");
 assert.equal(ctx.autoPollAttemptKey,"lv123:sm111:1779999999000");
 ctx.pollStartPending=false;
 tick();
 assert.equal(ctx.starts,1);
 assert.equal(ctx.autoPollAttemptKey,"lv123:sm123:1780000000000");
 assert.equal(ctx.autoPollPendingTimer,null);
});
test("auto poll cannot start on a stale video or after the persistent switch is OFF",()=>{
 const {schedule,ctx,tick}=mockScheduleContext();
 schedule("lv123","sm123",ctx.state.player.quoteStartedAt);
 ctx.quotePlayback.videoId="sm456";
 ctx.pollStartPending=false;
 tick();
 assert.equal(ctx.starts,0);
 const second=mockScheduleContext();
 second.schedule("lv123","sm123",second.ctx.state.player.quoteStartedAt);
 second.ctx.state.poll.autoOnQuote=false;
 second.tick();
 assert.equal(second.ctx.starts,0);
});
test("request replies and poll notices are serialized and recheck permission before sending",async()=>{
 let now=10000;
 const sent=[];
 const ctx={
  automatedBroadcasterCommentTail:Promise.resolve(),lastRequestReplySentAt:0,
  Date:{now:()=>now},setTimeout:(fn,ms)=>{now+=ms;fn();},
  window:{kananeoApp:{niconico:{postBroadcasterComment:async input=>{
   sent.push({...input,at:now});return {ok:true};
  }}}}
 };
 const post=vm.runInNewContext("("+broadcasterSource+")",ctx);
 const results=await Promise.all([
  post("lv123","投票結果1",()=>true),
  post("lv123","リクエスト受付",()=>true)
 ]);
 assert.ok(results.every(x=>x.ok));
 assert.deepEqual(sent.map(x=>x.text),["投票結果1","リクエスト受付"]);
 assert.ok(sent[1].at-sent[0].at>=5000);
 const canceled=await post("lv123","他の放送",()=>false);
 assert.equal(canceled.code,"COMMENT_CANCELLED");
 assert.equal(sent.length,2);
});
test("poll result notice is opt-in configurable and safe over the exact broadcast/video",()=>{
 assert.match(renderer,/announceResults:true/);
 assert.match(renderer,/id="poll-announce-results"/);
 assert.match(renderer,/state\.poll\.announceResults=e\.target\.checked===true/);
 assert.match(renderer,/if\(state\.poll\.announceResults!==false&&safePollVideoMatches\(\)\)/);
 assert.match(renderer,/formatPollResultComment\(\{/);
 assert.match(renderer,/postAutomatedBroadcasterComment\(programId,notice\.text/);
 assert.match(renderer,/token===pollRunToken&&pollRuntime\.active&&safePollVideoMatches\(\)/);
 assert.match(renderer,/const result=await postAutomatedBroadcasterComment\(item\.programId,item\.text/);
 assert.match(index,/<script src="poll-result-comment\.js"><\/script>/);
 assert.ok(index.indexOf("poll-result-comment.js")<index.indexOf("renderer.js"));
});
test("auto next remains associated with the original program and keeps poll setting enabled",()=>{
 assert.match(renderer,/const advanced=await playNextQuoteItem\(\{skipConfirmation:true,triggeredByAuto:true,programId\}\)/);
 const stop=extract('if(b.hasAttribute("data-poll-stop")){','if(b.hasAttribute("data-comment-start")){');
 assert.doesNotMatch(stop,/autoOnQuote=false/);
 assert.match(stop,/stopAutomaticPoll\(\)/);
 const next=extract('if(decision.decision==="next"){','const plan=timing.repeatPlan(');
 assert.doesNotMatch(next,/autoOnQuote=false/);
 assert.match(next,/playNextQuoteItem\(\{skipConfirmation:true,triggeredByAuto:true,programId\}\)/);
});
