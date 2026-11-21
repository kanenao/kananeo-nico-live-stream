"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createAutoUpdateService}=require("../src/auto-update-service");
const {API_URL}=require("../src/update-metadata-recovery");
const version="0.3.1-alpha.90";
const target={tag_name:"v"+version,prerelease:true,draft:false,assets:[
 {name:"alpha.yml",size:420},
 {id:12345,name:"kananeo.nico.live.stream-"+version+"-Setup-x64.exe",size:123456,digest:"sha256:"+"a".repeat(64)}
]};
function service({fallbackDownload,launchInstaller}={}){
 const up=new EventEmitter();up.calls=0;up.feeds=[];
 up.setFeedURL=x=>up.feeds.push(x);
 up.checkForUpdates=async()=>{up.calls++;
  throw Object.assign(Error("HTTP 404 Not Found"),{statusCode:404});};
 up.quitAndInstall=()=>{throw Error("must not install as normal electron-updater download");};
 const svc=createAutoUpdateService({
  app:{isPackaged:true,getVersion:()=>"0.3.0-alpha.89"},updater:up,platform:"win32",
  schedule:()=>{},repeat:()=>{},fallbackDownload,launchInstaller,
  releaseFetch:async()=>({status:200,url:API_URL,headers:{get:()=>""},text:async()=>JSON.stringify([target])})
 });
 svc.start();return {svc,up};
}
test("two 404 update feeds recover with a digest-validated official Setup in app",async()=>{
 const seen=[];let started="";
 const {svc,up}=service({
  fallbackDownload:async(target,progress)=>{
   seen.push(target);progress(75);return {version,filePath:"C:\\verified\\setup.exe",source:"github-assets-api"};
  },
  launchInstaller:async file=>{started=file;return "";}
 });
 const state=await svc.check();
 assert.equal(up.calls,2);
 assert.deepEqual(up.feeds.map(x=>x.provider),["generic","github"]);
 assert.equal(seen.length,1);
 assert.equal(seen[0].installer.id,12345);
 assert.equal(state.phase,"downloaded-manual");
 assert.equal(state.version,version);
 assert.equal(state.source,"github-assets-api");
 assert.equal(state.errorCode,"");
 assert.equal(svc.installReadyUpdate({relaunch:true}),false);
 assert.equal((await svc.launchFallbackInstaller()).ok,true);
 assert.equal(started,"C:\\verified\\setup.exe");
 assert.equal(svc.getStatus().phase,"installing");
});
test("download failure remains an error, never advertises a ready installer",async()=>{
 const {svc}=service({fallbackDownload:async()=>{throw Object.assign(Error("bad checksum"),{code:"DOWNLOAD_VERIFY_FAILED"});}});
 const state=await svc.check();
 assert.equal(state.phase,"error");
 assert.equal(state.errorCode,"UPDATE_VERIFY_FAILED");
 assert.equal(svc.installReadyUpdate(),false);
 assert.equal((await svc.launchFallbackInstaller()).ok,false);
});
test("fallback setup launch failure remains retryable instead of claiming success",async()=>{
 const {svc}=service({fallbackDownload:async()=>({version,filePath:"C:\\verified\\setup.exe"}),
  launchInstaller:async()=>{throw Error("Windows refused launch");}});
 await svc.check();assert.equal(svc.getStatus().phase,"downloaded-manual");
 assert.equal((await svc.launchFallbackInstaller()).ok,false);
 assert.equal(svc.getStatus().phase,"downloaded-manual");
 assert.equal(svc.getStatus().errorCode,"UPDATE_INSTALLER_LAUNCH_FAILED");
});
