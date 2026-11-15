"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const src=path.resolve(__dirname,"..","src");
const main=fs.readFileSync(path.join(src,"main.js"),"utf8");
const preload=fs.readFileSync(path.join(src,"preload.js"),"utf8");
const renderer=fs.readFileSync(path.join(src,"renderer.js"),"utf8");
test("the downloaded update travels from renderer through a guarded IPC to graceful shutdown",()=>{
 assert.match(main,/ipcMain\.handle\("app:auto-update-apply"/);
 assert.match(main,/getStatus\(\)\.phase!=="downloaded"/);
 assert.match(main,/settleBeforeQuit\(/);
 assert.match(main,/autoUpdateService\?\.installReadyUpdate\(\)/);
 assert.match(preload,/applyAuto:\(\)=>ipcRenderer\.invoke\("app:auto-update-apply"\)/);
 assert.match(renderer,/data-update-auto-apply/);
 assert.match(renderer,/function applyDownloadedUpdate\(/);
});
test("update diagnostics are exposed without raw errors or secrets",()=>{
 assert.match(renderer,/data-update-diagnostic-copy/);
 assert.match(renderer,/function copyUpdateDiagnostic\(/);
 assert.match(main,/UPDATER_INIT_FAILED/);
});
