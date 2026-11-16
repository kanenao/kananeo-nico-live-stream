"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeStreamMonitorSettings,normalizeMonitorUserIds,applyProgramCheck,isStreamMonitorGenerationCurrent,checkStreamMonitorTargets,statusLabel}=require("../src/stream-monitor");
test("normalizes and deduplicates at most 50 registered broadcast IDs",()=>{
 const targets=Array.from({length:55},(_,i)=>({programId:"lv"+(1000+i)}));
 const result=normalizeStreamMonitorSettings({enabled:true,intervalSeconds:45,autoComments:true,targets:[...targets,{programId:"LV1000"},{programId:"https://example.com"}]});
 assert.equal(result.enabled,true);assert.equal(result.intervalSeconds,60);assert.equal(result.autoComments,true);assert.equal(result.targets.length,50);assert.equal(result.targets[0].programId,"lv1000");
});
test("detects the transition to on-air only once",()=>{
 const first=applyProgramCheck({programId:"lv1",status:"unknown"},{ok:true,programStatus:"ON_AIR",title:"配信"});
 assert.equal(first.target.status,"onAir");assert.equal(first.becameLive,true);
 const second=applyProgramCheck(first.target,{ok:true,programStatus:"ON_AIR"});
 assert.equal(second.becameLive,false);
 const ended=applyProgramCheck(second.target,{ok:true,programStatus:"ENDED"});
 assert.equal(ended.target.status,"ended");assert.equal(ended.becameLive,false);
});
test("does not mark a target offline when a page request fails",()=>{
 const previous={programId:"lv1",status:"onAir",title:"配信"};
 const result=applyProgramCheck(previous,{ok:false,message:"timeout"});
 assert.equal(result.target.status,"onAir");assert.equal(result.target.lastError,"timeout");assert.equal(result.becameLive,false);
});
test("shows safe Japanese status labels",()=>{
 assert.equal(statusLabel("onAir"),"放送中");assert.equal(statusLabel("ended"),"終了");assert.equal(statusLabel("other"),"状態未確認");
});

test("invalidates stale asynchronous checks after stop or settings changes",()=>{
 const captured=12;
 assert.equal(isStreamMonitorGenerationCurrent(captured,12),true);
 assert.equal(isStreamMonitorGenerationCurrent(captured,13),false);
 assert.equal(isStreamMonitorGenerationCurrent(captured,11),false);
 assert.equal(isStreamMonitorGenerationCurrent("12",12),false);
});

test("checks at most two broadcasts concurrently and applies every result",async()=>{
 const targets=Array.from({length:7},(_,i)=>({programId:"lv"+(i+1)}));
 let inFlight=0,maxInFlight=0;
 const seen=[];
 const result=await checkStreamMonitorTargets(targets,async target=>{
  inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
  await new Promise(resolve=>setImmediate(resolve));
  inFlight--;
  return {ok:true,programStatus:"ON_AIR",title:target.programId};
 },(target,response)=>seen.push([target.programId,response.title]),{concurrency:99});
 assert.equal(maxInFlight,2);
 assert.equal(result.checked,7);
 assert.equal(result.cancelled,false);
 assert.deepEqual(seen.map(item=>item[0]).sort(),targets.map(x=>x.programId).sort());
});
test("discards outstanding results and does not start queued requests after cancellation",async()=>{
 const targets=Array.from({length:5},(_,i)=>({programId:"lv"+(i+1)}));
 let resume;
 const gate=new Promise(resolve=>{resume=resolve;});
 let current=true;
 const started=[],applied=[];
 const pending=checkStreamMonitorTargets(targets,async target=>{
  started.push(target.programId);
  await gate;
  return {ok:true};
 },target=>applied.push(target.programId),{isCurrent:()=>current});
 assert.equal(started.length,2);
 current=false;
 resume();
 const result=await pending;
 assert.equal(result.cancelled,true);
 assert.equal(result.checked,0);
 assert.equal(started.length,2);
 assert.deepEqual(applied,[]);
});
test("converts individual request failures into visible errors and continues",async()=>{
 const items=[{programId:"lv1"},{programId:"lv2"}],results=[];
 const outcome=await checkStreamMonitorTargets(items,async target=>{
  if(target.programId==="lv1")throw new Error("network offline");
  return {ok:true};
 },(target,response)=>results.push({id:target.programId,...response}),{concurrency:1});
 assert.equal(outcome.checked,2);
 assert.equal(results[0].message,"network offline");
 assert.equal(results[0].ok,false);
 assert.equal(results[1].ok,true);
});

test("registered streamer user IDs stay normalized and distinct",()=>{
 const result=normalizeMonitorUserIds("123\nuser/456\nhttps://www.nicovideo.jp/user/789\nhttps://example.com/user/9\n123");
 assert.deepEqual(result,["123","456","789"]);
});

test("registered livestream notifications require an explicit saved preference",()=>{
 assert.equal(normalizeStreamMonitorSettings({}).notifyOnLive,false);
 assert.equal(normalizeStreamMonitorSettings({notifyOnLive:true}).notifyOnLive,true);
 assert.equal(normalizeStreamMonitorSettings({notifyOnLive:"yes"}).notifyOnLive,false);
});
