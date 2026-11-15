"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {settleBeforeQuit}=require("../src/quit-helpers");
test("cleanups are awaited even if one rejects",async()=>{
 let second=false;
 const result=await settleBeforeQuit([
  ()=>Promise.reject(new Error("closed stream")),
  async()=>{second=true;}
 ],500);
 assert.equal(result.timedOut,false);
 assert.equal(result.results.length,2);
 assert.equal(second,true);
});
test("hung cleanup does not block updater installation indefinitely",async()=>{
 const pending=new Promise(()=>{});
 let stopped=false;
 const result=await settleBeforeQuit([()=>pending],100,{schedule:fn=>{fn();return 1;},cancel:()=>{stopped=true;}});
 assert.equal(result.timedOut,true);
 assert.equal(stopped,true);
});
