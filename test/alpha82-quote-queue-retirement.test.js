"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const renderer=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"../src/index.html"),"utf8");
const {retireVerifiedQuote}=require("../src/quote-queue-retirement");
function extract(from,to){
 const begin=renderer.indexOf(from),end=renderer.indexOf(to,begin+from.length);
 assert.ok(begin>=0&&end>begin,"cannot extract "+from);
 return renderer.slice(begin,end).trim();
}
const playSource=extract("async function playQuotedQueueItem(", "async function stopQuotedPlayback(");
const refreshSource=extract("async function refreshQuotePlayback(","async function confirmStartedQuoteForQueue(");
const confirmSource=extract("async function confirmStartedQuoteForQueue(","async function playQuotedQueueItem(");
const previewSource=extract("async function playQueueItem(","async function playNextQueueItem(");
const currentSource=extract("function currentQueueItem(){","function clearQuoteAutoTimer(");
const activeSource=extract("function activeQuotedQueueItem(){","function storedQuoteDurationMs(");
function item(id,videoId="sm123"){return {id,videoId,url:"https://www.nicovideo.jp/watch/"+videoId,title:id,lengthMs:120000,status:"queued"};}

test("verified replay removes only one exact request and never removes failed or unconfirmed playback",()=>{
 const played=item("r1"),waiting=item("r2","sm456"),stock=item("s1");
 const state={requests:[played,waiting],stocks:[stock]};
 assert.equal(retireVerifiedQuote(state,"request",played,{ok:true,verified:false,currentVideoId:"sm123"}).removed,false);
 assert.equal(retireVerifiedQuote(state,"request",played,{ok:true,verified:true,currentVideoId:"sm456"}).removed,false);
 assert.equal(retireVerifiedQuote(state,"request",played,{ok:false,verified:true,currentVideoId:"sm123"}).removed,false);
 assert.equal(retireVerifiedQuote(state,"request",played,{ok:true,verified:true,currentVideoId:"sm123"}).removed,true);
 assert.deepEqual(state.requests.map(x=>x.id),["r2"]);
 assert.deepEqual(state.stocks.map(x=>x.id),["s1"]);
 assert.equal(retireVerifiedQuote(state,"request",played,{ok:true,verified:true,currentVideoId:"sm123"}).removed,false);
});
test("verified stock replay only removes the stock, not a same-ID request",()=>{
 const state={requests:[item("same")],stocks:[item("same")]};
 assert.equal(retireVerifiedQuote(state,"stock",state.stocks[0],{ok:true,verified:true,currentVideoId:"sm123"}).removed,true);
 assert.equal(state.stocks.length,0);assert.equal(state.requests.length,1);
});
function playbackContext(queueType="request",confirmed=true,accepted=true){
 const played=item(queueType==="request"?"req-played":"stock-played");
 const other=item("other","sm456"),extra=item("extra","sm789");
 const state={requests:queueType==="request"?[played,other]:[other],stocks:queueType==="stock"?[played,extra]:[extra],
  lastProgramId:"lv123",playback:{mainVolume:1,subVolume:0,nextIntervalSeconds:10},player:{},logs:[]};
 const events=[];
 const ctx={state,quotePlayback:{active:false,itemId:"",programId:"",videoId:""},commentConnection:{programId:""},
  window:{KananeoQuoteQueue:{retireVerifiedQuote},kananeoApp:{niconico:{
   validateVideo:async()=>({ok:true,videoId:played.videoId}),
   playQuotedVideo:async()=>accepted?
    {ok:true,verified:confirmed,videoId:played.videoId,currentVideoId:confirmed?played.videoId:"",message:"accepted"}:
    {ok:false,message:"failed"}
  }}},
  recordVideoPlaybackHistory:async(...args)=>events.push(["history",args[1],args[2]]),
  clearShortPollCompletion:()=>events.push(["short-quote-cleared"]),
  storedQuoteDurationMs:x=>x.lengthMs,scheduleQuoteAutoNext:()=>events.push(["quote-scheduled"]),
  scheduleAutoPollOnQuote:()=>events.push(["poll-scheduled"]),
  confirmStartedQuoteForQueue:()=>events.push(["retry"]),save:()=>events.push(["save"]),
  render:()=>events.push(["render"]),toast:()=>{},page:"requests",Date,confirm:()=>true};
 return {play:vm.runInNewContext("("+playSource+")",ctx),ctx,state,events,played};
}
test("confirmed broadcast start retires request but preserves current quote, poll schedule and playback history",async()=>{
 const c=playbackContext("request");
 assert.equal(await c.play(c.played,"request",true),true);
 assert.deepEqual(c.state.requests.map(x=>x.id),["other"]);
 assert.equal(c.ctx.quotePlayback.item.id,c.played.id);
 assert.equal(c.ctx.quotePlayback.itemId,c.played.id);
 assert.equal(c.ctx.state.player.quoteVideoId,"sm123");
 assert.ok(c.events.some(e=>e[0]==="history"&&e[1]==="request"&&e[2]==="quotation"));
 assert.ok(c.events.some(e=>e[0]==="poll-scheduled"));
 assert.ok(c.events.some(e=>e[0]==="quote-scheduled"));
});
test("confirmed stock quote retires stock only; failed and unverified starts preserve queue entries",async()=>{
 const stock=playbackContext("stock");
 assert.equal(await stock.play(stock.played,"stock",true),true);
 assert.deepEqual(stock.state.stocks.map(x=>x.id),["extra"]);
 assert.equal(stock.state.requests.length,1);
 assert.equal(stock.ctx.quotePlayback.queueType,"stock");
 const failed=playbackContext("request",true,false);
 assert.equal(await failed.play(failed.played,"request",true),false);
 assert.equal(failed.state.requests.length,2);
 assert.ok(!failed.events.some(e=>e[0]==="history"));
 const pending=playbackContext("request",false,true);
 assert.equal(await pending.play(pending.played,"request",true),true);
 assert.equal(pending.state.requests.length,2);
 assert.ok(pending.events.some(e=>e[0]==="retry"));
});
test("delayed verification removes the exact queued item; other live video cannot remove it",async()=>{
 for(const [observedVideo,shouldRemove] of [["sm123",true],["sm999",false]]){
  const c=playbackContext("request",false,true);
  await c.play(c.played,"request",true);
  c.ctx.window.kananeoApp.niconico.getCurrentQuotation=async()=>({ok:true,exists:true,currentVideoId:observedVideo});
  c.ctx.setTimeout=fn=>{fn();};c.ctx.page="requests";
  const verify=vm.runInNewContext("("+confirmSource+")",c.ctx);
  await verify("lv123","sm123",c.played.id);
  assert.equal(c.state.requests.length,shouldRemove?1:2);
  assert.equal(c.ctx.quotePlayback.verified,shouldRemove);
 }
});
test("refresh does not lose active playback metadata after pending queue removal",async()=>{
 for(const queueType of ["request","stock"]){
  const played=item("played");
  const ctx={shortPollCompletion:null,clearShortPollCompletion:()=>{},quotePlayback:{active:true,verified:true,programId:"lv123",videoId:"sm123",queueType,itemId:played.id,item:played},
   state:{requests:[],stocks:[],lastProgramId:"lv123",player:{currentId:played.id,currentQueueType:queueType,
    quoteProgramId:"lv123",quoteVideoId:"sm123",quoteStartedAt:1780000000000,quoteDurationMs:120000},
    logs:[],playback:{quoteAutoNext:false}},
   commentConnection:{programId:"lv123"},page:"player",pollRuntime:{active:true},
   window:{KananeoQuoteQueue:{retireVerifiedQuote},KananeoQuoteTiming:{trustedQuoteTiming:()=>true},
    kananeoApp:{niconico:{getCurrentQuotation:async()=>({ok:true,exists:true,currentVideoId:"sm123"})}}},
   clearQuoteAutoTimer:()=>{throw Error("same video must not clear auto-next");},
   scheduleQuoteAutoNext:()=>{},updateQuoteScheduleUi:()=>{},save:()=>{},render:()=>{},toast:()=>{}};
  ctx.currentQueueList=()=>queueType==="stock"?ctx.state.stocks:ctx.state.requests;
  const refresh=vm.runInNewContext("("+refreshSource+")",ctx);
  await refresh({silent:true});
  assert.equal(ctx.quotePlayback.item.id,played.id);
  assert.equal(ctx.quotePlayback.queueType,queueType);
  assert.equal(ctx.state.player.currentId,played.id);
  const getCurrent=vm.runInNewContext("("+currentSource+")",ctx);
  assert.equal(getCurrent().id,played.id);
  const getActive=vm.runInNewContext("("+activeSource+")",ctx);
  assert.equal(getActive().videoId,played.videoId);
 }
});
test("a preview never removes queue items; renderer loads helper before use",()=>{
 assert.doesNotMatch(previewSource,/retireVerifiedQuote/);
 assert.match(renderer,/「プレビュー」では一覧から削除しません/);
 assert.match(index,/<script src="quote-queue-retirement\.js"><\/script>/);
 assert.ok(index.indexOf("quote-queue-retirement.js")<index.indexOf("renderer.js"));
});
