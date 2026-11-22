"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const renderer=read("src/renderer.js"),main=read("src/main.js"),preload=read("src/preload.js");
const html=read("src/index.html"),style=read("src/style.css");
test("the canceled multi-view implementation is removed from the app",()=>{
 for(const source of [renderer,main,preload,html,style]){
  assert.doesNotMatch(source,/secondLiveVideo|second-live-view|SecondLiveVideo|broadcast-view-mode|broadcast-view-ratio|KananeoBroadcastView/);
 }
 assert.equal(fs.existsSync(path.join(root,"src/broadcast-view-mode.js")),false);
 assert.equal(fs.existsSync(path.join(root,"test/alpha94-broadcast-view-mode.test.js")),false);
 assert.equal(fs.existsSync(path.join(root,"test/alpha94-broadcast-multiview-wiring.test.js")),false);
});
test("broadcast page has a single large player on the left and a separate comment panel on the right",()=>{
 assert.match(renderer,/class="broadcast-screen-layout"/);
 assert.match(renderer,/class="broadcast-video-column"/);
 assert.match(renderer,/class="broadcast-player-toolbar"/);
 assert.match(renderer,/id="broadcast-video-slot" class="broadcast-video-slot"/);
 assert.match(renderer,/class="broadcast-comments-panel"/);
 assert.match(renderer,/id="broadcast-comments-list" class="ncv-comment-list"/);
 assert.match(renderer,/class="broadcast-comment-composer"/);
 assert.match(renderer,/id="broadcast-comment-send-form"/);
 assert.match(renderer,/id="broadcast-comment-send-input"/);
 assert.match(renderer,/classList\.toggle\("broadcast-screen-content",page==="broadcast"\)/);
 assert.match(style,/\.broadcast-screen-layout\{[^}]*grid-template-columns:minmax\(0,1\.96fr\) minmax\(330px,1fr\)/);
 assert.match(style,/\.broadcast-player-body\{flex:1;min-height:0/);
 assert.match(style,/\.ncv-comment-list\{\s*flex:1;min-height:0;height:auto/);
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
test("comment toolbar supports search, font size, connection, clear and NG filtering",()=>{
 for(const selector of ["broadcast-comment-search","data-broadcast-font-decrease","data-broadcast-font-increase",
  "broadcast-comment-status","data-broadcast-comment-stop","data-broadcast-comment-clear","data-broadcast-ng-toggle"])
  assert.ok(renderer.includes(selector),selector);
 assert.match(renderer,/broadcastCommentClearIndex/);
 assert.match(renderer,/index<broadcastCommentClearIndex/);
 assert.match(renderer,/state\.ngUsers\.some/);
 assert.match(renderer,/state\.ngWords\.some/);
 assert.match(renderer,/data-broadcast-user/);
 assert.match(renderer,/data-broadcast-read-through/);
 assert.match(renderer,/--broadcast-comment-font-size/);
 assert.match(style,/font-size:var\(--broadcast-comment-font-size,13px\)/);
 assert.match(renderer,/class="broadcast-comment-item/);
 assert.doesNotMatch(renderer,/ncv-comment-table/);
});
test("composer is gated by login and uses the existing broadcaster-comment API only",()=>{
 assert.match(renderer,/!nicoStatus\.authenticated\|\|broadcastCommentSending\?"disabled":""/);
 assert.match(renderer,/ログインするとコメントできます/);
 assert.match(renderer,/運営コメントを入力（放送者権限が必要です）/);
 assert.match(renderer,/postBroadcasterComment\(\{programId,text\}\)/);
 assert.match(renderer,/Array\.from\(text\)\.length>200/);
 assert.match(preload,/postBroadcasterComment:input=>ipcRenderer\.invoke\("niconico:post-broadcaster-comment"/);
 assert.match(main,/input\.text\.length>200/);
 assert.match(main,/ニコニコ公式ログインが必要です/);
 assert.match(main,/番組が放送中ではないため運営コメントを送信しませんでした/);
});
