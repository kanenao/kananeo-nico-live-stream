"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {PAGE_SIZE,releaseHistoryUrl,summarizeReleaseNotes,normalizeHistoryRelease,normalizeHistoryPage}=require("../src/release-history");
test("accepts only verified project release tags as external links",()=>{
 assert.equal(releaseHistoryUrl("v0.2.0-alpha.65"),"https://github.com/kanenao/kananeo-nico-live-stream/releases/tag/v0.2.0-alpha.65");
 assert.equal(releaseHistoryUrl("1.0.0"),"https://github.com/kanenao/kananeo-nico-live-stream/releases/tag/1.0.0");
 assert.equal(releaseHistoryUrl("../../evil"),"");
 assert.equal(releaseHistoryUrl("https://evil.example"),"");
});
test("preserves actual release note bullets without generic text or external PR URLs",()=>{
 const body="開発中のα版です。\n\n## What's Changed\n* 新しい機能を追加 by @author in https://github.com/project/pull/3\n- 不具合修正\n**Full Changelog**: https://github.com/project/compare";
 assert.deepEqual(summarizeReleaseNotes(body),["新しい機能を追加","不具合修正"]);
});
test("never manufactures missing release details and filters drafts",()=>{
 assert.equal(normalizeHistoryRelease({tag_name:"v0.2.0-alpha.58",body:"**Full Changelog**: https://github.com/compare"}).noteAvailable,false);
 assert.equal(normalizeHistoryRelease({tag_name:"v1.0.0",draft:true}),null);
 assert.equal(normalizeHistoryRelease({tag_name:"evil"}),null);
});
test("normalizes version, published date, artifacts and multi-page history",()=>{
 const row={tag_name:"v0.2.0-alpha.65",name:"Alpha 65",published_at:"2026-11-16T11:54:01Z",assets:[{name:"kananeo.nico.live.stream-0.2.0-alpha.65-Setup-x64.exe"}],body:"* 自動更新を改善"};
 const result=normalizeHistoryPage([row,row],1);
 assert.equal(result.items.length,1);assert.equal(result.items[0].notes[0],"自動更新を改善");
 assert.equal(result.items[0].setupAvailable,true);
 assert.equal(result.items[0].portableAvailable,false);
 assert.equal(normalizeHistoryPage(Array.from({length:PAGE_SIZE},()=>row),2).hasMore,true);
 assert.equal(normalizeHistoryPage([],21).ok,false);
});
