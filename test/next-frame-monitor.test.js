"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createNextFrameMonitor,CHECK_MS,RETRY_MS}=require("../src/next-frame-monitor");
const row=(programId,programStatus)=>({programId,programStatus});
function fixture(){
 let clock=100000,own={ok:true,userId:"1",programs:[]},verify=id=>({ok:true,programId:id,programStatus:"ENDED"}),opens=0,calls=0,tick=null;
 const monitor=createNextFrameMonitor({
  getOwnBroadcast:async()=>{calls++;return own;},
  verifyProgram:async id=>verify(id),openCreate:async()=>{opens++;return {ok:true};},
  now:()=>clock,setIntervalFn:cb=>{tick=cb;return 1;},clearIntervalFn:()=>{tick=null;}
 });
 return {monitor,setOwn:x=>{own=x;},setVerify:x=>{verify=x;},
  advance:x=>{clock+=x;},get opens(){return opens;},get calls(){return calls;},get tick(){return tick;}};
}
test("observed own ON_AIR -> ENDED opens only once",async()=>{
 const x=fixture(),m=x.monitor;m.configure({enabled:true});
 x.setOwn({ok:true,userId:"1",programs:[row("lv123","ENDED")]});await m.poll(true);assert.equal(x.opens,0);
 x.advance(CHECK_MS);x.setOwn({ok:true,userId:"1",programs:[row("lv123","ON_AIR")]});
 await m.poll();assert.equal(m.status().armedProgramId,"lv123");
 x.advance(CHECK_MS);x.setOwn({ok:true,userId:"1",programs:[row("lv123","ENDED")]});
 await m.poll();assert.equal(x.opens,1);assert.equal(m.status().lastTriggeredId,"lv123");
 x.advance(CHECK_MS);await m.poll();assert.equal(x.opens,1);m.dispose();
});
test("upcoming reservation prevents duplicate preparation",async()=>{
 const x=fixture();x.monitor.configure({enabled:true});
 x.setOwn({ok:true,userId:"1",programs:[row("lv123","ON_AIR")]});await x.monitor.poll();
 x.advance(CHECK_MS);x.setOwn({ok:true,userId:"1",programs:[row("lv123","ENDED"),row("lv124","RESERVED")]});
 await x.monitor.poll();assert.equal(x.opens,0);assert.equal(x.monitor.status().phase,"skipped");x.monitor.dispose();
});
test("verification must match the ended program ID",async()=>{
 const x=fixture();x.monitor.configure({enabled:true});
 x.setOwn({ok:true,userId:"1",programs:[row("lv123","ON_AIR")]});await x.monitor.poll();
 x.advance(CHECK_MS);x.setOwn({ok:true,userId:"1",programs:[row("lv123","ENDED")]});

 x.setVerify(()=>({ok:true,programId:"lv999",programStatus:"ENDED"}));
 await x.monitor.poll();assert.equal(x.opens,0);
 x.advance(CHECK_MS);x.setVerify(id=>({ok:true,programId:id,programStatus:"ON_AIR"}));
 await x.monitor.poll();assert.equal(x.opens,0);x.monitor.dispose();
});
test("account change does not carry a previous live observation",async()=>{
 const x=fixture();x.monitor.configure({enabled:true});
 x.setOwn({ok:true,userId:"1",programs:[row("lv123","ON_AIR")]});await x.monitor.poll();
 x.advance(CHECK_MS);x.setOwn({ok:true,userId:"2",programs:[row("lv123","ENDED")]});
 await x.monitor.poll();assert.equal(x.opens,0);x.monitor.dispose();
});
test("failed request retries after backoff, not every second",async()=>{
 const x=fixture();x.monitor.configure({enabled:true});
 x.setOwn({ok:false,message:"ログインしてください"});await x.monitor.poll();
 assert.equal(x.monitor.status().phase,"error");
 const n=x.calls;x.advance(CHECK_MS);await x.monitor.poll();assert.equal(x.calls,n);
 x.advance(RETRY_MS);x.setOwn({ok:true,userId:"1",programs:[]});
 await x.monitor.poll();assert.equal(x.monitor.status().phase,"waiting");x.monitor.dispose();
});
test("disabling during pending history request stops side effects",async()=>{
 let resolve,opened=0;
 const pending=new Promise(r=>{resolve=r;});
 const m=createNextFrameMonitor({
  getOwnBroadcast:()=>pending,
  verifyProgram:async id=>({ok:true,programId:id,programStatus:"ENDED"}),
  openCreate:async()=>{opened++;return {ok:true};},
  setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 m.configure({enabled:true});const checking=m.poll(true);m.configure({enabled:false});
 resolve({ok:true,userId:"1",programs:[row("lv123","ENDED")]});
 await checking;assert.equal(opened,0);assert.equal(m.status().enabled,false);
});
test("reconfiguration does not forget observed program and timer can stop",async()=>{
 const x=fixture();x.monitor.configure({enabled:true,lastTriggeredId:"lv999"});
 x.setOwn({ok:true,userId:"1",programs:[row("lv123","ON_AIR")]});await x.monitor.poll();
 x.monitor.configure({enabled:true,lastTriggeredId:"lv123"});
 assert.equal(x.monitor.status().armedProgramId,"lv123");
 assert.equal(x.monitor.status().lastTriggeredId,"lv999");
 assert.equal(typeof x.tick,"function");
 x.monitor.dispose();assert.equal(x.tick,null);
});


test("autoCreate mode invokes inherited creation callback with program and account",async()=>{
 const events=[],rows=[{programId:"lv123",programStatus:"ON_AIR"}];
 let created=0;
 const monitor=createNextFrameMonitor({
  getOwnBroadcast:async()=>({ok:true,userId:"7",programs:rows}),
  verifyProgram:async()=>({ok:true,programId:"lv123",programStatus:"ENDED"}),
  openCreate:async(id,userId,auto)=>{created++;assert.deepEqual([id,userId,auto],["lv123","7",true]);return {ok:true,programId:"lv456"};},
  onStatus:s=>events.push(s),
  setIntervalFn:()=>1,clearIntervalFn:()=>{}
 });
 monitor.configure({enabled:true,autoCreate:true});
 await monitor.poll(true);
 rows[0].programStatus="ENDED";
 await monitor.poll(true);
 assert.equal(created,1);
 assert.equal(monitor.status().nextProgramId,"lv456");
 assert.equal(monitor.status().lastTriggeredId,"lv123");
 monitor.dispose();
});
