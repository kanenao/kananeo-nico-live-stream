"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  createEmptyVideoLibrary,
  normalizeVideoEntry,
  normalizeVideoLibrary,
  mergeVideoEntries,
  addPlaybackHistory,
  mergeVideoHistory,
  prepareSelectedVideoEntries,
  removeVideoEntry,
  updateVideoEntry,
  clearVideoHistory,
  filterVideoEntries,
  parseVideoImportText
}=require("../src/video-library");

test("normalizes valid video entries and rejects unsafe URLs",()=>{
  const entry=normalizeVideoEntry({videoId:"SM123",title:"テスト",duration:120,tags:["音楽","音楽","歌ってみた"]});
  assert.equal(entry.videoId,"sm123");
  assert.equal(entry.url,"https://www.nicovideo.jp/watch/sm123");
  assert.equal(entry.lengthMs,120000);
  assert.deepEqual(entry.tags,["音楽","歌ってみた"]);
  assert.equal(normalizeVideoEntry({url:"https://example.com/watch/sm123"}),null);
});

test("normalizes database snapshots and removes duplicate IDs",()=>{
  const result=normalizeVideoLibrary({items:[
    {videoId:"sm1",title:"A"},
    {videoId:"sm1",title:"Duplicate"},
    {videoId:"invalid"}
  ],history:[]});
  assert.equal(result.version,1);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].title,"A");
});

test("merges imported videos without duplicating existing entries",()=>{
  const existing={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm1",title:"Existing",tags:["A"]})]};
  const merged=mergeVideoEntries(existing,[
    {videoId:"sm1",title:"New title",lengthMs:45000,tags:["B"]},
    {videoId:"nm2",title:"New"}
  ],{now:"2026-11-11T00:00:00.000Z"});
  assert.equal(merged.added,1);
  assert.equal(merged.total,2);
  assert.deepEqual(merged.library.items.find(x=>x.videoId==="sm1").tags,["A","B"]);
  assert.equal(merged.library.items.find(x=>x.videoId==="sm1").title,"Existing");
});

test("records preview and quotation history and increments library play count",()=>{
  const existing={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm1",title:"A"})]};
  const result=addPlaybackHistory(existing,{videoId:"sm1",title:"A",queueType:"request",playbackType:"quotation",playedAt:"2026-11-11T12:00:00.000Z"});
  assert.equal(result.ok,true);
  assert.equal(result.library.history.length,1);
  assert.equal(result.library.history[0].playbackType,"quotation");
  assert.equal(result.library.items[0].playCount,1);
});

test("keeps history for videos not saved in the library",()=>{
  const result=addPlaybackHistory(createEmptyVideoLibrary(),{videoId:"nm2",title:"Outside library"});
  assert.equal(result.ok,true);
  assert.equal(result.library.items.length,0);
  assert.equal(result.library.history.length,1);
});

test("removes library items without deleting playback history",()=>{
  const library={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm1"})]};
  const played=addPlaybackHistory(library,{videoId:"sm1"});
  const removed=removeVideoEntry(played.library,"sm1");
  assert.equal(removed.removed,true);
  assert.equal(removed.library.items.length,0);
  assert.equal(removed.library.history.length,1);
});

test("prepares selected list entries and forces a trusted source label",()=>{
  const result=prepareSelectedVideoEntries([
    {videoId:"sm501",title:"Selected",source:"manual"},
    {videoId:"invalid",title:"Bad"}
  ],"mylist");
  assert.equal(result.ok,true);
  assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].source,"mylist");
  assert.equal(result.skipped,1);
});

test("rejects empty, oversized, and unsupported selected imports",()=>{
  assert.equal(prepareSelectedVideoEntries([],"mylist").code,"INVALID_SELECTION");
  assert.equal(prepareSelectedVideoEntries([{videoId:"sm1"}],"other").code,"INVALID_SOURCE");
  assert.equal(prepareSelectedVideoEntries(Array.from({length:1001},(_,i)=>({videoId:"sm"+(i+1)})),"series").code,"INVALID_SELECTION");
});

test("updates a saved video's title, tags, memo, and timestamp",()=>{
  const library={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm88",title:"Before",tags:["old"],memo:"old memo",source:"watch-later",playCount:8,createdAt:"2026-01-01T00:00:00.000Z"})]};
  const result=updateVideoEntry(library,"sm88",{title:"After",tags:"music, live, music",memo:"updated note"},{now:"2026-11-12T00:00:00.000Z"});
  assert.equal(result.ok,true);
  assert.equal(result.item.title,"After");
  assert.deepEqual(result.item.tags,["music","live"]);
  assert.equal(result.item.memo,"updated note");
  assert.equal(result.item.createdAt,"2026-01-01T00:00:00.000Z");
  assert.equal(result.item.source,"watch-later");
  assert.equal(result.item.playCount,8);
  assert.equal(result.item.updatedAt,"2026-11-12T00:00:00.000Z");
});

test("rejects editing a missing video without changing the library",()=>{
  const library={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm88"})]};
  const result=updateVideoEntry(library,"sm99",{title:"Missing"});
  assert.equal(result.ok,false);
  assert.equal(result.code,"VIDEO_NOT_FOUND");
  assert.equal(result.library.items.length,1);
});

test("clears history independently from library items",()=>{
  const library={...createEmptyVideoLibrary(),items:[normalizeVideoEntry({videoId:"sm1"})],history:[{videoId:"sm1",playedAt:"2026-01-01T00:00:00.000Z"}]};
  const cleared=clearVideoHistory(library);
  assert.equal(cleared.items.length,1);
  assert.equal(cleared.history.length,0);
});

test("filters and sorts library entries",()=>{
  const items=[
    normalizeVideoEntry({videoId:"sm1",title:"初音ミク",tags:["音楽"],createdAt:"2026-01-01T00:00:00.000Z",playCount:1}),
    normalizeVideoEntry({videoId:"nm2",title:"料理",tags:["料理"],createdAt:"2026-02-01T00:00:00.000Z",playCount:8})
  ];
  assert.equal(filterVideoEntries(items,{query:"ミク"}).length,1);
  assert.equal(filterVideoEntries(items,{source:"manual"}).length,2);
  assert.equal(filterVideoEntries(items,{sort:"played"})[0].videoId,"nm2");
});

test("imports standalone IDs, NicoNico URLs, optional titles, and JSON exports",()=>{
  const parsed=parseVideoImportText("sm12345678\n歌ってみた, nm987654\nhttps://www.nicovideo.jp/watch/so12345");
  assert.equal(parsed.ok,true);
  assert.equal(parsed.entries.length,3);
  assert.equal(parsed.entries[1].title,"歌ってみた");
  const json=parseVideoImportText(JSON.stringify({items:[{videoId:"sm42",title:"JSON動画"}]}));
  assert.equal(json.entries[0].videoId,"sm42");
});

test("imports deduplicated playback history from a full library JSON backup",()=>{
  const backup={
    items:[{videoId:"sm77",title:"Backup video"}],
    history:[
      {id:"h-1",videoId:"sm77",title:"Backup video",playedAt:"2026-11-10T12:00:00.000Z",playbackType:"quotation"},
      {id:"h-1",videoId:"sm77",title:"Duplicate history",playedAt:"2026-11-10T12:00:00.000Z"}
    ]
  };
  const parsed=parseVideoImportText(JSON.stringify(backup));
  assert.equal(parsed.entries.length,1);
  assert.equal(parsed.history.length,2);
  const merged=mergeVideoHistory(createEmptyVideoLibrary(),parsed.history);
  assert.equal(merged.addedHistory,1);
  assert.equal(merged.library.history[0].id,"h-1");
});

test("rejects invalid import data and skips malformed lines",()=>{
  const invalid=parseVideoImportText("not a video\nhttps://example.com/watch/sm123");
  assert.equal(invalid.ok,false);
  assert.equal(invalid.skipped,2);
  assert.equal(parseVideoImportText("x".repeat(17*1024*1024)).code,"INVALID_IMPORT_TEXT");
});
