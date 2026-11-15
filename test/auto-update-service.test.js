"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createAutoUpdateService,describeUpdateError}=require("../src/auto-update-service");
function updaterMock(){
 const up=new EventEmitter();
 let calls=0,installs=[];
 up.checkForUpdates=async()=>{calls++;up.emit("update-not-available");};
 up.quitAndInstall=(silent,relaunch)=>{installs.push({silent,relaunch});};
 return {up,get calls(){return calls;},installs};
}
test("Windows Setup uses the alpha GitHub channel, full download and safe install on exit",async()=>{
 const m=updaterMock();let tick;const messages=[];
 const s=createAutoUpdateService({app:{isPackaged:true},updater:m.up,platform:"win32",
  notify:x=>messages.push(x),schedule:fn=>tick=fn,repeat:()=>{}});
 s.start();
 assert.equal(m.up.channel,"alpha");
 assert.equal(m.up.autoDownload,true);
 assert.equal(m.up.autoInstallOnAppQuit,true);
 assert.equal(m.up.disableDifferentialDownload,true);
 assert.equal(m.up.allowPrerelease,true);
 assert.equal(m.up.allowDowngrade,false);
 await tick();assert.equal(m.calls,1);
 assert.equal(s.installReadyUpdate(),false);
 m.up.emit("update-available",{version:"0.2.0-alpha.58"});
 m.up.emit("download-progress",{percent:78.7});
 assert.equal(s.getStatus().percent,79);
 m.up.emit("update-downloaded",{version:"0.2.0-alpha.58"});
 assert.equal(s.getStatus().phase,"downloaded");
 await s.check();assert.equal(m.calls,1);
 assert.equal(s.installReadyUpdate(),true);
 assert.deepEqual(m.installs,[{silent:true,relaunch:false}]);
 assert.equal(s.installReadyUpdate(),false);
 assert.equal(s.getStatus().phase,"installing");
 assert.ok(messages.some(x=>x.phase==="downloaded"));
});
test("Portable, other OS and dev apps do not attempt updater or installation",async()=>{
 for(const options of [{platform:"win32",portable:true,packaged:true},{platform:"linux",portable:false,packaged:true},{platform:"win32",portable:false,packaged:false}]){
  const m=updaterMock();
  const s=createAutoUpdateService({app:{isPackaged:options.packaged},updater:m.up,platform:options.platform,portable:options.portable});
  s.start();await s.check();
  assert.equal(s.getStatus().supported,false);
  assert.equal(m.calls,0);assert.equal(s.installReadyUpdate(),false);
 }
});
test("network, metadata and verification failures show a safe actionable code",()=>{
 assert.equal(describeUpdateError({code:"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND",message:"missing alpha.yml"}).code,"UPDATE_METADATA_NOT_FOUND");
 assert.equal(describeUpdateError({code:"ENOTFOUND",message:"dns error"}).code,"UPDATE_NETWORK_ERROR");
 assert.equal(describeUpdateError({message:"sha512 checksum mismatch"}).code,"UPDATE_VERIFY_FAILED");
 const s=createAutoUpdateService({app:{isPackaged:true},updater:updaterMock().up,platform:"win32",schedule:()=>{},repeat:()=>{}});
 s.start();
 s.reportError(new Error("http://example.com/?token=PRIVATE_SECRET"));
 assert.equal(s.getStatus().message.includes("PRIVATE_SECRET"),false);
 assert.equal(s.getStatus().errorCode,"UPDATE_FAILED");
});
test("failed updater install does not silently pretend update was applied",()=>{
 const m=updaterMock();
 m.up.quitAndInstall=()=>{throw Object.assign(Error("Windows error"),{code:"EPERM"});};
 const s=createAutoUpdateService({app:{isPackaged:true},updater:m.up,platform:"win32",schedule:()=>{},repeat:()=>{}});
 s.start();m.up.emit("update-downloaded",{version:"0.2.0-alpha.58"});
 assert.equal(s.installReadyUpdate(),false);
 assert.equal(s.getStatus().phase,"error");
 assert.equal(s.getStatus().errorCode,"UPDATE_PERMISSION_DENIED");
});
