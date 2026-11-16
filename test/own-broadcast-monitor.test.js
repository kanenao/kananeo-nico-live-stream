"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {CHECK_MS,RETRY_MS,createOwnBroadcastMonitor}=require("../src/own-broadcast-monitor");
const row=(programId,programStatus)=>({programId,programStatus,title:"自分の放送"});
function fixture(){
 let t=100000,timer=null,reply={ok:true,userId:"123",programs:[]},calls=0;const lives=[];
 const monitor=createOwnBroadcastMonitor({getOwnBroadcast:async()=>{calls++;return reply;},onLive:x=>lives.push(x),
  now:()=>t,setIntervalFn:fn=>{timer=fn;return 1},clearIntervalFn:()=>{timer=null}});
 return {monitor,lives,reply:x=>{reply=x;},advance:ms=>{t+=ms;},get timer(){return timer},get calls(){return calls}};
}
test("starts immediately and detects existing and newly started own lives once",async()=>{
 const x=fixture();x.reply({ok:true,userId:"123",programs:[row("lv1","ON_AIR")]});x.monitor.start();
 assert.equal(typeof x.timer,"function");await x.monitor.check(true);await x.monitor.check(true);assert.equal(x.lives.length,1);
 x.advance(CHECK_MS);x.reply({ok:true,userId:"123",programs:[row("lv1","ON_AIR"),row("lv2","TEST")]});
 await x.monitor.check();assert.equal(x.lives.length,2);assert.equal(x.monitor.status().activePrograms.length,2);x.monitor.stop();
});
test("keeps monitoring while logged out then resumes after login",async()=>{
 const x=fixture();x.monitor.start();x.reply({ok:false,message:"ログインしてください"});await x.monitor.check(true);
 assert.equal(x.monitor.status().phase,"waiting-login");const c=x.calls;x.advance(CHECK_MS);await x.monitor.check();assert.equal(x.calls,c);
 x.advance(RETRY_MS);x.reply({ok:true,userId:"456",programs:[row("lv9","ON_AIR")]});
 await x.monitor.check();assert.equal(x.lives[0].programId,"lv9");x.monitor.stop();
});
test("account switching resets de-duplication and rejects non-live IDs",async()=>{
 const x=fixture();x.monitor.start();
 x.reply({ok:true,userId:"1",programs:[row("lv10","ON_AIR"),row("bad","ON_AIR"),row("lv2","ENDED")]});await x.monitor.check(true);
 x.reply({ok:true,userId:"2",programs:[row("lv10","ON_AIR")]});await x.monitor.check(true);
 assert.equal(x.lives.length,2);assert.equal(x.lives[1].userId,"2");x.monitor.stop();
});
test("stopping while request is pending ignores stale results",async()=>{
 let finish;const wait=new Promise(resolve=>{finish=resolve}),events=[];
 const m=createOwnBroadcastMonitor({getOwnBroadcast:()=>wait,onLive:x=>events.push(x),setIntervalFn:()=>1,clearIntervalFn:()=>{}});
 m.start();const p=m.check(true);m.stop();finish({ok:true,userId:"1",programs:[row("lv9","ON_AIR")]});
 await p;assert.equal(events.length,0);assert.equal(m.status().running,false);
});
