"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ui=require("../src/broadcast-quick-tools");
const renderer=fs.readFileSync(path.resolve(__dirname,"../src/renderer.js"),"utf8");
const html=fs.readFileSync(path.resolve(__dirname,"../src/index.html"),"utf8");

test("broadcast management includes quick poll, quote clock, request and library panels",()=>{
 const markup=ui.render({requests:[{id:"r1",videoId:"sm123",title:"テスト動画",status:"queued"}],
  library:[{videoId:"sm456",title:"保存動画"}],pollEnabled:true});
 assert.match(markup,/自動アンケート/);
 assert.match(markup,/ニコ生への引用再生時間/);
 assert.match(markup,/動画リクエスト・ライブラリ/);
 assert.match(markup,/id="poll-auto-on-quote" checked/);
 assert.match(markup,/id="broadcast-quote-progress"/);
 assert.match(markup,/data-quote-refresh/);
 assert.match(markup,/data-quote-request="r1"/);
 assert.match(markup,/data-library-play="sm456"/);
 assert.match(markup,/data-broadcast-library-request="sm456"/);
 assert.match(markup,/id="request-form"/);
 assert.match(markup,/id="req-url"/);
});
test("poll actions follow actual activity and wait-for-request state",()=>{
 let html=ui.render({pollStatus:"voting",pollActive:true});
 assert.match(html,/投票中/);
 assert.match(html,/data-poll-start disabled/);
 assert.match(html,/data-poll-stop /);
 assert.doesNotMatch(html,/data-poll-stop disabled/);
 html=ui.render({pollStatus:"skipped",waitingForRequests:true,pollActive:false});
 assert.match(html,/リクエスト待機中/);
 assert.match(html,/data-poll-stop disabled/);
});
test("quote time is shown only for confirmed trustworthy playback progress",()=>{
 const base={active:true,verified:true,videoId:"sm1234"};
 const unknown=ui.quoteClock({...base,progress:{ok:false}});
 assert.equal(unknown.time,"— / —");
 assert.match(unknown.hint,/推測した再生時間は表示しません/);
 const notVerified=ui.quoteClock({...base,verified:false,progress:{ok:true,elapsedMs:1000,durationMs:10000,remainingMs:9000,percent:10}});
 assert.equal(notVerified.time,"— / —");
 const trusted=ui.quoteClock({...base,progress:{ok:true,elapsedMs:65000,durationMs:200000,remainingMs:135000,percent:32.5}});
 assert.equal(trusted.time,"1:05 / 3:20");
 assert.equal(trusted.remaining,"2:15");
 assert.equal(trusted.percent,32.5);
 assert.match(trusted.hint,/推定値/);
 const weird=ui.quoteClock({...base,progress:{ok:true,elapsedMs:NaN,durationMs:200000,remainingMs:NaN,percent:30}});
 assert.equal(weird.time,"— / —");
});
test("queue preview excludes completed videos and never starts a quote as side effect",()=>{
 const items=[{id:"r1",status:"completed",videoId:"sm1",title:"再生済み"},
  {id:"r2",status:"queued",videoId:"sm2",title:"未再生"},
  {id:"r3",status:"playing",videoId:"sm3",title:"現在再生中"}];
 assert.equal(ui.pendingRequests(items).length,1);
 const markup=ui.requestPreview(items);
 assert.match(markup,/未再生/);
 assert.doesNotMatch(markup,/data-quote-request="r1"/);
 assert.doesNotMatch(markup,/data-quote-request="r3"/);
 assert.match(markup,/data-quote-request="r2"/);
});
test("library to queue requires validation, limits duplicates and does not trigger quotation",()=>{
 const item={videoId:"sm1234",title:"ライブラリから",lengthMs:300000};
 const verification={ok:true,videoId:"sm1234",url:"https://www.nicovideo.jp/watch/sm1234"};
 const good=ui.prepareLibraryRequest(item,verification,[],[],"req-unique");
 assert.equal(good.ok,true);
 assert.equal(good.item.status,"queued");
 assert.equal(good.item.id,"req-unique");
 assert.equal(good.item.lengthMs,300000);
 assert.ok(!("confirmed" in good.item));
 assert.equal(ui.prepareLibraryRequest(item,{...verification,ok:false},[],[],"r").ok,false);
 assert.equal(ui.prepareLibraryRequest(item,{...verification,videoId:"sm9999"},[],[],"r").ok,false);
 assert.equal(ui.prepareLibraryRequest(item,verification,[{videoId:"sm1234"}],[],"r").ok,false);
 assert.equal(ui.prepareLibraryRequest(item,verification,[],[{videoId:"SM1234"}],"r").ok,false);
 assert.equal(ui.prepareLibraryRequest(item,verification,new Array(1000).fill({videoId:"sm9999"}),[],"r").ok,false);
});
test("user-provided titles are escaped in quick panel, including attributes",()=>{
 const markup=ui.render({
  requests:[{id:'x" onmouseover="alert(1)',title:"<img src=x onerror=alert(1)>",videoId:"sm456",status:"queued"}],
  library:[{videoId:"sm1234",title:"<script>alert(2)</script>"}]});
 assert.doesNotMatch(markup,/<script|<img |onmouseover="alert/);
 assert.match(markup,/&lt;img/);
 assert.match(markup,/&lt;script/);
 assert.match(markup,/&quot;/);
});
test("broadcast panel uses real updater and existing request/quote/poll IPC actions",()=>{
 assert.match(html,/broadcast-quick-tools\.js/);
 assert.ok(html.indexOf("broadcast-quick-tools.js")<html.indexOf("renderer.js"));
 assert.match(renderer,/id="broadcast-quick-tools"/);
 assert.match(renderer,/function renderBroadcastToolsUi/);
 assert.match(renderer,/function updateBroadcastQuoteToolsTime/);
 assert.match(renderer,/function updateBroadcastPollToolsUi/);
 assert.match(renderer,/function renderBroadcastLibraryPreview/);
 assert.match(renderer,/data-broadcast-library-request/);
 assert.match(renderer,/niconico\.validateVideo\(item\.videoId\)/);
 assert.match(renderer,/prepareLibraryRequest/);
 assert.match(renderer,/resumeAutoPollAfterRequestAccepted/);
 assert.match(renderer,/updateBroadcastQuoteToolsTime\(now\)/);
});

test("broadcast quick model reads defined videoLibraryLoading/videoLibraryError without ReferenceError",()=>{
 const vm=require("node:vm");
 const match=renderer.match(/function broadcastToolModel\([^]*?\n}\nfunction renderBroadcastToolsUi/);
 assert.ok(match,"broadcast quick model must remain accessible to regression test");
 const body=match[0].replace(/\nfunction renderBroadcastToolsUi$/,"");
 const context={
  state:{poll:{autoOnQuote:false},requests:[],stocks:[]},
  pollRuntime:{status:"idle",active:false,message:""},
  pollStartPending:false,autoPollWaitingForRequestKey:"",
  quotePlayback:{active:false,verified:false,videoId:"",item:null},
  videoLibraryData:{items:[{videoId:"sm12345"}]},
  videoLibraryLoading:true,videoLibraryError:"取得エラー",
  currentQuoteProgress:()=>({ok:false})
 };
 // Evaluate the real model with the same variable names used by the Electron renderer.
 const model=vm.runInNewContext(body+";broadcastToolModel()",context);
 assert.equal(model.libraryLoading,true);
 assert.equal(model.libraryError,"取得エラー");
 assert.equal(model.library.length,1);
 assert.equal(model.library[0].videoId,"sm12345");
 assert.equal(model.pollEnabled,false);
 const markup=ui.render(model);
 assert.match(markup,/sm12345/);
 assert.match(ui.render({...model,library:[]}),/ライブラリを読み込み中です/);
});
