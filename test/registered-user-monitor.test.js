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

test("checks at most three registered broadcasters concurrently",async()=>{
 let current=0,peak=0,completed=0;
 const userIds=Array.from({length:12},(_,i)=>String(i+1));
 const m=createRegisteredUserMonitor({
  getUserBroadcast:async()=>{
   current++;peak=Math.max(peak,current);
   await new Promise(resolve=>setImmediate(resolve));
   completed++;current--;
   return {ok:true,programs:[]};
  },setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 m.configure({enabled:true,userIds,intervalSeconds:30});
 await m.poll(true);
 assert.equal(peak,3);
 assert.equal(completed,12);
 assert.equal(m.status().checkedUsers,12);
 assert.equal(m.status().failedUsers,0);
 m.dispose();
});
test("one failed broadcaster does not block checks for others",async()=>{
 const m=createRegisteredUserMonitor({
  getUserBroadcast:async userId=>{
   if(userId==="2")throw new Error("connection failed");
   return {ok:true,programs:[]};
  },setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 m.configure({enabled:true,userIds:["1","2","3"],intervalSeconds:30});
 await m.poll(true);
 assert.equal(m.status().checkedUsers,2);
 assert.equal(m.status().failedUsers,1);
 assert.match(m.status().message,/取得失敗 1人/);
 m.dispose();
});
test("repeating identical settings does not reset timer, notifications or restart monitoring",async()=>{
 let scheduled=0,cleared=0;
 const lives=[],config={enabled:true,userIds:["1"],intervalSeconds:30,notifyOnLive:true};
 const m=createRegisteredUserMonitor({
  getUserBroadcast:async()=>({ok:true,programs:[{programId:"lv55",programStatus:"ON_AIR"}]}),
  onLive:x=>lives.push(x),setIntervalFn:()=>++scheduled,clearIntervalFn:()=>{cleared++;}
 });
 m.configure(config);await m.poll(true);
 const same=m.configure({...config});
 assert.equal(same.status.notifyOnLive,true);
 assert.equal(scheduled,1);
 assert.equal(cleared,0);
 await m.poll(true);assert.equal(lives.length,1);
 m.dispose();
});
test("reconfigure while requests are pending discards stale results and preserves fresh cycle state",async()=>{
 let finish;
 const pending=new Promise(resolve=>{finish=resolve;});
 const broadcasts=[];
 const m=createRegisteredUserMonitor({
  getUserBroadcast:userId=>userId==="1"?pending:Promise.resolve({ok:true,programs:[{programId:"lv222",programStatus:"ON_AIR"}]}),
  onLive:value=>broadcasts.push(value),setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 m.configure({enabled:true,userIds:["1"],intervalSeconds:30});
 const original=m.poll(true);
 m.configure({enabled:true,userIds:["2"],intervalSeconds:30});
 const newer=m.poll(true);
 finish({ok:true,programs:[{programId:"lv111",programStatus:"ON_AIR"}]});
 await Promise.all([original,newer]);
 assert.deepEqual(broadcasts.map(x=>x.programId),["lv222"]);
 assert.equal(m.status().busy,false);
 assert.equal(m.status().checkedUsers,1);
 m.dispose();
});
test("notification preference defaults OFF and only explicit true enables it",()=>{
 assert.equal(normalizeMonitorConfig({enabled:true,userIds:["1"]}).notifyOnLive,false);
 assert.equal(normalizeMonitorConfig({enabled:true,userIds:["1"],notifyOnLive:true}).notifyOnLive,true);
 assert.equal(normalizeMonitorConfig({enabled:true,userIds:["1"],notifyOnLive:"true"}).notifyOnLive,false);
});
