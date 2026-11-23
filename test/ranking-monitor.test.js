"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const ranking=require("../src/ranking-monitor");

const chikuwaHtml=`<!doctype html><html><body><ol class="ranking-list">
<li><span class="rank">1</span><a href="/watch/lv111111111"><strong>別の配信</strong></a><img alt="NCU_10001"><span>20 points</span><span>👨‍👨‍👦 80</span><span>💬 40</span></li>
<li><span class="rank">2</span><a href="/watch/lv222222222"><strong>自分の配信</strong></a><img alt="NCU_12345678"><span>150 points</span><span>👨‍👨‍👦 321</span><span>💬 654</span></li>
</ol></body></html>`;
const officialHtml=`<ol>
<li><a href="/watch/lv987654321">公式側の自分の配信</a></li>
<li><a href="/watch/lv111111111">別番組</a></li>
</ol>`;

test("defines exactly the three requested ranking sources",()=>{
 assert.deepEqual(ranking.SOURCES.map(x=>x.id),["chikuwa","nicoran","official"]);
 assert.equal(ranking.SOURCES.find(x=>x.id==="chikuwa").url,"https://www.chikuwachan.com/live/NCU/");
 assert.equal(ranking.SOURCES.find(x=>x.id==="nicoran").url,"https://nico-ran.stream/");
 assert.equal(ranking.SOURCES.find(x=>x.id==="official").url,"https://live.nicovideo.jp/ranking");
});
test("extracts the own rank from Chikuwa NCU user marker and metrics",()=>{
 const result=ranking.parseRankingPage(chikuwaHtml,"chikuwa",{userId:"12345678",programIds:["lv222222222"]});
 assert.equal(result.ok,true);
 assert.equal(result.status,"ranked");
 assert.equal(result.rank,2);
 assert.equal(result.title,"自分の配信");
 assert.equal(result.programId,"lv222222222");
 assert.equal(result.metrics.points,150);
 assert.equal(result.metrics.viewers,321);
 assert.equal(result.metrics.comments,654);
 assert.equal(result.matchType,"programId");
});
test("matches Chikuwa account by NCU user id when program id is absent",()=>{
 const result=ranking.parseRankingPage(chikuwaHtml,"chikuwa",{userId:"12345678",programIds:[]});
 assert.equal(result.status,"ranked");
 assert.equal(result.rank,2);
 assert.equal(result.matchType,"userId");
});
test("matches the official page by live program id",()=>{
 const result=ranking.parseRankingPage(officialHtml,"official",{userId:"12345678",programIds:["lv987654321"]});
 assert.equal(result.status,"ranked");
 assert.equal(result.rank,1);
 assert.equal(result.programId,"lv987654321");
});
test("uses the displayed list order if a ranking row has no explicit rank label",()=>{
 const html='<ul><li><a href="/watch/lv111111111">A</a></li><li><a href="/watch/lv222222222">B</a></li><li><a href="/watch/lv333333333">C</a></li></ul>';
 const result=ranking.parseRankingPage(html,"official",{userId:"123",programIds:["lv333333333"]});
 assert.equal(result.status,"ranked");
 assert.equal(result.rank,3);
});
test("supports ranking records embedded as JSON",()=>{
 const html='<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{ranking:[{rank:7,programId:"lv123456789",userId:"12345678",title:"JSON配信",points:90}]}}})+'</script>';
 const result=ranking.parseRankingPage(html,"nicoran",{userId:"12345678",programIds:["lv123456789"]});
 assert.equal(result.status,"ranked");
 assert.equal(result.rank,7);
 assert.equal(result.title,"JSON配信");
 assert.equal(result.metrics.points,90);
});
test("reports not-listed only after ranking rows were successfully parsed",()=>{
 const result=ranking.parseRankingPage(chikuwaHtml,"chikuwa",{userId:"99999999",programIds:["lv999999999"]});
 assert.equal(result.ok,true);
 assert.equal(result.status,"not-listed");
 assert.equal(result.entriesCount,2);
 assert.equal(result.rank,null);
});
test("reports parser failure separately from a genuine not-listed result",()=>{
 const result=ranking.parseRankingPage("<html><body>メンテナンス中</body></html>","official",{userId:"123",programIds:["lv123456789"]});
 assert.equal(result.ok,false);
 assert.equal(result.status,"parse-error");
});
test("normalizes NCU markers and user profile URLs",()=>{
 assert.equal(ranking.normalizeUserId("NCU_12345678"),"12345678");
 assert.equal(ranking.normalizeUserId("https://www.nicovideo.jp/user/12345678"),"12345678");
 assert.equal(ranking.normalizeProgramId("https://live.nicovideo.jp/watch/LV123456789"),"lv123456789");
});
test("normalizes ranking settings and keeps the monitor enabled by default",()=>{
 const state=ranking.normalizeRankingMonitorState({});
 assert.equal(state.enabled,true);
 assert.equal(state.intervalSeconds,60);
 assert.deepEqual(state.history,[]);
 assert.equal(ranking.normalizeRankingMonitorState({enabled:false,intervalSeconds:90}).enabled,false);
 assert.equal(ranking.normalizeRankingMonitorState({intervalSeconds:77}).intervalSeconds,60);
});
test("records rank movement and retains the best rank",()=>{
 let state=ranking.normalizeRankingMonitorState({});
 state=ranking.applyRankingSnapshot(state,{sourceId:"chikuwa",status:"ranked",rank:12,title:"配信",programId:"lv123456789",entriesCount:50,metrics:{} },"2026-11-23T00:00:00.000Z");
 state=ranking.applyRankingSnapshot(state,{sourceId:"chikuwa",status:"ranked",rank:8,title:"配信",programId:"lv123456789",entriesCount:50,metrics:{} },"2026-11-23T00:01:00.000Z");
 assert.equal(state.snapshots.chikuwa.rank,8);
 assert.equal(state.snapshots.chikuwa.bestRank,8);
 assert.equal(state.snapshots.chikuwa.previousRank,12);
 assert.equal(state.snapshots.chikuwa.delta,4);
 assert.equal(state.history.length,1);
 assert.equal(state.history[0].previousRank,12);
 assert.equal(state.history[0].rank,8);
});
test("does not erase the best rank when a broadcast leaves the visible list",()=>{
 let state=ranking.normalizeRankingMonitorState({});
 state=ranking.applyRankingSnapshot(state,{sourceId:"official",status:"ranked",rank:4,entriesCount:100},"2026-11-23T00:00:00.000Z");
 state=ranking.applyRankingSnapshot(state,{sourceId:"official",status:"not-listed",entriesCount:100},"2026-11-23T00:01:00.000Z");
 assert.equal(state.snapshots.official.status,"not-listed");
 assert.equal(state.snapshots.official.rank,null);
 assert.equal(state.snapshots.official.bestRank,4);
});
test("fetches all three sources without forwarding account cookies",async()=>{
 const calls=[];
 const result=await ranking.fetchOwnBroadcastRankings({
  userId:"12345678",programs:[{programId:"lv222222222",programStatus:"ON_AIR",title:"自分の配信"}]
 },{
  now:new Date("2026-11-23T00:00:00.000Z"),
  fetchImpl:async(url,options)=>{
   calls.push({url,options});
   return {ok:true,status:200,url,headers:{get:()=>String(chikuwaHtml.length)},text:async()=>chikuwaHtml};
  }
 });
 assert.equal(result.ok,true);
 assert.equal(result.status,"checked");
 assert.equal(result.results.length,3);
 assert.equal(calls.length,3);
 assert.ok(calls.every(call=>!Object.keys(call.options.headers).some(key=>key.toLowerCase()==="cookie")));
 assert.ok(calls.every(call=>!("credentials" in call.options)));
 assert.ok(calls.every(call=>!call.url.includes("12345678")));
});
test("keeps one ranking source failure independent of the other two",async()=>{
 const result=await ranking.fetchOwnBroadcastRankings({
  userId:"12345678",programs:[{programId:"lv222222222",programStatus:"ON_AIR"}]
 },{
  fetchImpl:async(url)=>{
   if(url.includes("nico-ran.stream"))return {ok:false,status:503,url,headers:{get:()=>null},text:async()=>""};
   return {ok:true,status:200,url,headers:{get:()=>null},text:async()=>chikuwaHtml};
  }
 });
 assert.equal(result.results.length,3);
 assert.equal(result.results.find(x=>x.sourceId==="nicoran").status,"unavailable");
 assert.equal(result.results.filter(x=>x.status==="ranked").length,2);
});
test("rejects a ranking page redirect to an unrelated origin",async()=>{
 const result=await ranking.fetchRankingSource("chikuwa",{userId:"12345678",programIds:["lv222222222"]},{
  fetchImpl:async(url)=>({ok:true,status:200,url:"https://evil.example/ranking",headers:{get:()=>null},text:async()=>chikuwaHtml})
 });
 assert.equal(result.status,"unavailable");
 assert.match(result.message,/転送/);
});
test("rejects unknown ranking sources",async()=>{
 const result=await ranking.fetchRankingSource("unknown",{userId:"1",programIds:[]},{fetchImpl:async()=>{throw Error("must not run");}});
 assert.equal(result.status,"unavailable");
});
test("does not request public rankings when the account has no live broadcast",async()=>{
 let calls=0;
 const result=await ranking.fetchOwnBroadcastRankings({userId:"12345678",programs:[{programId:"lv123456789",programStatus:"ENDED"}]},{fetchImpl:async()=>{calls++;}});
 assert.equal(result.ok,true);
 assert.equal(result.status,"not-live");
 assert.equal(result.results.every(x=>x.status==="not-live"),true);
 assert.equal(calls,0);
});
test("keeps page-size limits and handles network failures safely",async()=>{
 const large=await ranking.fetchRankingSource("official",{userId:"1",programIds:["lv123456789"]},{
  fetchImpl:async(url)=>({ok:true,status:200,url,headers:{get:()=>"7000000"},text:async()=>""})
 });
 assert.equal(large.status,"unavailable");
 const network=await ranking.fetchRankingSource("official",{userId:"1",programIds:["lv123456789"]},{
  fetchImpl:async()=>{throw Error("private transport detail");}
 });
 assert.equal(network.status,"unavailable");
 assert.doesNotMatch(network.message,/private transport detail/);
});
