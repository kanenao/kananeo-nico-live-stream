"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const notices=require("../src/poll-notices");
const timing=require("../src/poll-timing");
const renderer=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"../src/index.html"),"utf8");
function extract(from,to){
 const begin=renderer.indexOf(from),end=renderer.indexOf(to,begin+from.length);
 assert.ok(begin>=0&&end>begin,"Function boundaries not found: "+from);
 return renderer.slice(begin,end).trim();
}
test("no upcoming requests skips voting, including when stocks remain",()=>{
 assert.equal(notices.hasPendingRequests([]),false);
 assert.equal(notices.hasPendingRequests([{status:"playing"},{status:"completed"},{status:"skipped"},{status:"rejected"}]),false);
 assert.equal(notices.hasPendingRequests([{status:"queued",noLivePlay:true}]),false);
 assert.equal(notices.hasPendingRequests([{status:"queued",playable:false}]),false);
 assert.equal(notices.hasPendingRequests([{id:"r1",status:"queued"}]),true);
 assert.equal(notices.hasPendingRequests([{id:"r1"}]),true);
});
test("re-poll notice precisely uses computed wait of majority/tie/zero votes",()=>{
 for(const [keep,next,expected] of [[70,30,30],[100,0,60],[50,50,10],[0,0,5]]){
  const delay=timing.repeatDelaySeconds({decision:"repeat",continueRate:keep,nextRate:next});
  assert.equal(delay,expected);
  const notice=notices.formatRepeatCountdownComment({round:1,delaySeconds:delay});
  assert.equal(notice.ok,true);
  assert.match(notice.text,new RegExp(expected+"秒後"));
  assert.match(notice.text,/2回目の投票/);
  assert.ok(Array.from(notice.text).length<=80);
 }
 assert.equal(notices.formatRepeatCountdownComment({round:1,delaySeconds:NaN}).ok,false);
 assert.equal(notices.formatRepeatCountdownComment({round:100,delaySeconds:5}).ok,false);
 assert.equal(notices.formatRepeatCountdownComment({round:1,delaySeconds:-1}).ok,false);
 const empty=notices.formatNoRequestsComment();
 assert.equal(empty.ok,true);
 assert.match(empty.text,/アンケートは省略/);
 assert.match(empty.text,/リクエスト/);
 assert.ok(Array.from(empty.text).length<=80);
});
test("renderer starts no poll when the next request is empty, and broadcasts the skip",async()=>{
 const noticesLogged=[],messages=[];
 const state={poll:{question:"継続しますか",continue:"続ける",next:"次の動画へ",
   wait:15,result:10,announceResults:true},requests:[],stocks:[{id:"stock",status:"queued"}],player:{},logs:[]};
 const ctx={
  state,pollRuntime:{active:false,status:"idle"},pollStartPending:false,pollRunToken:0,
  pollEnqueteOpen:false,quotePlayback:{active:true,verified:true,programId:"lv123",videoId:"sm123"},
  commentConnection:{programId:"lv123"},pollTimingSummary:"",
  quoteMetadataMessage:"",window:{KananeoPollNotices:notices,KananeoQuoteTiming:{trustedQuoteStart:()=>false}},
  savePollSettings:()=>{},refreshQuotePlayback:async()=>({ok:true}),
  activePollMedia:()=>({videoId:"sm123",startedAt:1000,durationMs:180000,now:1000}),
  storedQuoteDurationMs:()=>180000,
  activeQuotedQueueItem:()=>({videoId:"sm123",lengthMs:180000}),
  setPollRuntime:(status,message)=>{noticesLogged.push({status,message});},
  toast:()=>{},save:()=>{},
  postAutomatedBroadcasterComment:async(programId,text,canSend)=>{
    if(canSend())messages.push({programId,text});return {ok:true};
  },
  confirm:()=>true
 };
 const notify=vm.runInNewContext("("+extract("async function announceNoPendingRequests(","async function startAutomaticPoll(")+")",ctx);
 ctx.announceNoPendingRequests=notify;
 const start=vm.runInNewContext("("+extract("async function startAutomaticPoll(","function currentFilteredComments(")+")",ctx);
 await start();
 assert.equal(messages.length,1);
 assert.equal(messages[0].programId,"lv123");
 assert.match(messages[0].text,/リクエスト/);
 assert.ok(noticesLogged.some(x=>x.status==="skipped"));
 assert.equal(ctx.pollStartPending,false);
 assert.equal(ctx.pollRunToken,0);
 assert.equal(state.requests.length,0);
 assert.equal(state.stocks.length,1);
});
test("no-request notice respects the existing comment switch and cancels if the live changes",async()=>{
 const sent=[];
 const ctx={state:{poll:{announceResults:false},logs:[]},window:{KananeoPollNotices:notices},
  postAutomatedBroadcasterComment:async(_id,_text,canSend)=>{
   if(canSend())sent.push(_text);return {ok:true};
  },save:()=>{}};
 const notify=vm.runInNewContext("("+extract("async function announceNoPendingRequests(","async function startAutomaticPoll(")+")",ctx);
 await notify("lv123",()=>true);
 assert.equal(sent.length,0);
 ctx.state.poll.announceResults=true;
 await notify("lv123",()=>false);
 assert.equal(sent.length,0);
 await notify("lv123",()=>true);
 assert.equal(sent.length,1);
});
test("repeat announcement is posted after a valid repeat plan and before the actual wait",()=>{
 const begin=renderer.indexOf('const plan=timing.repeatPlan(');
 const end=renderer.indexOf('const retryWait=await waitForPoll(plan.delaySeconds*1000,token);',begin);
 assert.ok(begin>0&&end>begin);
 const block=renderer.slice(begin,end);
 assert.match(block,/if\(!plan\.ok\)/);
 assert.match(block,/formatRepeatCountdownComment\(\{/);
 assert.match(block,/delaySeconds:plan\.delaySeconds/);
 assert.match(block,/postAutomatedBroadcasterComment\(programId,notice\.text/);
 assert.match(block,/token===pollRunToken&&pollRuntime\.active&&safePollVideoMatches/);
 assert.ok(block.indexOf('if(!plan.ok)')<block.indexOf("formatRepeatCountdownComment"));
 assert.ok(block.indexOf("formatRepeatCountdownComment")>=0);
 assert.match(renderer,/await announceNoPendingRequests\(programId/);
 assert.match(renderer,/!window\.KananeoPollNotices\.hasPendingRequests\(state\.requests\)/);
 assert.match(renderer,/state\.poll\.announceResults!==false/);
 assert.match(renderer,/次の未再生リクエストがないためアンケートを省略/);
 assert.match(index,/<script src="poll-notices\.js"><\/script>/);
 assert.ok(index.indexOf('poll-notices.js')<index.indexOf('renderer.js'));
});
