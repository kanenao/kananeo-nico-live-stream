"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {
 buildFreeExtensionRequest,selectFreeExtensionMethod,shouldTryAutoExtend,createAutoExtensionMonitor
}=require("../src/auto-extension-monitor");
const epoch=Date.UTC(2026,10,22,1,0,0);
function program({programId="lv123",end=epoch/1000+180,status="ON_AIR"}={}) {
 return {ok:true,programId,programStatus:status,endTime:end};
}
function mock(overrides={}){
 let sent=[],callbacks={},info=program(),owned={ok:true,programs:[program()]};
 const monitor=createAutoExtensionMonitor({
  now:()=>epoch,setIntervalFn:fn=>{callbacks.tick=fn;return 1;},
  clearIntervalFn:()=>{},onStatus:s=>{callbacks.status=s;},
  getOwnBroadcast:async()=>owned,checkProgram:async()=>info,
  getOptions:async()=>({ok:true,methods:[{type:"point",minutes:30},{type:"free",minutes:30}]}),
  extend:async x=>{sent.push(x);return {ok:true,verified:true,message:"延長後の時刻を確認しました。"};},
  ...overrides
 });
 return {monitor,sent,callbacks,setProgram:x=>info=x,setOwned:x=>owned=x};
}
test("free extension request never selects paid options",()=>{
 assert.deepEqual(selectFreeExtensionMethod([{type:"point",minutes:30},{type:"free",minutes:60},{type:"free",minutes:30}]),{type:"free",minutes:30});
 assert.equal(selectFreeExtensionMethod([{type:"point",minutes:30},{type:"ticket",minutes:60}]),null);
 assert.equal(buildFreeExtensionRequest("lv123",30).method,"POST");
 assert.deepEqual(buildFreeExtensionRequest("lv123",30).body,{minutes:30});
 assert.equal(buildFreeExtensionRequest("../lv123",30).ok,false);
 assert.equal(buildFreeExtensionRequest("lv123",0).ok,false);
});
test("auto extension is due only for an active verified program within 5 minutes",()=>{
 assert.equal(shouldTryAutoExtend(program({end:epoch/1000+301}),epoch).due,false);
 assert.equal(shouldTryAutoExtend(program({end:epoch/1000+300}),epoch).due,true);
 assert.equal(shouldTryAutoExtend(program({end:epoch/1000+1}),epoch).due,true);
 assert.equal(shouldTryAutoExtend(program({end:epoch/1000-1}),epoch).due,false);
 assert.equal(shouldTryAutoExtend(program({status:"ENDED"}),epoch).due,false);
 assert.equal(shouldTryAutoExtend({...program(),ok:false},epoch).due,false);
});
test("disabled monitor never sends a mutation; enabling monitors and extends the owned broadcast",async()=>{
 const {monitor,sent}=mock();
 await monitor.poll();assert.equal(sent.length,0);
 monitor.configure({enabled:true});await monitor.poll();
 assert.equal(sent.length,1);
 assert.deepEqual(sent[0],{programId:"lv123",minutes:30,expectedEndTime:epoch/1000+180});
 assert.equal(monitor.status().phase,"extended");
 monitor.dispose();
});
test("extension request occurs once for same program end time, even on repeated polling",async()=>{
 const {monitor,sent}=mock();monitor.configure({enabled:true});
 await monitor.poll();await monitor.poll();await monitor.poll();
 assert.equal(sent.length,1);monitor.dispose();
});
test("never calls the extension API when only paid methods exist",async()=>{
 let calls=0;
 const {monitor}=mock({getOptions:async()=>({ok:true,methods:[{type:"point",minutes:30}]}),
  extend:async()=>{calls++;return {ok:true};}});
 monitor.configure({enabled:true});await monitor.poll();
 assert.equal(calls,0);assert.equal(monitor.status().phase,"unavailable");monitor.dispose();
});
test("never extends another person's program or programs not on air",async()=>{
 let calls=0;
 const {monitor,setOwned}=mock({extend:async()=>{calls++;return {ok:true};}});
 setOwned({ok:true,programs:[program({programId:"lv222",status:"ENDED"})]});
 monitor.configure({enabled:true});await monitor.poll();
 assert.equal(calls,0);monitor.dispose();
});
test("ambiguous response is not resent until a new verified end-time window",async()=>{
 let calls=0;
 const {monitor,setProgram}=mock({extend:async()=>{calls++;return {ok:false,message:"延長応答不明"};}});
 monitor.configure({enabled:true});await monitor.poll();await monitor.poll();
 assert.equal(calls,1);
 setProgram(program({end:epoch/1000+240}));await monitor.poll();
 assert.equal(calls,2);monitor.dispose();
});
test("unavailable or not yet due does not request free extension",async()=>{
 let calls=0;
 const {monitor,setProgram}=mock({getOptions:async()=>{calls++;return {ok:true,methods:[{type:"free",minutes:30}]};}});
 setProgram(program({end:epoch/1000+600}));
 monitor.configure({enabled:true});await monitor.poll();
 assert.equal(calls,0);monitor.dispose();
});
