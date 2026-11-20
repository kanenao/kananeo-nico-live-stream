"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {
 buildVideoMetadataRequest,buildThumbInfoRequest,parseThumbInfoResponse,
 fetchVideoMetadataWithFallback
}=require("../src/video-metadata");
const mockResponse=(status,body,url="")=>({status,url,text:async()=>body});
function xml(id="sm9",duration="5:20"){
 return '<?xml version="1.0" encoding="utf-8"?><nicovideo_thumb_response status="ok"><thumb>'+
  '<video_id>'+id+'</video_id><title>sample</title><length>'+duration+'</length></thumb></nicovideo_thumb_response>';
}
test("HTTP 406 from watch API falls back to exact official thumbnail metadata",async()=>{
 const calls=[];
 const result=await fetchVideoMetadataWithFallback("SM9",async request=>{
  calls.push(request);
  return calls.length===1
   ?mockResponse(406,"not acceptable",request.url)
   :mockResponse(200,xml(),request.url);
 },1790000000000);
 assert.equal(result.ok,true);
 assert.equal(result.videoId,"sm9");
 assert.equal(result.durationMs,320000);
 assert.equal(result.source,"getthumbinfo");
 assert.equal(calls.length,2);
 assert.match(calls[0].url,/www\.nicovideo\.jp\/api\/watch\/v3_guest\/sm9/);
 assert.equal(calls[1].url,"https://ext.nicovideo.jp/api/getthumbinfo/sm9");
 assert.equal(calls[1].options.method,"GET");
 assert.equal(calls[1].options.credentials,"omit");
 assert.equal(calls[1].options.redirect,"error");
});
test("successful first endpoint does not make an unnecessary fallback request",async()=>{
 let count=0;
 const result=await fetchVideoMetadataWithFallback("sm9",async request=>{
  count++;
  return mockResponse(200,JSON.stringify({meta:{status:200},data:{video:{id:"sm9",duration:88,title:"video"}}}),request.url);
 },1790000000000);
 assert.equal(result.ok,true);
 assert.equal(result.durationMs,88000);
 assert.equal(result.source,"watch-v3");
 assert.equal(count,1);
});
test("fallback never accepts an unrelated video or invalid XML/time",async()=>{
 const examples=[xml("sm10","5:20"),xml("sm9","99:99"),xml("sm9","0:00"),
  '<nicovideo_thumb_response status="fail"><thumb><video_id>sm9</video_id><length>5:20</length></thumb></nicovideo_thumb_response>',
  xml("sm9","999:59:59")];
 for(const data of examples) assert.equal(parseThumbInfoResponse(200,data,"sm9").ok,false);
 assert.equal(parseThumbInfoResponse(406,xml(),"sm9").ok,false);
 assert.equal(buildVideoMetadataRequest("https://attacker.example/sm9").ok,false);
 assert.equal(buildThumbInfoRequest("sm9/evil").ok,false);
});
test("two failed endpoints report bounded actionable error without inventing duration",async()=>{
 const result=await fetchVideoMetadataWithFallback("sm9",async request=>mockResponse(
   request.url.includes("v3_guest")?406:503,"error",request.url),1790000000000);
 assert.equal(result.ok,false);
 assert.equal(result.code,"METADATA_ALL_SOURCES_FAILED");
 assert.match(result.message,/HTTP 406/);
 assert.match(result.message,/HTTP 503/);
 assert.match(result.message,/手動/);
 assert.equal(result.durationMs,undefined);
});
test("redirected or wrong-host response cannot inject false video duration",async()=>{
 let requests=0;
 const result=await fetchVideoMetadataWithFallback("sm9",async request=>{
  requests++;
  return mockResponse(200,xml(),"https://untrusted.invalid/api/getthumbinfo/sm9");
 },1790000000000);
 assert.equal(result.ok,false);
 assert.equal(result.code,"METADATA_UNTRUSTED");
 assert.equal(requests,1);
});
test("network error in first endpoint can still use safe read-only fallback",async()=>{
 const result=await fetchVideoMetadataWithFallback("sm9",async request=>{
  if(request.url.includes("v3_guest"))throw Error("network");
  return mockResponse(200,xml("sm9","1:02:03"),request.url);
 },1790000000000);
 assert.equal(result.ok,true);
 assert.equal(result.durationMs,3723000);
});
test("Electron main process uses the video metadata fallback helper",()=>{
 const src=fs.readFileSync(path.join(__dirname,"../src/main.js"),"utf8");
 assert.match(src,/fetchVideoMetadataWithFallback\(input,request=>/);
 assert.match(src,/niconicoSession\.fetch\(request\.url,request\.options\)/);
});
