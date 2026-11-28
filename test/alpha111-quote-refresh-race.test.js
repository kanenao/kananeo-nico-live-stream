"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const r=fs.readFileSync(path.join(__dirname,"../src/renderer.js"),"utf8");
const source=r.slice(r.indexOf("async function refreshQuotePlayback("),r.indexOf("async function confirmStartedQuoteForQueue("));
function fixture(){
 const pending=[];
 const playback={active:true,programId:"lv123",videoId:"sm100",itemId:"first"};
 const c=vm.createContext({quoteRefreshGeneration:0,quotePlayback:playback,state:{lastProgramId:"lv123",player:{quoteStartedAt:1000}},page:"dashboard",toast:()=>{},window:{kananeoApp:{niconico:{getCurrentQuotation:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))}}}});
 vm.runInContext(source,c);
 return {c,pending,playback,refresh:()=>c.refreshQuotePlayback({silent:true})};
}
test("old quotation read cannot overwrite a new frame",async()=>{
 const f=fixture(),p=f.refresh();
 f.c.state.lastProgramId="lv456";
 f.pending[0].resolve({ok:true,exists:false});
 assert.equal((await p).code,"STALE_QUOTE_REFRESH");
 assert.equal(f.c.quotePlayback,f.playback);
});
test("latest read wins even if older response arrives first",async()=>{
 const f=fixture(),a=f.refresh(),b=f.refresh();
 f.pending[0].resolve({ok:true,exists:false});
 assert.equal((await a).code,"STALE_QUOTE_REFRESH");
 assert.equal(f.c.quotePlayback,f.playback);
 f.pending[1].resolve({ok:false,message:"通信エラー"});
 assert.equal((await b).ok,false);
 assert.equal(f.c.quotePlayback.message,"通信エラー");
});
test("new playback or mutation generation invalidates old reads",async()=>{
 for(const change of [c=>{c.quotePlayback={...c.quotePlayback,videoId:"sm200"}},c=>{c.state.player.quoteStartedAt=2000},c=>{c.quoteRefreshGeneration++}]){
  const f=fixture(),p=f.refresh();change(f.c);
  const expected=f.c.quotePlayback;
  f.pending[0].resolve({ok:true,exists:false});
  assert.equal((await p).code,"STALE_QUOTE_REFRESH");
  assert.equal(f.c.quotePlayback,expected);
 }
});
test("read rejection is reported instead of throwing",async()=>{
 const f=fixture(),p=f.refresh();f.pending[0].reject(Error("network"));
 assert.equal((await p).ok,false);
 assert.match(f.c.quotePlayback.message,/通信に失敗/);
});
test("manual play and stop invalidate already pending reads",()=>{
 const play=r.slice(r.indexOf("async function playQuotedQueueItem("),r.indexOf("async function stopQuotedPlayback("));
 const stop=r.slice(r.indexOf("async function stopQuotedPlayback("),r.indexOf("async function playNextQuoteItem("));
 assert.match(play,/quoteRefreshGeneration\+\+;[\s\S]*?validateVideo/);
 assert.match(stop,/quoteRefreshGeneration\+\+;[\s\S]*?getCurrentQuotation/);
});
