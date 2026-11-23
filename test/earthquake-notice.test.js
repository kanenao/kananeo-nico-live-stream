"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const e=require("../src/earthquake-notice");

function quake(id="report-a",scale=40,reportedAt="2026/11/24 01:00:00.000",origin="2026/11/24 00:57:00"){
 return {
  id,code:551,time:reportedAt,
  issue:{source:"気象庁",time:reportedAt,correct:"None",type:"DetailScale"},
  earthquake:{time:origin,maxScale:scale,hypocenter:{name:"宮城県沖",magnitude:5.2,depth:30}}
 };
}
test("only normalizes JMA earthquake information, not EEW or crowdsourced reports",()=>{
 assert.ok(e.normalizeReport(quake()));
 assert.equal(e.normalizeReport({...quake(),code:556}),null);
 assert.equal(e.normalizeReport({...quake(),code:561}),null);
 assert.equal(e.normalizeReport({...quake(),id:""}),null);
 assert.equal(e.normalizeReport({...quake(),earthquake:{maxScale:40}}),null);
 assert.equal(e.normalizeReport({...quake(),issue:{correct:"Cancel"}}),null);
});
test("maps shindo to correct labels and handles the estimated 5-lower scale safely",()=>{
 assert.deepEqual([10,20,30,40,45,50,55,60,70].map(n=>e.normalizeReport(quake("report-"+n,n)).scaleLabel),
 ["1","2","3","4","5弱","5強","6弱","6強","7"]);
 assert.equal(e.normalizeReport(quake("report-46",46)).scale,45);
 assert.equal(e.normalizeReport(quake("report-x",-1)),null);
});
test("parses JST dates independent of the computer timezone",()=>{
 assert.equal(e.parseJapanDate("2026/11/24 01:00:00"),Date.UTC(2026,10,23,16));
 assert.equal(e.parseJapanDate("2026/02/30 01:00:00"),null);
 assert.equal(e.parseJapanDate("foo"),null);
});
test("default is off; settings sanitize thresholds and intervals",()=>{
 const v=e.normalizeNoticeSettings({});
 assert.equal(v.enabled,false);
 assert.equal(v.minScale,30);
 assert.equal(v.intervalSeconds,30);
 assert.deepEqual(v.history,[]);
 assert.equal(e.normalizeNoticeSettings({enabled:"yes",minScale:15,intervalSeconds:1}).enabled,false);
 assert.equal(e.normalizeNoticeSettings({enabled:true,minScale:45,intervalSeconds:30}).minScale,45);
});
test("seeds history without sending old reports at initial startup",()=>{
 const now=e.parseJapanDate("2026/11/24 01:00:30");
 const report=e.normalizeReport(quake());
 const seed=e.planNotices([report],{}, {seed:true,now});
 assert.deepEqual(seed.candidates,[]);
 assert.ok(seed.settings.seenIds.includes(report.id));
 const again=e.planNotices([report],seed.settings,{now:now+30000});
 assert.deepEqual(again.candidates,[]);
});
test("allows only fresh, threshold-matching, unseen reports",()=>{
 const now=e.parseJapanDate("2026/11/24 01:00:30");
 const newest=e.normalizeReport(quake("fresh-evt",40));
 const small=e.normalizeReport(quake("small-evt",20));
 const old=e.normalizeReport(quake("old-event",55,"2026/11/23 23:00:00"));
 const result=e.planNotices([newest,small,old],{minScale:30},{now});
 assert.deepEqual(result.candidates.map(x=>x.id),["fresh-evt"]);
 assert.equal(result.settings.seenIds.length,3);
 const again=e.planNotices([newest],result.settings,{now});
 assert.deepEqual(again.candidates,[]);
});
test("deduplicates revisions of the same quake by origin timestamp",()=>{
 const now=e.parseJapanDate("2026/11/24 01:00:30");
 const first=e.normalizeReport(quake("first-evt",40));
 const later=e.normalizeReport(quake("revision-evt",50,"2026/11/24 01:00:20.000"));
 const state=e.normalizeNoticeSettings({postedKeys:[first.key]});
 const result=e.planNotices([later],state,{now});
 assert.equal(result.candidates.length,0);
});
test("operator comment is informational, attributed and <=80 chars",()=>{
 const r=e.normalizeReport(quake());
 const text=e.makeOperatorComment(r);
 assert.match(text,/【地震情報】最大震度4/);
 assert.match(text,/震源:宮城県沖/);
 assert.match(text,/M5\.2/);
 assert.match(text,/00:57頃/);
 assert.match(text,/気象庁\/P2P地震情報/);
 assert.doesNotMatch(text,/緊急地震速報/);
 assert.ok(Array.from(text).length<=80);
});
test("very long place names never create an overlong or invalid comment",()=>{
 const q=quake();q.earthquake.hypocenter.name="日本のとてもながい震源地名称が入力されていても".repeat(5);
 const text=e.makeOperatorComment(e.normalizeReport(q));
 assert.ok(text&&Array.from(text).length<=80);
});
test("successful history query uses a fixed HTTPS endpoint without cookies",async()=>{
 let called=0;
 const result=await e.fetchEarthquakeReports({fetchImpl:async(url,options)=>{
  called++;assert.equal(url,"https://api.p2pquake.net/v2/history?codes=551&limit=10");
  assert.equal(options.method,"GET");
  assert.equal(options.redirect,"error");
  assert.equal(options.headers.Accept,"application/json");
  assert.equal(options.headers.Cookie,undefined);
  assert.equal(options.credentials,undefined);
  return {ok:true,status:200,url,headers:{get:()=>null},text:async()=>JSON.stringify([quake(),{code:556,id:"ignore",earthquake:{}}])};
 }});
 assert.equal(called,1);
 assert.equal(result.ok,true);
 assert.equal(result.reports.length,1);
});
test("network, HTTP, malformed JSON and oversized responses fail closed",async()=>{
 const cases=[
  async()=>{throw Error("secret transport");},
  async(url)=>({ok:false,status:503,url}),
  async(url)=>({ok:true,status:200,url,headers:{get:()=>null},text:async()=>"nonsense"}),
  async(url)=>({ok:true,status:200,url,headers:{get:()=>String(700000)},text:async()=>JSON.stringify([quake()])}),
  async(url)=>({ok:true,status:200,url:"https://evil.example/",headers:{get:()=>null},text:async()=>JSON.stringify([quake()])})
 ];
 for(const fetchImpl of cases){const result=await e.fetchEarthquakeReports({fetchImpl});assert.equal(result.ok,false);assert.deepEqual(result.reports,[]);assert.doesNotMatch(result.message,/secret transport/);}
});
test("history is bounded and does not leak arbitrary text",()=>{
 let settings=e.normalizeNoticeSettings({});
 for(let i=0;i<80;i++)settings=e.appendHistory(settings,{reportId:"report-"+i,scaleLabel:"4",programId:"lv123",status:"sent",message:"X".repeat(1000)});
 assert.equal(settings.history.length,40);
 assert.ok(settings.history.every(x=>x.message.length<=200));
});
