"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const renderer=read("src/renderer.js"),main=read("src/main.js"),preload=read("src/preload.js");
const html=read("src/index.html"),style=read("src/style.css"),quick=read("src/broadcast-quick-tools.js");
test("the canceled multi-view implementation remains removed",()=>{
 for(const source of [renderer,main,preload,html,style]){
  assert.doesNotMatch(source,/secondLiveVideo|second-live-view|SecondLiveVideo|broadcast-view-mode|broadcast-view-ratio|KananeoBroadcastView/);
 }
 assert.equal(fs.existsSync(path.join(root,"src/broadcast-view-mode.js")),false);
 assert.equal(fs.existsSync(path.join(root,"test/alpha94-broadcast-view-mode.test.js")),false);
 assert.equal(fs.existsSync(path.join(root,"test/alpha94-broadcast-multiview-wiring.test.js")),false);
});
test("broadcast screen uses an original compact control-desk layout",()=>{
 for(const marker of ['class="broadcast-console-head"','class="broadcast-connection-grid"',
  'class="broadcast-video-column"','class="broadcast-comments-panel"',
  'id="broadcast-video-slot" class="broadcast-video-slot"',
  'id="broadcast-comments-list" class="ncv-comment-list"',
  'class="broadcast-comment-composer"','id="broadcast-quick-tools"'])
  assert.ok(renderer.includes(marker),marker);
 assert.match(style,/\.broadcast-screen-layout\{\s*display:grid;grid-template-columns:minmax\(0,1\.5fr\) minmax\(320px,1fr\)/);
 assert.match(style,/height:clamp\(280px,38vh,430px\)/);
 assert.match(style,/\.content\.broadcast-screen-content\{[^}]*height:auto;display:block;overflow:visible/);
 assert.doesNotMatch(renderer,/broadcast-management-drawer/);
 assert.match(renderer,/class="broadcast-tools-section"/);
});
test("account, player setup and program verification remain visible",()=>{
 for(const selector of ["auth-status","data-nico-login","data-nico-refresh","data-nico-logout",
  "broadcast-watch-id","broadcast-video-zoom","broadcast-live-message","live-id","data-nico-check","program-result"])
  assert.ok(renderer.includes(selector),selector);
});
test("all main broadcast actions remain available without opening an advanced drawer",()=>{
 for(const selector of ["data-live-video-open","data-live-video-close","data-live-video-reload","data-live-video-mute",
  "data-broadcast-comment-start","data-broadcast-comment-stop","data-broadcast-ng-toggle",
  "data-broadcast-comment-clear","data-broadcast-comments-copy","data-broadcast-comment-clear-user",
  "broadcast-comment-type","broadcast-comment-search","data-broadcast-font-decrease","data-broadcast-font-increase"])
  assert.ok(renderer.includes(selector),selector);
 for(const selector of ["data-poll-start","data-poll-stop","poll-auto-on-quote","data-quote-refresh",
  "broadcast-quote-time","data-quote-next","request-form","data-quote-request","data-broadcast-library-request",
  'data-go="requests"','data-go="library"'])
  assert.ok(quick.includes(selector),selector);
 assert.match(quick,/pending\.slice\(0,3\)/);
 assert.match(quick,/list\.slice\(0,3\)/);
});
test("comment filtering, read markers, NG and display customization remain wired",()=>{
 assert.match(renderer,/broadcastCommentClearIndex/);
 assert.match(renderer,/index<broadcastCommentClearIndex/);
 assert.match(renderer,/state\.ngUsers\.some/);
 assert.match(renderer,/state\.ngWords\.some/);
 assert.match(renderer,/data-broadcast-user/);
 assert.match(renderer,/data-broadcast-read-through/);
 assert.match(renderer,/--broadcast-comment-font-size/);
 assert.match(style,/font-size:var\(--broadcast-comment-font-size,12px\)/);
 assert.match(renderer,/class="broadcast-comment-item/);
});
test("player toolbar actions are wired to the single native view",()=>{
 for(const selector of ["data-live-video-open","data-live-video-close","data-live-video-reload","data-live-video-mute"])
  assert.ok(renderer.includes(selector),selector);
 assert.match(renderer,/setLiveVideoAudio\(enabled\)/);
 assert.match(renderer,/reloadLiveVideo\(\)/);
 assert.match(main,/function setNiconicoLiveVideoAudio\(enabled\)/);
 assert.match(main,/function reloadNiconicoLiveVideo\(\)/);
 assert.match(main,/ipcMain\.handle\("niconico:live-view-audio"/);
 assert.match(main,/ipcMain\.handle\("niconico:live-view-reload"/);
 assert.match(main,/event\.sender!==mainWindow\?\.webContents/);
 assert.match(preload,/setLiveVideoAudio:enabled=>ipcRenderer\.invoke\("niconico:live-view-audio"/);
 assert.match(preload,/reloadLiveVideo:\(\)=>ipcRenderer\.invoke\("niconico:live-view-reload"/);
});
test("broadcaster composer remains login-gated and uses the existing API",()=>{
 assert.match(renderer,/!nicoStatus\.authenticated\|\|broadcastCommentSending\?"disabled":""/);
 assert.match(renderer,/ログインするとコメントできます/);
 assert.match(renderer,/postBroadcasterComment\(\{programId,text\}\)/);
 assert.match(renderer,/Array\.from\(text\)\.length>200/);
 assert.match(preload,/postBroadcasterComment:input=>ipcRenderer\.invoke\("niconico:post-broadcaster-comment"/);
 assert.match(main,/input\.text\.length>200/);
 assert.match(main,/ニコニコ公式ログインが必要です/);
 assert.match(main,/番組が放送中ではないため運営コメントを送信しませんでした/);
});
