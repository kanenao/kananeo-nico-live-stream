"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");
const renderer=read("src/renderer.js");
const quick=read("src/broadcast-quick-tools.js");
const css=read("src/style.css");
const main=read("src/main.js");
const broadcast=renderer.slice(renderer.indexOf('}else if(page==="broadcast"){'),renderer.indexOf('}else if(page==="programs"){'));

test("on-air controls are first and video screen remains usable",()=>{
 const quickAt=broadcast.indexOf('class="broadcast-tools-section"');
 const connectionAt=broadcast.indexOf('class="broadcast-connection-details"');
 const stageAt=broadcast.indexOf('id="broadcast-stage"');
 assert.ok(quickAt>=0 && quickAt<connectionAt && connectionAt<stageAt);
 assert.equal((broadcast.match(/id="broadcast-quick-tools"/g)||[]).length,1);
 assert.match(broadcast,/broadcast-connection-details/);
 assert.match(broadcast,/data-live-video-open/);
 assert.match(broadcast,/data-broadcast-program-end/);
 assert.match(broadcast,/id="broadcast-comments-list"/);
});
test("video management can be expanded without blocking the live player",()=>{
 assert.match(quick,/broadcast-tool-requests-summary/);
 assert.match(quick,/data-quote-next/);
 assert.match(quick,/data-poll-start/);
 assert.match(quick,/data-quote-refresh/);
 assert.match(quick,/id="request-form"/);
 assert.match(renderer,/requestsExpanded=host\.querySelector/);
 assert.match(renderer,/requestsDetails\.open=requestsExpanded/);
});
test("STAGE restores the original alpha101 header, video and control placement",()=>{
 for(const token of [
  'class="broadcast-player-toolbar"', 'class="broadcast-player-title-block"',
  'broadcast-panel-kicker">STAGE / 01', 'class="broadcast-stage-visual"',
  'class="broadcast-stage-footer"', 'class="broadcast-player-body"',
  'data-stage-fullscreen', 'data-broadcast-program-end'
 ]) assert.ok(broadcast.includes(token),token);
 for(const token of [
  ".broadcast-player-toolbar{", ".broadcast-player-title-block{",
  ".broadcast-stage-visual{", ".broadcast-stage-footer{",
  "#broadcast-stage:fullscreen .broadcast-player-body"
 ]) assert.ok(css.includes(token),token);
 const latest=css.slice(css.lastIndexOf("/* Broadcast on-air tools and collapsible settings"));
 assert.doesNotMatch(latest,/\.broadcast-player-toolbar\s*\{|\.broadcast-stage-footer\s*\{|\.broadcast-player-title-block\s*\{|\.broadcast-stage-visual\s*,/);
 assert.doesNotMatch(latest,/aspect-ratio:16\/9/);
});
test("native Nico Live view retains original authenticated full watch page",()=>{
 assert.match(main,/new WebContentsView\(\{/);
 assert.match(main,/session:niconicoSession/);
 assert.match(main,/const targetUrl = NICONICO_WATCH_BASE \+ encodeURIComponent\(programId\)/);
 assert.match(main,/applyNiconicoLiveVideoZoom\(liveVideoView.getBounds\(\)\?\.width,liveVideoView.getBounds\(\)\?\.height\)/);
 assert.doesNotMatch(main,/buildNiconicoPlayerOnlyScript|kananeo-player-only-root/);
 assert.equal(fs.existsSync(path.join(root,"src/niconico-player-only.js")),false);
});
