"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const renderer=read("src/renderer.js"),html=read("src/index.html");
const completion=require("../src/quote-completion-fallback");
function environment({changed=false,announcements=true,apiError=false,autoPoll=true}={}){
 const start=Date.now()-30000;
 const calls={comment:[],played:[],timeouts:[],toast:[],status:[]};
 const state={poll:{autoOnQuote:autoPoll,announceResults:announcements},
  playback:{quoteAutoNext:false,playStyle:1,stockAutoPlay:false},
  player:{quoteProgramId:"lv123",quoteVideoId:"sm123",quoteStartedAt:start,quotePollAutoSuspended:false},
  requests:[{id:"request-2",videoId:"sm999",status:"queued"}],stocks:[],logs:[]};
 const quotePlayback={active:true,verified:true,programId:"lv123",videoId:"sm123",queueType:"request",itemId:"request-1"};
 const sandbox={window:{KananeoQuoteCompletion:completion,KananeoPollNotices:{hasPendingRequests:q=>q.some(x=>x.status==="queued")},
  kananeoApp:{niconico:{getCurrentQuotation:async()=>apiError?{ok:false,code:"NETWORK_ERROR"}:
   {ok:true,exists:true,currentVideoId:changed?"sm999":"sm123"}}}},
  state,quotePlayback,pollRuntime:{active:false},pollStartPending:false,quoteAutoBusy:false,
  quoteAutoMessage:"",shortPollCompletion:null,shortPollCompletionToken:0,shortPollCompletionTimer:null,
  activePollMedia:()=>({startedAt:start,durationMs:20000}),
  clearQuoteAutoTimer:()=>{},updateQuoteScheduleUi:()=>{},save:()=>{},
  setPollRuntime:(...x)=>calls.status.push(x),toast:x=>calls.toast.push(x),
  postAutomatedBroadcasterComment:async(_id,msg,guard)=>{if(!guard())return{ok:false,code:"COMMENT_CANCELLED"};calls.comment.push(msg);return{ok:true};},
  playNextQuoteItem:async opts=>{calls.played.push(opts);return true;},
  setTimeout:(callback,delay)=>{calls.timeouts.push({callback,delay});return calls.timeouts.length;},
  clearTimeout:()=>{},
  console
 };
 const first=renderer.indexOf("function clearShortPollCompletion(){");
 const last=renderer.indexOf("async function getNextQueueItem(){",first);
 assert.ok(first>=0&&last>first);
 const context=vm.createContext(sandbox);
 vm.runInContext(renderer.slice(first,last),context);
 return {context,state,calls,arm:()=>vm.runInContext('armShortPollCompletion("尺不足")',context),
  fire:()=>vm.runInContext("handleShortPollCompletion(shortPollCompletionToken)",context)};
}
test("short poll arms a natural finish despite separate auto-next switch OFF",async()=>{
 const env=environment();
 assert.equal(env.state.playback.quoteAutoNext,false);
 assert.equal(env.arm(),true);
 assert.equal(env.calls.timeouts.length,1);
 assert.equal(env.calls.timeouts[0].delay,0);
 await env.fire();
 assert.equal(env.calls.comment.length,1);
 assert.match(env.calls.comment[0],/【完走】/);
 assert.equal(env.calls.played.length,1);
 assert.equal(env.calls.played[0].shortPollCompletion,true);
 assert.equal(env.calls.played[0].triggeredByAuto,true);
 assert.equal(env.state.playback.quoteAutoNext,false);
 assert.ok(env.calls.status.some(x=>x[0]==="next"));
});
test("different quotation never receives a completion comment or forced skip",async()=>{
 const env=environment({changed:true});
 assert.equal(env.arm(),true);
 await env.fire();
 assert.equal(env.calls.comment.length,0);
 assert.equal(env.calls.played.length,0);
});
test("turning off automatic poll blocks any queued short-quote callback",async()=>{
 const env=environment();
 assert.equal(env.arm(),true);
 env.state.poll.autoOnQuote=false;
 await env.fire();
 assert.equal(env.calls.comment.length,0);
 assert.equal(env.calls.played.length,0);
});
test("missing current-quotation API result retries instead of guessing a completion",async()=>{
 const env=environment({apiError:true});
 assert.equal(env.arm(),true);
 await env.fire();
 assert.equal(env.calls.comment.length,0);
 assert.equal(env.calls.played.length,0);
 assert.equal(env.calls.timeouts.length,2);
});
test("operator-announcement OFF still continues the video and respects comment preference",async()=>{
 const env=environment({announcements:false});
 assert.equal(env.arm(),true);await env.fire();
 assert.equal(env.calls.comment.length,0);
 assert.equal(env.calls.played.length,1);
});
test("short, repeat and deadline skip branches arm the verified completion",()=>{
 assert.ok(html.indexOf('src="quote-completion-fallback.js"')>0);
 assert.ok(html.indexOf('src="quote-completion-fallback.js"')<html.indexOf('src="renderer.js"'));
 assert.match(renderer,/if\(initial.code==="INSUFFICIENT_VIDEO_DURATION"\)\s*armShortPollCompletion/);
 assert.match(renderer,/finishShortAfterPoll=budget.code==="INSUFFICIENT_VIDEO_DURATION"/);
 assert.match(renderer,/finishShortAfterPoll=plan.code==="INSUFFICIENT_VIDEO_DURATION"/);
 assert.match(renderer,/if\(finishShortAfterPoll&&safePollVideoMatches\(\)\)/);
 assert.match(renderer,/armShortPollCompletion\("動画終了が近いためアンケートを安全終了しました。"/);
 assert.match(renderer,/playStyle:options.shortPollCompletion&&state.playback.playStyle===0\?1:/);
 assert.match(renderer,/clearShortPollCompletion\(\);\s*state.player.endedFor=""/);
});
