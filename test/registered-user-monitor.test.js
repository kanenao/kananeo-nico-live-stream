"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeUserIds,buildRegisteredUserHistoryUrl,normalizeMonitorConfig,createRegisteredUserMonitor}=require("../src/registered-user-monitor");
test("accepts user IDs and official profile URLs, rejects offsite URLs",()=>{
 assert.deepEqual(normalizeUserIds("123\nuser/456 https://www.nicovideo.jp/user/789 https://evil.example/user/555 123"),["123","456","789"]);
 assert.deepEqual(normalizeUserIds(["123","https://live.nicovideo.jp/user/456"]),["123","456"]);
 assert.equal(normalizeUserIds("not-a-user").length,0);
});
test("registered users request public broadcast history only",()=>{
 const url=new URL(buildRegisteredUserHistoryUrl("123"));
 assert.equal(url.hostname,"live.nicovideo.jp");
 assert.equal(url.searchParams.get("providerId"),"123");
 assert.equal(url.searchParams.get("isIncludeNonPublic"),"false");
 assert.equal(buildRegisteredUserHistoryUrl("123x"),"");
});
test("normalizes saved polling intervals and maximum 30 users",()=>{
 assert.equal(normalizeMonitorConfig({enabled:true,userIds:["7"],intervalSeconds:60}).enabled,true);
 assert.equal(normalizeMonitorConfig({enabled:true,userIds:["7"],intervalSeconds:1}).intervalSeconds,60);
 assert.equal(normalizeUserIds(Array.from({length:40},(_,i)=>String(i+1))).length,30);
});
test("detects one live once, then a new live, and never repeats unchanged lives",async()=>{
 let now=100000,cb=null,programs=[{programId:"lv1",programStatus:"ON_AIR",title:"放送A"}];
 const live=[],monitor=createRegisteredUserMonitor({
  getUserBroadcast:async()=>({ok:true,programs}),
  onLive:evt=>live.push(evt),
  now:()=>now,setIntervalFn:fn=>{cb=fn;return 1},clearIntervalFn:()=>{cb=null}
 });
 monitor.configure({enabled:true,userIds:["123"],intervalSeconds:30});
 await monitor.poll(true);assert.equal(live.length,1);
 now+=31000;await monitor.poll();assert.equal(live.length,1);
 programs=[...programs,{programId:"lv2",programStatus:"TEST",title:"放送B"}];
 now+=31000;await monitor.poll();assert.equal(live.length,2);
 monitor.dispose();assert.equal(cb,null);
});
test("ignores invalid live IDs and ended programs",async()=>{
 const live=[],monitor=createRegisteredUserMonitor({
  getUserBroadcast:async()=>({ok:true,programs:[{programId:"bad",programStatus:"ON_AIR"},{programId:"lv1",programStatus:"ENDED"}]}),
  onLive:x=>live.push(x),setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 monitor.configure({enabled:true,userIds:["1"]});await monitor.poll(true);
 assert.equal(live.length,0);monitor.dispose();
});
test("disable during async fetch discards stale results",async()=>{
 let done;const promise=new Promise(resolve=>done=resolve),live=[];
 const m=createRegisteredUserMonitor({getUserBroadcast:()=>promise,onLive:e=>live.push(e),setIntervalFn:()=>1,clearIntervalFn:()=>{}});
 m.configure({enabled:true,userIds:["123"]});const check=m.poll(true);
 m.dispose();done({ok:true,programs:[{programId:"lv2",programStatus:"ON_AIR"}]});
 await check;assert.equal(live.length,0);
});
