"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {INITIAL_START_SECONDS,SAFETY_SECONDS,mediaPlan,repeatDelaySeconds,repeatPlan}=require("../src/poll-timing");
test("continue-vote ratio determines 10-60 second delay; tie 10 and no-votes 5",()=>{
 const d=(keep,next,reason="majority")=>repeatDelaySeconds({decision:"repeat",reason,continueRate:keep,nextRate:next});
 assert.equal(d(100,0),60);
 assert.equal(d(70,30),30);
 assert.equal(d(51,49),11);
 assert.equal(d(50,50,"tie"),10);
 assert.equal(d(0,0,"no-votes"),5);
 assert.equal(d(0,100),null);
 assert.equal(repeatDelaySeconds({decision:"invalid"}),null);
});
test("refuses to start when total remaining time lacks start, voting, results or safety",()=>{
 const startedAt=1000;
 const input={startedAt,now:1000,voteSeconds:15,resultSeconds:10,startWaitSeconds:INITIAL_START_SECONDS,safetySeconds:SAFETY_SECONDS};
 assert.equal(mediaPlan({...input,durationMs:34999}).ok,false);
 assert.equal(mediaPlan({...input,durationMs:35000}).ok,true);
 assert.equal(mediaPlan({...input,durationMs:0}).code,"UNKNOWN_VIDEO_DURATION");
 assert.equal(mediaPlan({...input,durationMs:50000,now:21000}).ok,false);
});
test("repeat budget includes computed delay, next vote, results and safe margin",()=>{
 const input={decision:{decision:"repeat",continueRate:70,nextRate:30},
  durationMs:180000,startedAt:1000,now:31000,voteSeconds:15,resultSeconds:10,safetySeconds:5,scheduledEndAt:181000};
 const result=repeatPlan(input);
 assert.equal(result.ok,true);
 assert.equal(result.delaySeconds,30);
 assert.equal(result.reserveSeconds,60);
 assert.equal(result.plannedEndAt,241000);
 assert.equal(repeatPlan({...input,durationMs:90000,now:60000}).ok,false);
});
test("no votes produce 5-second retry and an invalid API decision cannot skip or repeat",()=>{
 const input={decision:{decision:"repeat",reason:"no-votes",continueRate:0,nextRate:0},
  durationMs:120000,startedAt:1000,now:2000,voteSeconds:15,resultSeconds:10,safetySeconds:5,scheduledEndAt:121000};
 assert.equal(repeatPlan(input).reserveSeconds,35);
 assert.equal(repeatPlan({...input,decision:{decision:"invalid"}}).code,"INVALID_RESULT");
});
