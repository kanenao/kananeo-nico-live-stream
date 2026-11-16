"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateProgramControl,canMutateProgram,buildProgramMutationRequest,summarizeProgramMutation}=require("../src/program-control");
test("only accepts canonical program IDs and start/end",()=>{
 assert.equal(validateProgramControl("lv123","start").ok,true);
 assert.equal(validateProgramControl("https://evil.example/lv1","start").ok,false);
 assert.equal(validateProgramControl("lv123","delete").ok,false);
});
test("start and end states are restricted",()=>{
 assert.equal(canMutateProgram("RESERVED","start"),true);
 assert.equal(canMutateProgram("TEST","start"),true);
 assert.equal(canMutateProgram("ON_AIR","start"),false);
 assert.equal(canMutateProgram("ON_AIR","end"),true);
 assert.equal(canMutateProgram("ENDED","end"),false);
});
test("constructs PUT with known program on official host",()=>{
 const s=buildProgramMutationRequest("LV123","start");
 assert.equal(s.url,"https://live2.nicovideo.jp/watch/lv123/segment");
 assert.deepEqual(JSON.parse(s.options.body),{state:"on_air"});
 assert.equal(s.options.method,"PUT");
 const e=buildProgramMutationRequest("lv123","end");
 assert.deepEqual(JSON.parse(e.options.body),{state:"end"});
});
test("do not claim success before status confirmation",()=>{
 assert.equal(summarizeProgramMutation(204,{ok:true,programId:"lv123",programStatus:"TEST"},"start","lv123").verified,false);
 assert.equal(summarizeProgramMutation(200,{ok:true,programId:"lv123",programStatus:"ON_AIR"},"start","lv123").verified,true);
 assert.equal(summarizeProgramMutation(200,{ok:true,programId:"lv123",programStatus:"ENDED"},"end","lv123").verified,true);
 assert.equal(summarizeProgramMutation(403,{}, "end","lv123").ok,false);
});
