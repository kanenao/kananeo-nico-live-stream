"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {loggedInId,broadcastHistoryUrl,parseHistory,programFromCreateUrl}=require("../src/own-broadcast");
test("extracts only account numeric ID from authenticated cookie",()=>{
 assert.equal(loggedInId([{name:"user_session",value:"user_session_4321_safesecret"}]),"4321");
 assert.equal(loggedInId([{name:"user_session",value:"malformed"}]),null);
 assert.match(broadcastHistoryUrl("4321"),/providerId=4321/);
 assert.equal(broadcastHistoryUrl("../4321"),null);
});
test("read official broadcast history and require valid program IDs",()=>{
 const data=parseHistory(JSON.stringify({data:{programsList:[{id:{value:"lv999"},program:{title:"title",schedule:{status:"ON_AIR"}}}]}}));
 assert.equal(data.programs[0].programId,"lv999");assert.equal(data.programs[0].programStatus,"ON_AIR");
 assert.equal(parseHistory("{}").ok,false);
});
test("captures only official navigation to an lv page",()=>{
 assert.equal(programFromCreateUrl("https://live.nicovideo.jp/watch/lv123456"),"lv123456");
 assert.equal(programFromCreateUrl("https://invalid.example/watch/lv123456"),"");
});
