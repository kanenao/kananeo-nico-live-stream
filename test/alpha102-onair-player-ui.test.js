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
test("stage visually prioritizes a clean player and an accessible controls row",()=>{
 for(const token of [
  ".broadcast-video-column>.broadcast-player-body",
  ".broadcast-player-title-block{display:none}",
  ".broadcast-stage-footer{display:none}",
  ".broadcast-stage-visual,.broadcast-stage-standby{display:none!important}",
  ".broadcast-tools-heading-actions",".broadcast-connection-details"
 ]) assert.ok(css.includes(token),token);
 assert.match(css,/aspect-ratio:16\/9/);
 assert.match(css,/#broadcast-stage:fullscreen \.broadcast-player-body/);
});
test("native Nico Live view keeps auth and switches to player-only when available",()=>{
 const {buildNiconicoPlayerOnlyScript}=require("../src/niconico-player-only");
 const script=buildNiconicoPlayerOnlyScript();
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(script,/querySelectorAll\("video"\)/);
 assert.match(script,/kananeo-player-only-root/);
 assert.match(script,/waiting-for-player/);
 assert.match(main,/buildNiconicoPlayerOnlyScript\(\)/);
 assert.match(main,/hostname === "live2\.nicovideo\.jp"/);
 assert.match(main,/new WebContentsView\(\{/);
 assert.match(main,/session:niconicoSession/);
 assert.doesNotMatch(script,/fetch\(|WebSocket\(|XMLHttpRequest\(/);
});
