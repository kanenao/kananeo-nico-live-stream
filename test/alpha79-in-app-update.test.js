"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {inAppUpdateNotice}=require("../src/update-ui-state");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const available={
 ok:true,updateAvailable:true,automaticUpdateAvailable:true,latestVersion:"0.2.2-alpha.79"
};
test("published alpha appears in-app with an actionable download button on Windows Setup",()=>{
 const notice=inAppUpdateNotice({supported:true,phase:"current",channel:"alpha"},available);
 assert.equal(notice.visible,true);
 assert.equal(notice.action,"check");
 assert.match(notice.actionLabel,/アプリ内で更新/);
 assert.match(notice.title,/0\.2\.2-alpha\.79/);
 assert.equal(notice.showReleases,true);
});
test("download completion exposes an in-app install and restart button even when GitHub API is offline",()=>{
 const notice=inAppUpdateNotice({supported:true,phase:"downloaded",version:"0.2.2-alpha.79"},null);
 assert.equal(notice.visible,true);
 assert.equal(notice.action,"apply");
 assert.match(notice.actionLabel,/更新して再起動/);
 assert.match(notice.detail,/配信|放送/);
});
test("download-in-progress is visible but cannot start a premature installation",()=>{
 const notice=inAppUpdateNotice({supported:true,phase:"downloading",percent:73.8,version:"0.2.2-alpha.79"},available);
 assert.equal(notice.visible,true);
 assert.equal(notice.action,"");
 assert.match(notice.detail,/74%/);
 assert.match(notice.title,/ダウンロード中/);
});
test("failed update offers safe retry, but unsupported Portable uses external release fallback",()=>{
 const retry=inAppUpdateNotice({supported:true,phase:"error",message:"GitHub通信エラー"},available);
 assert.equal(retry.action,"check");
 assert.match(retry.detail,/GitHub通信エラー/);
 const portable=inAppUpdateNotice({supported:false,phase:"unavailable"},available);
 assert.equal(portable.visible,true);
 assert.equal(portable.action,"releases");
 assert.equal(portable.showReleases,false);
 const missingManifest=inAppUpdateNotice({supported:true,phase:"current"},
  {...available,automaticUpdateAvailable:false});
 assert.equal(missingManifest.action,"releases");
});
test("latest version and unrelated error do not show a false update notice",()=>{
 assert.equal(inAppUpdateNotice({supported:true,phase:"current"},{...available,updateAvailable:false}).visible,false);
 assert.equal(inAppUpdateNotice({supported:true,phase:"error",message:"ERR"},null).visible,false);
 assert.equal(inAppUpdateNotice({supported:true,phase:"idle"},null).action,"");
});
test("renderer connects global notice buttons to actual updater IPC and graceful exit",()=>{
 const index=read("src/index.html");
 const renderer=read("src/renderer.js");
 const main=read("src/main.js");
 const css=read("src/style.css");
 assert.match(index,/id="in-app-update-notice"/);
 assert.match(index,/data-update-notice-action/);
 assert.match(index,/update-ui-state\.js"><\/script>/);
 assert.ok(index.indexOf('src="update-ui-state.js"')<index.indexOf('src="renderer.js"'));
 assert.match(renderer,/function renderInAppUpdateNotice\(/);
 assert.match(renderer,/function applyAutoUpdateStatus\(/);
 assert.match(renderer,/renderInAppUpdateNotice\(\)/);
 assert.match(renderer,/if\(action==="apply"\)void applyDownloadedUpdate\(\)/);
 assert.match(renderer,/else if\(action==="check"\)void manuallyCheckAutoUpdate\(\)/);
 assert.match(main,/ipcMain\.handle\("app:auto-update-apply"/);
 assert.match(main,/installReadyUpdate\(\{relaunch:relaunchAfterAutoUpdate\}\)/);
 assert.match(css,/\.in-app-update-notice\[hidden\]/);
 assert.match(css,/\.in-app-update-notice button\[hidden\]/);
});
