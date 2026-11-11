"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  extractNiconicoListId,
  buildNiconicoLibraryRequest,
  parseNiconicoLibraryResponse
}=require("../src/niconico-library-api");

test("extracts mylist IDs from supported URLs and rejects unsafe domains",()=>{
  assert.equal(extractNiconicoListId("https://www.nicovideo.jp/mylist/123456","mylist"),"123456");
  assert.equal(extractNiconicoListId("https://www.nicovideo.jp/user/777/mylist/123456","mylist"),"123456");
  assert.equal(extractNiconicoListId("https://www.nicovideo.jp/my/mylist/#/123456","mylist"),"123456");
  assert.equal(extractNiconicoListId("https://evil.example/mylist/123456","mylist"),"");
});

test("extracts series IDs and validates list type",()=>{
  assert.equal(extractNiconicoListId("https://www.nicovideo.jp/series/98765","series"),"98765");
  assert.equal(buildNiconicoLibraryRequest("series",{listId:"98765"}).url,"https://nvapi.nicovideo.jp/v2/series/98765?pageSize=500");
  assert.equal(buildNiconicoLibraryRequest("bad",{listId:"1"}).code,"UNSUPPORTED_LIST_TYPE");
});

test("builds watch-later and private-mylist fallback requests",()=>{
  const watch=buildNiconicoLibraryRequest("watch-later",{page:2});
  assert.equal(watch.page,2);
  assert.match(watch.url,/watch-later\?.*page=2/);
  const mylist=buildNiconicoLibraryRequest("mylist",{listId:"123"});
  assert.equal(mylist.url,"https://nvapi.nicovideo.jp/v2/mylists/123?pageSize=500&page=1");
  assert.equal(mylist.fallbackUrl,"https://nvapi.nicovideo.jp/v1/users/me/mylists/123?pageSize=500&page=1");
});

test("builds mylist page two and expanded series page-size requests",()=>{
  const mylist=buildNiconicoLibraryRequest("mylist",{listId:"123",page:2});
  assert.equal(mylist.page,2);
  assert.match(mylist.url,/pageSize=500&page=2$/);
  const series=buildNiconicoLibraryRequest("series",{listId:"987",pageSize:1000});
  assert.match(series.url,/pageSize=1000$/);
});

test("parses watch-later and mylist shapes into normalized video rows",()=>{
  const watch=parseNiconicoLibraryResponse(JSON.stringify({meta:{status:200},data:{watchLater:{name:"あとで見る",items:[
    {watchId:"sm123",video:{title:"動画A",duration:125}},
    {watchId:"nm456",title:"動画B"}
  ]}}}),"watch-later");
  assert.equal(watch.ok,true);
  assert.equal(watch.listTitle,"あとで見る");
  assert.equal(watch.entries.length,2);
  assert.equal(watch.entries[0].lengthMs,125000);
  const mylist=parseNiconicoLibraryResponse(JSON.stringify({meta:{status:200},data:{mylist:{name:"お気に入り",items:[
    {video:{id:"so789",title:"動画C",duration:10}}
  ]}}}),"mylist");
  assert.equal(mylist.entries[0].videoId,"so789");
});

test("marks watch-later pages that reached the page-size limit",()=>{
  const items=Array.from({length:100},(_,index)=>({watchId:"sm"+(10000+index),video:{title:"Video "+index}}));
  const watch=parseNiconicoLibraryResponse(JSON.stringify({meta:{status:200},data:{watchLater:{items}}}),"watch-later");
  const mylist=parseNiconicoLibraryResponse(JSON.stringify({meta:{status:200},data:{mylist:{items}}}),"mylist");
  assert.equal(watch.entries.length,100);
  assert.equal(watch.hasMore,true);
  assert.equal(mylist.hasMore,false);
});

test("normalizes selected source metadata from list responses",()=>{
  const result=parseNiconicoLibraryResponse(JSON.stringify({meta:{status:200},data:{series:{name:"作品シリーズ",items:[
    {video:{id:"sm2026",title:"選択候補",duration:60}}
  ]}}}),"series");
  assert.equal(result.listTitle,"作品シリーズ");
  assert.equal(result.entries[0].source,"series");
  assert.equal(result.entries[0].lengthMs,60000);
});

test("parses mylist pagination metadata and series total count",()=>{
  const mylist=parseNiconicoLibraryResponse(JSON.stringify({data:{mylist:{
    totalItemCount:1200,hasNext:true,items:[{watchId:"sm501"}]
  }}}),"mylist");
  assert.equal(mylist.totalCount,1200);
  assert.equal(mylist.hasMore,true);
  const series=parseNiconicoLibraryResponse(JSON.stringify({data:{totalCount:900,items:[
    {video:{id:"sm502",title:"Series item"}}
  ]}}),"series");
  assert.equal(series.totalCount,900);
  assert.equal(series.hasMore,true);
});

test("rejects malformed and API error responses",()=>{
  assert.equal(parseNiconicoLibraryResponse("{broken","watch-later").code,"INVALID_RESPONSE");
  assert.equal(parseNiconicoLibraryResponse(JSON.stringify({meta:{status:403,errorCode:"FORBIDDEN"}}),"mylist").code,"FORBIDDEN");
});

test("skips duplicate and unrecognized list items",()=>{
  const result=parseNiconicoLibraryResponse(JSON.stringify({data:{series:{items:[
    {video:{id:"sm123",title:"A"}},
    {video:{id:"sm123",title:"A duplicate"}},
    {id:"not-a-video"}
  ]}}}),"series");
  assert.equal(result.entries.length,1);
  assert.equal(result.skippedCount,2);
});
