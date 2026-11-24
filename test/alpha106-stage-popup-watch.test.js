"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {buildLiveWatchUrl,normalizeLiveViewMode,liveWatchZoomFactor}=require("../src/live-watch-mode");
const {calculateLivePageZoomFactor}=require("../src/live-page-zoom");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("popup uses only official host, selected program ID and fixed compact parameters",()=>{
 assert.equal(buildLiveWatchUrl("lv351880895"),"https://live.nicovideo.jp/watch/lv351880895?popup=on&screenmode=2");
 assert.equal(buildLiveWatchUrl("lv42","normal"),"https://live2.nicovideo.jp/watch/lv42");
 assert.equal(normalizeLiveViewMode("invalid"),"popup");
 for(const invalid of ["https://example.com/","lv1?x=2","lv1/evil",null])assert.throws(()=>buildLiveWatchUrl(invalid));
});
test("popup uses native viewport while normal and manual zoom remain unchanged",()=>{
 assert.equal(liveWatchZoomFactor(550,{},"popup",calculateLivePageZoomFactor),1);
 assert.equal(liveWatchZoomFactor(550,{},"normal",calculateLivePageZoomFactor),0.5);
 assert.equal(liveWatchZoomFactor(550,{zoomMode:"manual",zoomPercent:80},"popup",calculateLivePageZoomFactor),0.8);
});
test("saved display setting applies to all existing view open paths with no STAGE size switches",()=>{
 const r=read("src/renderer.js"),m=read("src/main.js"),p=read("src/preload.js");
 assert.equal((r.match(/openLiveVideo\((?:id|programId),state\.liveVideoDisplayMode\)/g)||[]).length,3);
 assert.match(r,/id="broadcast-video-display-mode"/);
 assert.match(r,/stored\?\.liveVideoDisplayMode==="normal"\?"normal":"popup"/);
 assert.doesNotMatch(r,/data-stage-window-fit/);
 assert.match(m,/session:niconicoSession/);
 assert.match(m,/const targetUrl = buildLiveWatchUrl\(programId,displayMode\)/);
 assert.match(p,/openLiveVideo:\(programId,mode\)=>ipcRenderer\.invoke\("niconico:live-view-open",programId,mode\)/);
});
