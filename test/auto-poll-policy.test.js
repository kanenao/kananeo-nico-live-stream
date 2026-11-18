"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {quotePollKey,canAutoPoll}=require("../src/auto-poll-policy");
test("auto poll needs an explicitly enabled valid current quote",()=>{
 const valid={enabled:true,quoteActive:true,pollBusy:false,attemptedKey:"",programId:"lv123",videoId:"sm9",startedAt:1700000000000};
 assert.equal(canAutoPoll(valid),true);
 assert.equal(canAutoPoll({...valid,enabled:false}),false);
 assert.equal(canAutoPoll({...valid,quoteActive:false}),false);
 assert.equal(canAutoPoll({...valid,pollBusy:true}),false);
 assert.equal(canAutoPoll({...valid,programId:"other"}),false);
 assert.equal(canAutoPoll({...valid,startedAt:0}),false);
 assert.equal(canAutoPoll({...valid,attemptedKey:quotePollKey(valid.programId,valid.videoId,valid.startedAt)}),false);
});
test("different replay of same video is a new poll event, same quote is not",()=>{
 const one=quotePollKey("lv1","sm9",1700000000000);
 assert.equal(one,quotePollKey("LV1","SM9",1700000000000));
 assert.notEqual(one,quotePollKey("lv1","sm9",1700000001000));
 assert.notEqual(one,quotePollKey("lv2","sm9",1700000000000));
 assert.equal(quotePollKey("lv1","sm9",NaN),"");
});
