"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {mediaPlan,INITIAL_START_SECONDS,SAFETY_SECONDS}=require("../src/poll-timing");
const base={now:100000,startedAt:90000,durationMs:180000,startWaitSeconds:INITIAL_START_SECONDS,voteSeconds:15,resultSeconds:10,safetySeconds:SAFETY_SECONDS};
test("unknown quote start, missing duration and invalid poll settings have distinct reasons",()=>{
 assert.equal(mediaPlan({...base,startedAt:0}).code,"UNKNOWN_QUOTE_START");
 assert.equal(mediaPlan({...base,startedAt:130000}).code,"UNKNOWN_QUOTE_START");
 assert.equal(mediaPlan({...base,durationMs:0}).code,"UNKNOWN_VIDEO_DURATION");
 assert.equal(mediaPlan({...base,voteSeconds:0}).code,"INVALID_POLL_SETTINGS");
 assert.equal(mediaPlan(base).ok,true);
});
test("short remaining duration is still skipped safely",()=>{
 const result=mediaPlan({...base,durationMs:20000});
 assert.equal(result.ok,false);
 assert.equal(result.code,"INSUFFICIENT_VIDEO_DURATION");
});