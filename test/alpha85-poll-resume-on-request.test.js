"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm");
const fs=require("node:fs"),path=require("node:path");
const renderer=fs.readFileSync(path.join(__dirname,"..","src","renderer.js"),"utf8");
const autoPolicy=require("../src/auto-poll-policy");
const notices=require("../src/poll-notices");
function extract(from,to){
 const a=renderer.indexOf(from),b=renderer.indexOf(to,a+from.length);
 assert.ok(a>=0&&b>a,"function boundaries: "+from);
 return renderer.slice(a,b).trim();
}
function fixture(){
 const startedAt=1780000000000,programId="lv123",videoId="sm123";
 const key=autoPolicy.quotePollKey(programId,videoId,startedAt);
 const timers=[];
 const state={poll:{autoOnQuote:true,announceResults:true},requests:[],stocks:[],
  player:{quoteStartedAt:startedAt},logs:[]};
 const ctx={state,quotePlayback:{active:true,verified:true,programId,videoId},
  pollRuntime:{active:false,status:"skipped"},pollStartPending:false,
  pollRunToken:0,autoPollAttemptKey:key,autoPollWaitingForRequestKey:"",
  autoPollPendingTimer:null,
  window:{KananeoAutoPoll:autoPolicy,KananeoPollNotices:notices},
  setTimeout:(fn,ms)=>{const timer={fn,ms,canceled:false};timers.push(timer);return timer;},
  clearTimeout:timer=>{if(timer)timer.canceled=true;},save:()=>{},starts:0};
 ctx.startAutomaticPoll=()=>{ctx.starts++;};
 for(const [name,until] of [
  ["cancelPendingAutoPoll","function markAutoPollWaitingForRequests("],
  ["markAutoPollWaitingForRequests","function resumeAutoPollAfterRequestAccepted("],
  ["resumeAutoPollAfterRequestAccepted","function scheduleAutoPollOnQuote("],
  ["scheduleAutoPollOnQuote","function activePollMedia("]
 ]){
  const src=extract("function "+name+"(",until);
  ctx[name]=vm.runInNewContext("("+src+")",ctx);
 }
 function tick(){
  const item=timers.shift();
  assert.ok(item,"expected pending auto-poll callback");
  if(!item.canceled)item.fn();
  return item.ms;
 }
 return {ctx,state,timers,tick,key,startedAt,programId,videoId};
}
function queued(videoId){return {id:"req"+videoId,videoId,status:"queued"};}
test("after zero requests, an accepted request re-arms auto poll on the same video exactly once",()=>{
 const f=fixture(),{ctx,state}=f;
 assert.equal(ctx.markAutoPollWaitingForRequests(f.programId,f.videoId,f.startedAt),true);
 assert.equal(ctx.autoPollWaitingForRequestKey,f.key);
 assert.equal(ctx.autoPollAttemptKey,"","an empty queue does not use up the quote's one attempt");
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),false,"cannot resume with empty queue");
 state.requests.push(queued("sm456"));
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),true);
 assert.equal(ctx.autoPollWaitingForRequestKey,"");
 assert.equal(f.tick(),800);
 assert.equal(ctx.starts,1);
 assert.equal(ctx.autoPollAttemptKey,f.key);
 state.requests.push(queued("sm789"));
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),false);
 assert.equal(ctx.starts,1,"other accepted requests do not duplicate the poll");
 assert.equal(f.timers.length,0);
 assert.ok(state.logs.some(x=>x.includes("再開します")));
});
test("manual OFF and invalid or stopped quotation never automatically restart",()=>{
 const disabled=fixture();
 disabled.ctx.markAutoPollWaitingForRequests(disabled.programId,disabled.videoId,disabled.startedAt);
 disabled.state.poll.autoOnQuote=false;
 disabled.state.requests.push(queued("sm456"));
 assert.equal(disabled.ctx.resumeAutoPollAfterRequestAccepted(),false);
 assert.equal(disabled.timers.length,0);
 const stopped=fixture();
 stopped.ctx.markAutoPollWaitingForRequests(stopped.programId,stopped.videoId,stopped.startedAt);
 stopped.ctx.quotePlayback.active=false;
 stopped.state.requests.push(queued("sm456"));
 assert.equal(stopped.ctx.resumeAutoPollAfterRequestAccepted(),false);
 assert.equal(stopped.ctx.autoPollWaitingForRequestKey,"");
 const stale=fixture();
 stale.ctx.markAutoPollWaitingForRequests(stale.programId,stale.videoId,stale.startedAt);
 stale.ctx.quotePlayback.programId="lv999";
 stale.state.requests.push(queued("sm456"));
 assert.equal(stale.ctx.resumeAutoPollAfterRequestAccepted(),false);
 assert.equal(stale.timers.length,0);
});
test("while previous no-request notification is finishing, new request waits for cleanup then starts",()=>{
 const f=fixture(),{ctx,state}=f;
 ctx.markAutoPollWaitingForRequests(f.programId,f.videoId,f.startedAt);
 ctx.pollStartPending=true;
 state.requests.push(queued("sm456"));
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),true);
 assert.equal(f.tick(),800);
 assert.equal(ctx.starts,0,"do not overlap prior async poll cleanup");
 assert.equal(f.tick(),1000);
 assert.equal(ctx.starts,0);
 ctx.pollStartPending=false;
 assert.equal(f.tick(),1000);
 assert.equal(ctx.starts,1);
 assert.equal(ctx.autoPollAttemptKey,f.key);
});
test("manual OFF between request acceptance and timer firing cancels a queued restart",()=>{
 const f=fixture(),{ctx,state}=f;
 ctx.markAutoPollWaitingForRequests(f.programId,f.videoId,f.startedAt);
 state.requests.push(queued("sm456"));
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),true);
 state.poll.autoOnQuote=false;
 f.tick();
 assert.equal(ctx.starts,0);
});
test("different video after accepting a request cannot launch the previous video's poll",()=>{
 const f=fixture(),{ctx,state}=f;
 ctx.markAutoPollWaitingForRequests(f.programId,f.videoId,f.startedAt);
 state.requests.push(queued("sm456"));
 assert.equal(ctx.resumeAutoPollAfterRequestAccepted(),true);
 ctx.quotePlayback.videoId="sm999";
 f.tick();
 assert.equal(ctx.starts,0);
});
test("no-request branches mark the exact quote as restartable only when auto-poll is enabled",()=>{
 const initial=extract("async function startAutomaticPoll(","function currentFilteredComments(");
 assert.match(initial,/if\(state\.poll\.autoOnQuote\)markAutoPollWaitingForRequests\(programId,media\.videoId,media\.startedAt\)/);
 assert.match(initial,/if\(state\.poll\.autoOnQuote\)markAutoPollWaitingForRequests\(programId,pollVideoId,state\.player\.quoteStartedAt\)/);
 assert.match(initial,/if\(!window\.KananeoPollNotices\.hasPendingRequests\(state\.requests\)\)/);
 assert.match(initial,/const initial=timing\.mediaPlan\(/,"resumed poll still checks remaining video duration");
 assert.match(initial,/if\(!initial\.ok\)/);
 assert.match(renderer,/autoPollWaitingForRequestKey=""/);
 assert.match(renderer,/autoPollWaitingForRequestKey\?\"リクエスト待機中\"/);
});
test("both validated comment and manually accepted requests trigger resume; stocks and rejected comments do not",()=>{
 const comment=extract("async function maybeAddCommentRequest(","function receiveComment(");
 assert.match(comment,/if\(!policy\?\.accepted\)/);
 assert.match(comment,/state\.requests\.push\(item\);state\.logs\.unshift\("コメントから動画リクエスト/);
 assert.match(comment,/resumeAutoPollAfterRequestAccepted\(\)/);
 assert.ok(comment.indexOf("state.requests.push(item)")<comment.indexOf("resumeAutoPollAfterRequestAccepted()"));
 const manual=renderer.slice(renderer.indexOf('if(e.target.id==="request-form"){'),
  renderer.indexOf('if(e.target.id==="stock-form"){'));
 assert.match(manual,/if\(!validation\?\.ok\)/);
 assert.match(manual,/resumeAutoPollAfterRequestAccepted\(\)/);
 assert.ok(manual.indexOf("state.requests.push(item)")<manual.indexOf("resumeAutoPollAfterRequestAccepted()"));
 const stock=renderer.slice(renderer.indexOf('if(e.target.id==="stock-form"){'),
  renderer.indexOf('if(e.target.id==="library-add-form"){'));
 assert.doesNotMatch(stock,/resumeAutoPollAfterRequestAccepted/);
 const switchBlock=renderer.slice(renderer.indexOf('if(e.target.id==="poll-auto-on-quote"){'),
  renderer.indexOf('if(e.target.id==="request-auto-on-live"){'));
 assert.match(switchBlock,/autoPollWaitingForRequestKey=""/);
 assert.match(switchBlock,/cancelPendingAutoPoll\(\)/);
});
