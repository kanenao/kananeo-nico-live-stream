"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..","src");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const orderedScripts=[...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
const exportsExpected=[
 "KananeoQuoteScheduler",
 "KananeoPollTiming",
 "KananeoUserProfiles",
 "KananeoCommentSpeech",
 "KananeoBroadcastManagement",
 "KananeoCommentViewSettings",
 "KananeoRemoteAuditSummary",
 "KananeoStreamMonitor",
 "KananeoStreamMonitorHistory",
 "KananeoUiHealth"
];

function makePage(){
 const listeners=new Map();
 const nodes=new Map();
 const makeNode=()=>({
  innerHTML:"",textContent:"",value:"",hidden:false,disabled:false,
  style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  _events:{},
  addEventListener(type,callback){this._events[type]=callback;},
  querySelector(){return null;},querySelectorAll(){return [];},
  getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:0,height:0};},
  setAttribute(){},removeAttribute(){}
 });
 const doc={
  visibilityState:"visible",
  getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);},
  querySelector(){return null;},querySelectorAll(){return [];},
  addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},
  createElement(){return makeNode();}
 };
 const never=new Promise(()=>{});
 const sandbox={
  document:doc,URL,console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},
  addEventListener(){},removeEventListener(){},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  innerWidth:1200,innerHeight:800,
  kananeoApp:{
   version:"0.2.0-alpha.50",
   niconico:{
    getSessionStatus:()=>never,onSessionChanged(){},onLiveVideoState(){},onCreatedBroadcast(){},
    onComment(){},onCommentState(){},onVideoState(){},setLiveVideoBounds(){}
   },
   bgm:{get:()=>never},
   remote:{getLanOptions:()=>never,onRequest(){}},
   updates:{check:()=>never},
   videoLibrary:{get:()=>never}
  }
 };
 sandbox.window=sandbox;
 vm.createContext(sandbox);
 return {sandbox,nodes,listeners};
}
function loadScripts(page){
 for(const file of orderedScripts){
  const code=fs.readFileSync(path.join(root,file),"utf8");
  vm.runInContext(code,page.sandbox,{filename:file,timeout:1000});
 }
}
test("browser scripts load together in real HTML order without duplicate lexical declarations",()=>{
 const page=makePage();
 loadScripts(page);
 for(const name of exportsExpected)assert.ok(page.sandbox[name],name+" was not registered");
 assert.equal(typeof page.sandbox.KananeoQuoteScheduler.createQuoteSchedule,"function");
 assert.equal(typeof page.sandbox.KananeoStreamMonitor.checkStreamMonitorTargets,"function");
 assert.match(page.nodes.get("content").innerHTML,/配信コントロールセンター/);
});
test("sidebar buttons change the screen after the complete browser bootstrap",()=>{
 const page=makePage();
 loadScripts(page);
 const click=page.nodes.get("nav")._events.click;
 assert.equal(typeof click,"function","sidebar handler is missing");
 function navigate(name,label){
  click({target:{closest:selector=>selector==="[data-page]"?{dataset:{page:name},textContent:label}:null}});
 }
 navigate("requests","動画リクエスト");
 assert.match(page.nodes.get("content").innerHTML,/動画リクエストを追加/);
 assert.equal(page.nodes.get("crumb").textContent,"動画リクエスト");
 navigate("settings","設定");
 assert.match(page.nodes.get("content").innerHTML,/アップデート確認/);
 assert.equal(page.nodes.get("crumb").textContent,"設定");
});
test("shared source files remain importable in Node after browser scope isolation",()=>{
 const quote=require("../src/quote-scheduler");
 const comments=require("../src/comment-speech");
 const profiles=require("../src/user-profiles");
 const broadcast=require("../src/broadcast-management");
 assert.equal(typeof quote.createQuoteSchedule,"function");
 assert.equal(typeof comments.normalizeCommentSpeechSettings,"function");
 assert.equal(typeof profiles.normalizeUserProfiles,"function");
 assert.equal(typeof broadcast.createBroadcastVerification,"function");
});
