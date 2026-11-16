"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateManualProgramInput}=require("../src/manual-program-create");
const {buildVideoMetadataRequest,parseVideoMetadataResponse}=require("../src/video-metadata");
test("manual program requires explicit confirmation and visibility",()=>{
 const x={confirmed:true,title:"新しい枠",description:"説明",category:"一般",isMemberOnly:false,tags:["雑談","実況"]};
 assert.deepEqual(validateManualProgramInput(x).payload,{title:"新しい枠",description:"説明",category:"一般",isMemberOnly:false,tags:[{label:"雑談",isLocked:false},{label:"実況",isLocked:false}]});
 assert.equal(validateManualProgramInput({...x,confirmed:false}).ok,false);
 assert.equal(validateManualProgramInput({...x,isMemberOnly:undefined}).ok,false);
 assert.equal(validateManualProgramInput({...x,password:"secret"}).ok,false);
 assert.equal(validateManualProgramInput({...x,tags:Array.from({length:11},()=> "tag")}).ok,false);
});
test("video metadata request only uses canonical Nico video IDs",()=>{
 const m=buildVideoMetadataRequest("sm9",1700000000000);
 assert.equal(m.ok,true);assert.equal(new URL(m.url).hostname,"www.nicovideo.jp");
 assert.equal(new URL(m.url).pathname,"/api/watch/v3_guest/sm9");
 assert.equal(m.options.headers["X-Frontend-Id"],"6");
 assert.equal(buildVideoMetadataRequest("https://evil.example/sm9").ok,false);
});
test("metadata duration is accepted only when API status and video ID match",()=>{
 const text=JSON.stringify({meta:{status:200},data:{video:{id:"sm9",duration:240,title:"動画"}}});
 assert.equal(parseVideoMetadataResponse(200,text,"sm9").durationMs,240000);
 assert.equal(parseVideoMetadataResponse(200,text,"sm10").ok,false);
 assert.equal(parseVideoMetadataResponse(403,text,"sm9").ok,false);
 assert.equal(parseVideoMetadataResponse(200,JSON.stringify({meta:{status:200},data:{video:{id:"sm9",duration:0}}}),"sm9").ok,false);
});
