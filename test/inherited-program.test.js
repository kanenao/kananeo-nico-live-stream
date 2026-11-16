"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {API_URL,inheritPreviousProgram,buildPreviousProgramRequest,parsePreviousProgram,
 buildCreateProgramRequest,parseCreateProgramResponse}=require("../src/inherited-program");
const TOKEN="user_session_123456789_abcdef0123456789";
function previous(overrides={}){return {id:"lv123",title:"生放送タイトル",description:"前枠の説明",
 category:"一般",community:{id:"co123"},tags:[{label:"雑談",isLocked:true},{label:"実況",isLocked:false}],
 isTagOwnerLock:true,isMemberOnly:true,isTimeshiftEnabled:false,isQuotable:false,
 isUadEnabled:false,isAutoCommentFilterEnabled:true,maxQuality:"1Mbps450p",...overrides};}
test("copies title, description, tags, category, privacy, quality; omits past schedule",()=>{
 const v=inheritPreviousProgram(previous({reservationBeginTime:"2020-01-01T00:00:00+09:00",durationMinutes:30}),"lv123");
 assert.equal(v.ok,true);
 assert.deepEqual(v.payload.tags,[{label:"雑談",isLocked:true},{label:"実況",isLocked:false}]);
 assert.equal(v.payload.isMemberOnly,true);assert.equal(v.payload.isTimeshiftEnabled,false);
 assert.equal(v.payload.reservationBeginTime,undefined);assert.equal(v.payload.durationMinutes,undefined);
});
test("fails closed when previous visibility cannot be copied",()=>{
 for(const old of [
  previous({isPasswordProtected:true}),previous({password:"secret"}),
  previous({visibility:"private"}),previous({isMemberOnly:undefined}),
  previous({community:null}),previous({tags:[{label:"test"}]})
 ]) assert.equal(inheritPreviousProgram(old,"lv123").ok,false);
});
test("rejects unexpected program IDs and invalid source API",()=>{
 assert.equal(inheritPreviousProgram(previous(),"lv456").ok,false);
 const good=parsePreviousProgram(JSON.stringify({meta:{status:200},data:previous()}),200,"lv123");
 assert.equal(good.ok,true);
 assert.equal(parsePreviousProgram("not-json",200,"lv123").ok,false);
 assert.equal(parsePreviousProgram("{}",403,"lv123").ok,false);
});
test("request headers keep credentials only in the main process and stay on trusted host",()=>{
 const get=buildPreviousProgramRequest("lv123",TOKEN);
 assert.equal(get.ok,true);assert.equal(get.url,API_URL+"/lv123");
 assert.equal(get.options.headers["X-niconico-session"],TOKEN);
 const post=buildCreateProgramRequest(inheritPreviousProgram(previous(),"lv123").payload,TOKEN);
 assert.equal(post.ok,true);assert.equal(post.url,API_URL);assert.equal(post.options.method,"POST");
 assert.equal(JSON.parse(post.options.body).title,"生放送タイトル");
 assert.equal(buildPreviousProgramRequest("https://evil.example",TOKEN).ok,false);
});
test("only confirmed HTTP 201 and matching response ID constitutes success",()=>{
 assert.deepEqual(parseCreateProgramResponse(JSON.stringify({meta:{status:201},data:{id:"lv456"}}),201),{ok:true,programId:"lv456"});
 assert.equal(parseCreateProgramResponse(JSON.stringify({meta:{status:201},data:{id:"bad"}}),201).ok,false);
 assert.equal(parseCreateProgramResponse("bad",201).ok,false);
 assert.equal(parseCreateProgramResponse(JSON.stringify({meta:{status:400,errorCode:"INVALID"}}),400).ok,false);
});

test("user broadcasts without legacy community ID can inherit safely",()=>{
 const original=previous({community:null,communityId:undefined});
 const plan=inheritPreviousProgram(original,"lv123");
 assert.equal(plan.ok,true);
 assert.equal(Object.hasOwn(plan.payload,"communityId"),false);
});
