"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizeStreamMonitorSettings,applyProgramCheck,statusLabel}=require("../src/stream-monitor");
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
