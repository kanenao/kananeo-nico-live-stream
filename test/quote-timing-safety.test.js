"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {findQuotedItem,trustedQuoteTiming}=require("../src/quote-timing-safety");
test("only the actively quoted video can supply a poll duration",()=>{
 const requests=[{videoId:"sm111",lengthMs:240000}],stocks=[{videoId:"so222",lengthMs:300000}];
 assert.equal(findQuotedItem("so222",requests,stocks),stocks[0]);
 assert.equal(findQuotedItem("sm999",requests,stocks),null);
 assert.equal(findQuotedItem("sm111",requests,stocks),requests[0]);
});
test("stored timestamp is valid only for the same program, video and unfinished playback",()=>{
 const now=1800000;
 const v={programId:"lv123",videoId:"sm9",storedProgramId:"lv123",storedVideoId:"sm9",startedAt:1750000,durationMs:120000};
 assert.equal(trustedQuoteTiming(v,now),true);
 assert.equal(trustedQuoteTiming({...v,storedVideoId:"sm10"},now),false);
 assert.equal(trustedQuoteTiming({...v,storedProgramId:"lv124"},now),false);
 assert.equal(trustedQuoteTiming({...v,startedAt:100000},now),false);
 assert.equal(trustedQuoteTiming({...v,startedAt:now+5000},now),false);
 assert.equal(trustedQuoteTiming({...v,durationMs:0},now),false);
});
