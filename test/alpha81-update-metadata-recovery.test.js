"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {API_URL,selectAlphaUpdateRelease,fetchVerifiedAlphaReleases,isMetadataMissingError}=require("../src/update-metadata-recovery");
const {createAutoUpdateService,describeUpdateError}=require("../src/auto-update-service");

const alpha=(version,assets=true)=>({
 tag_name:"v"+version,prerelease:true,draft:false,
 assets:assets?[{name:"alpha.yml",size:414},{name:"kananeo.nico.live.stream-"+version+"-Setup-x64.exe",size:122148142}]:[]
});
const list=[alpha("0.2.3-alpha.80"),alpha("0.2.2-alpha.79")];
const validFetch=async()=>({status:200,url:API_URL,headers:{get:()=>""},text:async()=>JSON.stringify(list)});

test("recover only newer verified alpha releases with real YML and Setup assets",()=>{
 const selected=selectAlphaUpdateRelease(list,"0.2.2-alpha.79");
 assert.equal(selected.version,"0.2.3-alpha.80");
 assert.equal(selected.url,"https://github.com/kanenao/kananeo-nico-live-stream/releases/download/v0.2.3-alpha.80/");
 assert.equal(selectAlphaUpdateRelease(list,"0.2.3-alpha.80"),null);
 assert.equal(selectAlphaUpdateRelease([alpha("0.2.4-alpha.81",false)],"0.2.2-alpha.79"),null);
 assert.equal(selectAlphaUpdateRelease([alpha("0.2.4-alpha.81")],"0.2.2-beta.7"),null);
});
test("untrusted GitHub API responses and malformed data are ignored",async()=>{
 assert.equal(await fetchVerifiedAlphaReleases(async()=>({status:200,url:"https://untrusted.test",text:async()=>"[]"})),null);
 assert.equal(await fetchVerifiedAlphaReleases(async()=>({status:404,url:API_URL,text:async()=>"[]"})),null);
 assert.equal(await fetchVerifiedAlphaReleases(async()=>({status:200,url:API_URL,text:async()=>"{broken"})),null);
 assert.equal(await fetchVerifiedAlphaReleases(validFetch).then(x=>x.length),2);
});
test("metadata error detection is specific to release-channel files",()=>{
 assert.equal(isMetadataMissingError({code:"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND"}),true);
 assert.equal(isMetadataMissingError({message:"Cannot find alpha.yml in release artifacts"}),true);
 assert.equal(isMetadataMissingError({message:"https://github.com/kanenao/kananeo-nico-live-stream/releases/download/v0.2.3-alpha.80/alpha.yml HTTP 404"}),true);
 assert.equal(isMetadataMissingError({message:"GitHub API HTTP 404"}),false);
 assert.equal(describeUpdateError({message:"GitHub API HTTP 404"}).code,"UPDATE_RELEASE_NOT_FOUND");
});
function makeUpdater(){
 const emitter=new EventEmitter();
 emitter.feeds=[];emitter.calls=0;
 emitter.setFeedURL=x=>emitter.feeds.push(x);
 emitter.checkForUpdates=async()=>{
  emitter.calls++;
  if(emitter.calls===1){
   const error=Object.assign(new Error("Cannot find alpha.yml"),{code:"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND"});
   emitter.emit("error",error);
   throw error;
  }
  return {updateInfo:{version:"0.2.3-alpha.80"},downloadPromise:Promise.resolve()};
 };
 return emitter;
}
function service(updater,fetchImpl=validFetch,version="0.2.2-alpha.79"){
 return createAutoUpdateService({app:{isPackaged:true,getVersion:()=>version},updater,
  platform:"win32",releaseFetch:fetchImpl,schedule:()=>{},repeat:()=>{}});
}
test("GitHub provider 404 recovers using pinned public release and starts download",async()=>{
 const up=makeUpdater(),svc=service(up);
 svc.start();
 const status=await svc.check();
 assert.equal(up.calls,2);
 assert.equal(up.feeds.length,1);
 assert.equal(up.feeds[0].provider,"generic");
 assert.equal(up.feeds[0].channel,"alpha");
 assert.equal(up.feeds[0].url,"https://github.com/kanenao/kananeo-nico-live-stream/releases/download/v0.2.3-alpha.80/");
 assert.equal(status.phase,"downloading");
 assert.equal(status.version,"0.2.3-alpha.80");
 up.emit("update-downloaded",{version:"0.2.3-alpha.80"});
 assert.equal(svc.getStatus().phase,"downloaded");
});
test("updater error at already installed latest alpha resolves to current",async()=>{
 const up=makeUpdater(),svc=service(up,validFetch,"0.2.3-alpha.80");
 svc.start();
 const status=await svc.check();
 assert.equal(up.calls,1);
 assert.equal(status.phase,"current");
 assert.equal(status.errorCode,"");
 assert.equal(up.feeds.length,0);
});
test("new alpha without YML does not falsely claim current; invalid API keeps original error",async()=>{
 const incomplete=async()=>({status:200,url:API_URL,headers:{get:()=>""},
  text:async()=>JSON.stringify([alpha("0.2.4-alpha.81",false)])});
 const svc=service(makeUpdater(),incomplete);
 svc.start();
 const status=await svc.check();
 assert.equal(status.phase,"error");
 assert.equal(status.errorCode,"UPDATE_METADATA_NOT_FOUND");
 const offline=service(makeUpdater(),async()=>{throw Error("offline");});
 offline.start();
 const failed=await offline.check();
 assert.equal(failed.phase,"error");
 assert.equal(failed.errorCode,"UPDATE_METADATA_NOT_FOUND");
});
test("release feed is not pinned for future versions after a successful no-update retry",async()=>{
 const up=makeUpdater();let calls=0;
 up.checkForUpdates=async()=>{
  calls++;
  if(calls===1)throw Object.assign(Error("missing"),{code:"ERR_UPDATER_CHANNEL_FILE_NOT_FOUND"});
  return {isUpdateAvailable:false,updateInfo:{version:"0.2.2-alpha.79"}};
 };
 const svc=service(up);
 svc.start();
 assert.equal((await svc.check()).phase,"current");
 assert.equal((await svc.check()).phase,"current");
 assert.equal(up.feeds[0].provider,"generic");
 assert.equal(up.feeds[1].provider,"github");
});
