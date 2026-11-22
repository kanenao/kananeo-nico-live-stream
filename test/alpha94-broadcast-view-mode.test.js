"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {MODES,DEFAULTS,normalizeBroadcastView,visiblePanes,layoutClass,canLoadSecondView}=require("../src/broadcast-view-mode");
test("workspace settings default to side-by-side and normalize saved values",()=>{
 assert.deepEqual(normalizeBroadcastView(undefined),DEFAULTS);
 assert.equal(normalizeBroadcastView({mode:"wide",videoShare:77}).videoShare,78);
 assert.equal(normalizeBroadcastView({mode:"invalid",videoShare:999}).mode,"split");
 assert.equal(normalizeBroadcastView({videoShare:-5}).videoShare,50);
 assert.equal(normalizeBroadcastView({videoShare:"garbage"}).videoShare,60);
 assert.equal(normalizeBroadcastView({theater:"true",secondaryAudio:"true"}).theater,false);
 assert.equal(normalizeBroadcastView({theater:true,secondaryAudio:true}).secondaryAudio,true);
 assert.equal(normalizeBroadcastView({secondaryProgramId:"LV123"}).secondaryProgramId,"lv123");
 assert.equal(normalizeBroadcastView({secondaryProgramId:"javascript:alert(1)"}).secondaryProgramId,"");
 assert.deepEqual(MODES,["split","wide","video","dual"]);
});
test("solo video hides comments, dual shows secondary, both keep main video",()=>{
 assert.deepEqual(visiblePanes({mode:"split"}),{main:true,secondary:false,comments:true});
 assert.deepEqual(visiblePanes({mode:"wide"}),{main:true,secondary:false,comments:true});
 assert.deepEqual(visiblePanes({mode:"video"}),{main:true,secondary:false,comments:false});
 assert.deepEqual(visiblePanes({mode:"dual"}),{main:true,secondary:true,comments:true});
 assert.equal(layoutClass({mode:"dual"}),"broadcast-live-layout broadcast-mode-dual");
});
test("secondary video accepts only trusted NicoNico watch URLs or IDs",()=>{
 assert.equal(canLoadSecondView("lv123"),"lv123");
 assert.equal(canLoadSecondView("LV999"),"lv999");
 assert.equal(canLoadSecondView("https://live.nicovideo.jp/watch/lv122"),"lv122");
 assert.equal(canLoadSecondView("https://live2.nicovideo.jp/watch/lv9"),"lv9");
 for(const v of ["https://evil.example/watch/lv123","http://live.nicovideo.jp/watch/lv123",
  "https://live2.nicovideo.jp/watch/lv1/other","javascript:alert(1)",
  "https://live.nicovideo.jp.evil.example/watch/lv123","sm123","https://live.nicovideo.jp/"]) {
  assert.equal(canLoadSecondView(v),"",v);
 }
});
