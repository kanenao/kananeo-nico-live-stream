"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {selectNextPlaybackCandidate,isEligible}=require("../src/playback-scheduler");

test("plays valid requests before stock items",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"r1",status:"queued",lengthMs:10000}],
  stocks:[{id:"s1",status:"queued",lengthMs:10000}]
 });
 assert.equal(result.queue,"request");
 assert.equal(result.item.id,"r1");
});

test("falls back to stock when requests are exhausted or unplayable",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"r1",status:"completed"}],
  stocks:[{id:"s1",status:"queued"}]
 });
 assert.equal(result.queue,"stock");
 assert.equal(result.item.id,"s1");
});

test("skips no-live-play, completed, skipped, and already played stock items",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"no",no_live_play:1},{id:"done",status:"completed"}],
  stocks:[{id:"played",is_played:true},{id:"ok",status:"queued"}]
 });
 assert.equal(result.item.id,"ok");
});

test("filters videos that exceed remaining broadcast time",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"long",lengthMs:90000}],
  stocks:[{id:"short",lengthMs:20000}],
  remainingMs:30000
 });
 assert.equal(result.queue,"stock");
 assert.equal(result.item.id,"short");
 assert.equal(isEligible({lengthMs:60000},"request",30000),false);
});

test("does not reselect the currently playing item",()=>{
 const result=selectNextPlaybackCandidate({requests:[{id:"now",status:"playing"}],stocks:[{id:"later"}]});
 assert.equal(result.queue,"stock");
 assert.equal(result.item.id,"later");
});

test("keeps candidates when the broadcast end time is unknown",()=>{
 const result=selectNextPlaybackCandidate({requests:[{id:"a",lengthMs:1000}],stocks:[],remainingMs:null});
 assert.equal(result.item.id,"a");
});

test("does not select any video after the broadcast has ended",()=>{
 const result=selectNextPlaybackCandidate({requests:[{id:"a",lengthMs:1000}],stocks:[{id:"b",lengthMs:1000}],remainingMs:-1});
 assert.equal(result,null);
});

test("supports the current boolean no-live-play marker",()=>{
 const result=selectNextPlaybackCandidate({requests:[{id:"not-quotable",no_live_play:true}],stocks:[]});
 assert.equal(result,null);
});

test("supports random request ordering deterministically",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"a"},{id:"b"}],
  playStyle:2,
  random:()=>0
 });
 assert.equal(result.item.id,"b");
});

test("supports random stock ordering without changing request priority",()=>{
 const result=selectNextPlaybackCandidate({
  requests:[{id:"request"}],
  stocks:[{id:"stock"}],
  randomStock:true,
  random:()=>0
 });
 assert.equal(result.queue,"request");
});
