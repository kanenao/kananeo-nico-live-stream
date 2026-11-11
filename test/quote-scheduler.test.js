"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createQuoteSchedule,
  getRemainingMs,
  isQuoteScheduleDue
} = require("../src/quote-scheduler");

test("calculates an automatic next-video deadline from start, duration, and gap",()=>{
  const result=createQuoteSchedule({startedAt:100000,durationMs:60000,gapSeconds:10});
  assert.deepEqual(result,{ok:true,startedAt:100000,durationMs:60000,gapSeconds:10,dueAt:170000});
});

test("calculates remaining time and identifies a due schedule",()=>{
  const schedule=createQuoteSchedule({startedAt:1000,durationMs:10000,gapSeconds:5});
  assert.equal(getRemainingMs(schedule,5000),11000);
  assert.equal(isQuoteScheduleDue(schedule,15999),false);
  assert.equal(isQuoteScheduleDue(schedule,16000),true);
  assert.equal(getRemainingMs(schedule,20000),0);
});

test("rejects missing or unreasonable video duration and invalid gap",()=>{
  assert.equal(createQuoteSchedule({startedAt:1000,durationMs:0,gapSeconds:5}).code,"INVALID_DURATION");
  assert.equal(createQuoteSchedule({startedAt:1000,durationMs:12*60*60*1000+1,gapSeconds:5}).ok,false);
  assert.equal(createQuoteSchedule({startedAt:1000,durationMs:10000,gapSeconds:-1}).code,"INVALID_GAP");
  assert.equal(createQuoteSchedule({startedAt:0,durationMs:10000,gapSeconds:5}).code,"INVALID_START_TIME");
});

test("returns null for absent or malformed schedules",()=>{
  assert.equal(getRemainingMs(null),null);
  assert.equal(isQuoteScheduleDue({dueAt:"bad"}),false);
});
