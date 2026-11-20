"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const fs=require("node:fs"),path=require("node:path");
const {createAutoUpdateService}=require("../src/auto-update-service");
const read=p=>fs.readFileSync(path.resolve(__dirname,"..",p),"utf8");

function updater(check){
 const emitter=new EventEmitter();
 emitter.checkForUpdates=check;
 emitter.quitAndInstall=(...args)=>{emitter.lastInstall=args;};
 return emitter;
}
const app={isPackaged:true,getVersion:()=>"0.2.0-alpha.75"};
const opts={app,platform:"win32",schedule:()=>{},repeat:()=>{}};

test("alpha update check resolves to a real state even when the provider emits no event",async()=>{
 const withoutEvents=updater(async()=>({updateInfo:{version:"0.2.0-alpha.75"}}));
 const current=createAutoUpdateService({...opts,updater:withoutEvents});
 current.start();await current.check();
 assert.equal(current.getStatus().phase,"current");
 assert.equal(current.getStatus().currentVersion,"0.2.0-alpha.75");

 const withDownload=updater(async()=>({updateInfo:{version:"0.2.0-alpha.76"},downloadPromise:Promise.resolve([])}));
 const downloading=createAutoUpdateService({...opts,updater:withDownload});
 downloading.start();await downloading.check();
 assert.equal(downloading.getStatus().phase,"downloading");
 assert.equal(downloading.getStatus().version,"0.2.0-alpha.76");

 const noResult=updater(async()=>undefined);
 const incomplete=createAutoUpdateService({...opts,updater:noResult});
 incomplete.start();await incomplete.check();
 assert.equal(incomplete.getStatus().phase,"error");
 assert.equal(incomplete.getStatus().errorCode,"UPDATE_CHECK_INCOMPLETE");
});
test("late events cannot undo a fully downloaded alpha release",()=>{
 const up=updater(async()=>({}));
 const service=createAutoUpdateService({...opts,updater:up});
 service.start();
 up.emit("update-downloaded",{version:"0.2.0-alpha.76"});
 up.emit("update-not-available");
 up.emit("download-progress",{percent:42});
 assert.equal(service.getStatus().phase,"downloaded");
 assert.equal(service.getStatus().percent,100);
 assert.equal(service.getStatus().version,"0.2.0-alpha.76");
});
test("explicit user apply restarts, ordinary exit does not relaunch",()=>{
 const ordinary=updater(async()=>({}));
 const normal=createAutoUpdateService({...opts,updater:ordinary});
 normal.start();ordinary.emit("update-downloaded",{version:"0.2.0-alpha.76"});
 assert.equal(normal.installReadyUpdate(),true);
 assert.deepEqual(ordinary.lastInstall,[true,false]);
 const request=updater(async()=>({}));
 const intentional=createAutoUpdateService({...opts,updater:request});
 intentional.start();request.emit("update-downloaded",{version:"0.2.0-alpha.76"});
 assert.equal(intentional.installReadyUpdate({relaunch:true}),true);
 assert.deepEqual(request.lastInstall,[true,true]);
});
test("dashboard shows alpha progress and ready-to-install state without restarting live",()=>{
 const ui=read("src/renderer.js"),main=read("src/main.js");
 assert.match(ui,/id="dashboard-alpha-update"/);
 assert.match(ui,/function renderDashboardAlphaUpdateStatus\(/);
 assert.match(ui,/downloaded\?"α版アップデートの準備ができました"/);
 assert.match(ui,/data-update-auto-apply hidden>更新を適用して再起動/);
 assert.match(main,/relaunchAfterAutoUpdate=true/);
 assert.match(main,/installReadyUpdate\(\{relaunch:relaunchAfterAutoUpdate\}\)/);
});
