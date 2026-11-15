"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createAutoUpdateService}=require("../src/auto-update-service");
test("Windows installer checks alpha channel automatically and defers installation",async()=>{
 const updater=new EventEmitter();let call=0,scheduled;
 updater.checkForUpdates=async()=>{call++;updater.emit("update-not-available");};
 const service=createAutoUpdateService({app:{isPackaged:true},updater,platform:"win32",schedule:f=>{scheduled=f;},repeat:()=>{}});
 service.start();
 assert.equal(updater.autoDownload,true);
 assert.equal(updater.autoInstallOnAppQuit,true);
 assert.equal(updater.channel,"alpha");
 assert.equal(updater.allowPrerelease,true);
 assert.equal(updater.allowDowngrade,false);
 await scheduled();assert.equal(call,1);
 updater.emit("update-available",{version:"0.2.0-alpha.53"});
 updater.emit("download-progress",{percent:49.5});
 assert.equal(service.getStatus().percent,50);
 updater.emit("update-downloaded",{version:"0.2.0-alpha.53"});
 assert.equal(service.getStatus().phase,"downloaded");
 await service.check();assert.equal(call,1);
});
test("portable and developer modes do not auto-install",async()=>{
 for(const options of [{platform:"win32",portable:true,isPackaged:true},{platform:"win32",portable:false,isPackaged:false},{platform:"linux",portable:false,isPackaged:true}]){
  const updater=new EventEmitter();let invoked=false;updater.checkForUpdates=async()=>{invoked=true;};
  const s=createAutoUpdateService({app:{isPackaged:options.isPackaged},updater,platform:options.platform,portable:options.portable});
  s.start();await s.check();assert.equal(s.getStatus().supported,false);assert.equal(invoked,false);
 }
});
