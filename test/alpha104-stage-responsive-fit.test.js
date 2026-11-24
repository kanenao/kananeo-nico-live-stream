"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const renderer=read("src/renderer.js");
const css=read("src/style.css");
const main=read("src/main.js");
const {calculateLivePageZoomFactor}=require("../src/live-page-zoom");
const broadcast=renderer.slice(renderer.indexOf('}else if(page==="broadcast"){'),renderer.indexOf('}else if(page==="programs"){'));

test("STAGE keeps alpha101 controls and adds explicit window and monitor fitting",()=>{
 for(const selector of [
   'broadcast-panel-kicker">STAGE / 01','data-live-video-open',
   'data-live-video-mute','data-live-video-reload','data-live-video-close',
   'data-broadcast-program-end','data-stage-window-fit','data-stage-fullscreen',
   'id="broadcast-video-slot"','id="broadcast-comments-list"'
 ])assert.ok(broadcast.includes(selector),selector);
 assert.match(broadcast,/ウィンドウ/);
 assert.match(broadcast,/全画面/);
 assert.match(renderer,/function setStageWindowFit\(\)/);
 assert.match(renderer,/state\.liveStageSizeMode=fit\?"window":"normal"/);
 assert.match(renderer,/state\.liveStageSizeMode!=="window"\)toggleStageFullscreen\(true\)/);
 assert.match(renderer,/document\.getElementById\("broadcast-screen-layout"\)\?\.classList\.toggle\("is-stage-window-fit"/);
});
test("saved STAGE fit preference is bounded and does not change the original default",()=>{
 assert.match(renderer,/liveStageSizeMode:"normal"/);
 assert.match(renderer,/stored\?\.liveStageSizeMode==="window"\?"window":"normal"/);
 assert.match(renderer,/if\(page==="broadcast"\)document\.getElementById\("broadcast-screen-layout"\)/);
 assert.match(renderer,/aria-pressed/);
});
test("window STAGE fills available application viewport while fullscreen retains controls",()=>{
 assert.match(css,/\.broadcast-screen-layout\.is-stage-window-fit\{/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/height:clamp\(290px,calc\(100dvh - 180px\),1600px\)/);
 assert.match(css,/#broadcast-stage:fullscreen \.broadcast-player-body/);
 assert.match(css,/\.broadcast-stage-window-fit\[aria-pressed="true"\]/);
 assert.doesNotMatch(css,/\.broadcast-player-title-block\{display:none\}/);
});
test("resizing the stage updates the native official watch view without rebuilding it",()=>{
 assert.match(renderer,/new ResizeObserver\(\(\)=>requestAnimationFrame\(updateLiveVideoBounds\)\)/);
 assert.match(renderer,/liveVideoSlotObserver\.disconnect\(\)/);
 assert.match(renderer,/const rect=slot\.getBoundingClientRect\(\)/);
 assert.match(renderer,/api\.setLiveVideoBounds\?\.\(bounds\)/);
 assert.match(main,/session:niconicoSession/);
 assert.match(main,/NICONICO_WATCH_BASE \+ encodeURIComponent\(programId\)/);
 assert.doesNotMatch(main,/buildNiconicoPlayerOnlyScript|executeJavaScript\(buildNiconicoPlayerOnlyScript/);
});
test("automatic zoom respects both width and height while manual zoom remains user-controlled",()=>{
 assert.equal(calculateLivePageZoomFactor(1100,undefined,360),0.5);
 assert.equal(calculateLivePageZoomFactor(550,undefined,720),0.5);
 assert.equal(calculateLivePageZoomFactor(1920,undefined,1080),1);
 assert.equal(calculateLivePageZoomFactor(1100,{zoomMode:"manual",zoomPercent:75},360),0.75);
 assert.equal(calculateLivePageZoomFactor(770),0.7);
 assert.match(main,/calculateLivePageZoomFactor\(width,liveVideoZoomSettings,height\)/);
 assert.match(main,/applyNiconicoLiveVideoZoom\(bounds\.width,bounds\.height\)/);
});
