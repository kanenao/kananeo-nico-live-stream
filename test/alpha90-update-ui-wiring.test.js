"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const main=read("src/main.js"),ui=read("src/renderer.js"),updateUi=read("src/update-ui-state.js");
const updater=read("src/auto-update-service.js"),preload=read("src/preload.js");
test("fallback installer is only launched by guarded app updater IPC",()=>{
 assert.match(main,/ipcMain\.handle\("app:auto-update-apply",async event=>/);
 assert.match(main,/event.sender!==mainWindow\?\.webContents/);
 assert.match(main,/phase==="downloaded-manual"/);
 assert.match(main,/autoUpdateService\.launchFallbackInstaller\(\)/);
 assert.match(main,/fallbackDownload:\(target,onProgress\)=>downloadVerifiedInstaller/);
 assert.match(main,/launchInstaller:file=>shell\.openPath\(file\)/);
 assert.match(preload,/applyAuto:\(\)=>ipcRenderer\.invoke\("app:auto-update-apply"\)/);
});
test("settings and global update banner distinguish manual verified fallback",()=>{
 assert.match(ui,/s\.phase==="downloaded-manual"\?"公式SetupをSHA256検証済み/);
 assert.match(ui,/apply\.textContent=s\.phase==="downloaded-manual"\?"インストーラーを起動"/);
 assert.match(ui,/const external=autoUpdateState\.phase==="downloaded-manual"/);
 assert.match(updateUi,/phase==="downloaded-manual"/);
 assert.match(updateUi,/action:"apply",actionLabel:"インストーラーを起動"/);
 assert.match(updater,/source:"github-asset-fallback"/);
 assert.match(updater,/phase:"downloaded-manual"/);
});
