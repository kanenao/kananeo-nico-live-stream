"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {releaseHistorySummary,releaseHistoryEntries,historyType,readableDate}=require("./release-history-ui");

test("summary distinguishes installed version from verified public release",()=>{
 const state={items:[{version:"0.2.9-alpha.87",tag:"v0.2.9-alpha.87"}]};
 const html=releaseHistorySummary(state,"0.2.9-alpha.86",
  {result:{ok:true,updateAvailable:true,latestVersion:"0.2.9-alpha.87"}},{supported:true,phase:"idle"});
 assert.match(html,/現在のバージョン/);
 assert.match(html,/0\.2\.9-alpha\.86/);
 assert.match(html,/0\.2\.9-alpha\.87/);
 assert.match(html,/新しいバージョンがあります/);
 assert.match(html,/data-update-auto-check/);
 assert.doesNotMatch(html,/data-update-auto-apply/);
});
test("unverified or offline history never claims the installed app is up to date",()=>{
 const html=releaseHistorySummary({offline:true,items:[{version:"1.0.0",localOnly:true}]},"0.2.9-alpha.86",
  {loading:false,result:null},{phase:"idle"});
 assert.match(html,/公開版は未確認/);
 assert.match(html,/更新状況を確認中/);
 assert.doesNotMatch(html,/現在の版は最新です/);
});
test("downloaded, downloading and error states stay distinct",()=>{
 const empty={items:[]};
 assert.match(releaseHistorySummary(empty,"1.0.0",{}, {phase:"downloaded",supported:true}),/data-update-auto-apply/);
 assert.match(releaseHistorySummary(empty,"1.0.0",{}, {phase:"downloading",percent:34}),/34%/);
 assert.match(releaseHistorySummary(empty,"1.0.0",{}, {phase:"error",message:"HTTP 404"}),/HTTP 404/);
});
test("release note cards show overview, details and installed marker",()=>{
 const state={type:"all",items:[{version:"0.2.9-alpha.86",tag:"v0.2.9-alpha.86",publishedAt:"2026-11-21T12:00:00Z",setupAvailable:true,
  title:"修正と改善",notes:["新しい機能を追加","自動更新を改善"],details:["取得のエラーを修正"]}]};
 const r=releaseHistoryEntries(state,"0.2.9-alpha.86");
 assert.equal(r.count,1);
 assert.match(r.markup,/使用中/);
 assert.match(r.markup,/取得履歴の先頭/);
 assert.match(r.markup,/すべての変更内容を見る（3項目）/);
 assert.match(r.markup,/<details/);
 assert.match(r.markup,/Windows Setupあり/);
});
test("search and release-type filters work together",()=>{
 const state={type:"alpha",query:"自動更新",items:[
  {version:"0.2.9-alpha.86",tag:"a",notes:["自動更新改善"]},
  {version:"0.2.9-beta.85",tag:"b",notes:["自動更新改善"]},
  {version:"0.2.9-alpha.84",tag:"c",notes:["音声改善"]}
 ]};
 const r=releaseHistoryEntries(state,"");
 assert.equal(r.count,1);
 assert.match(r.markup,/alpha\.86/);
 assert.doesNotMatch(r.markup,/beta\.85/);
});
test("untrusted release notes and tag attributes are HTML escaped",()=>{
 const r=releaseHistoryEntries({items:[{
  version:'<script>alert(1)</script>',tag:'bad" onclick="alert(2)',
  notes:['<img src=x onerror=alert(3)>'],details:["<b>untrusted</b>"]
 }]});
 assert.doesNotMatch(r.markup,/<script|<img|onclick="alert\(2\)|<b>untrusted/);
 assert.match(r.markup,/&lt;script&gt;/);
 assert.match(r.markup,/&quot;/);
});
test("invalid dates and missing notes have readable fallbacks",()=>{
 assert.equal(readableDate("not-a-date"),"公開日未確認");
 assert.equal(historyType("0.2.0-alpha.123"),"alpha");
 assert.equal(historyType("0.2.0-beta.123"),"beta");
 const r=releaseHistoryEntries({items:[{version:"0.2.0-alpha.1",tag:"a"}]});
 assert.match(r.markup,/変更内容の詳細は登録されていません/);
});
