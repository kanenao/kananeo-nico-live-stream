"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {findQuotedItem,trustedQuoteStart,trustedQuoteTiming}=require("../src/quote-timing-safety");
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

test("a known start remains usable while duration is missing for the same quote",()=>{
 const now=1900000;
 const quote={programId:"lv1",videoId:"sm9",storedProgramId:"lv1",storedVideoId:"sm9",
  startedAt:now-25000,durationMs:0};
 assert.equal(trustedQuoteStart(quote,now),true);
 assert.equal(trustedQuoteTiming(quote,now),false);
 assert.equal(trustedQuoteTiming({...quote,durationMs:120000},now),true);
 assert.equal(trustedQuoteStart({...quote,storedVideoId:"sm10"},now),false);
 assert.equal(trustedQuoteStart({...quote,storedProgramId:"lv2"},now),false);
 assert.equal(trustedQuoteStart({...quote,startedAt:now+1},now),false);
 assert.equal(trustedQuoteStart({...quote,startedAt:now-86400000},now),false);
 assert.equal(trustedQuoteTiming({...quote,durationMs:20000},now),false);
});
