"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {API_URL,isGitHubUpdateNotFound}=require("../src/update-metadata-recovery");
const {createAutoUpdateService}=require("../src/auto-update-service");
function release(version,complete=true){
 return {tag_name:"v"+version,prerelease:true,draft:false,
  assets:complete?[
   {name:"alpha.yml",size:414},
   {name:"kananeo.nico.live.stream-"+version+"-Setup-x64.exe",size:122152865}]:[]};
}
const recent=[release("0.2.7-alpha.84"),release("0.2.6-alpha.83")];
function api(list=recent){
 return async()=>({status:200,url:API_URL,headers:{get:()=>""},text:async()=>JSON.stringify(list)});
}
function mockUpdater(checkFn){
 const up=new EventEmitter();up.feeds=[];up.calls=0;up.quitAndInstall=()=>{};
 up.setFeedURL=config=>{up.feeds.push(config);};
 up.checkForUpdates=async()=>{
  up.calls++;
  return checkFn(up);
 };
 return up;
}
function service(up,fetcher=api(),version="0.2.6-alpha.83"){
 const events=[];
 const svc=createAutoUpdateService({app:{isPackaged:true,getVersion:()=>version},
  updater:up,platform:"win32",releaseFetch:fetcher,schedule:()=>{},repeat:()=>{},
  notify:s=>events.push({...s})});
 svc.start();
 return {svc,events};
}
test("normal alpha update bypasses GitHub Atom/latest and downloads the verified tag",async()=>{
 const up=mockUpdater(async()=>({updateInfo:{version:"0.2.7-alpha.84"},
   downloadPromise:Promise.resolve(["downloaded.exe"])}));
 const {svc}=service(up);
 const result=await svc.check();
 assert.equal(up.calls,1);
 assert.equal(up.feeds.length,1);
 assert.equal(up.feeds[0].provider,"generic");
 assert.equal(up.feeds[0].channel,"alpha");
 assert.equal(up.feeds[0].url,
  "https://github.com/kanenao/kananeo-nico-live-stream/releases/download/v0.2.7-alpha.84/");
 assert.equal(result.errorCode,"");
 assert.equal(result.phase,"downloading");
 assert.equal(result.version,"0.2.7-alpha.84");
});
test("HTTP 404 when reading a verified generic feed retries through GitHub provider",async()=>{
 const up=mockUpdater(async ctx=>{
  if(ctx.calls===1)throw Object.assign(new Error("HttpError: HTTP 404 Not Found"),{statusCode:404});
  return {updateInfo:{version:"0.2.7-alpha.84"},downloadPromise:Promise.resolve()};
 });
 const {svc,events}=service(up);
 const state=await svc.check();
 assert.equal(up.calls,2);
 assert.deepEqual(up.feeds.map(f=>f.provider),["generic","github"]);
 assert.equal(state.phase,"downloading");
 assert.equal(state.errorCode,"");
 assert.ok(events.some(s=>s.message.includes("標準経路で再試行")));
});
test("HTTP 404 from a late downloadPromise rejection is handled, not silently successful",async()=>{
 const up=mockUpdater(async ctx=>{
  if(ctx.calls===1)return {updateInfo:{version:"0.2.7-alpha.84"},
   downloadPromise:Promise.reject(Object.assign(new Error("HTTP 404"),{statusCode:404}))};
  return {updateInfo:{version:"0.2.7-alpha.84"},downloadPromise:Promise.resolve()};
 });
 const {svc}=service(up);
 assert.equal((await svc.check()).phase,"downloading");
 assert.deepEqual(up.feeds.map(f=>f.provider),["generic","github"]);
 assert.equal(up.calls,2);
});
test("both update routes failing show a real download error and never say ready to install",async()=>{
 const up=mockUpdater(async()=>{throw Object.assign(Error("HTTP 404 Not Found"),{statusCode:404});});
 const {svc}=service(up);
 const state=await svc.check();
 assert.equal(state.phase,"error");
 assert.equal(state.errorCode,"UPDATE_RELEASE_NOT_FOUND");
 assert.notEqual(state.phase,"downloaded");
 assert.equal(svc.installReadyUpdate(),false);
 assert.equal(up.calls,2);
});
test("installed latest alpha is detected through verified API without calling broken provider",async()=>{
 const up=mockUpdater(async()=>{throw Error("should not check GitHub releases/latest");});
 const {svc}=service(up,api([release("0.2.6-alpha.83")]));
 const state=await svc.check();
 assert.equal(up.calls,0);
 assert.equal(state.phase,"current");
 assert.equal(state.errorCode,"");
});
test("incomplete newer release never initiates download; no false current state",async()=>{
 const up=mockUpdater(async()=>{throw Error("download should not run");});
 const {svc}=service(up,api([release("0.2.7-alpha.84",false),release("0.2.6-alpha.83")]));
 const state=await svc.check();
 assert.equal(state.phase,"error");
 assert.equal(state.errorCode,"UPDATE_METADATA_NOT_FOUND");
 assert.equal(up.calls,0);
});
test("API unavailable retains older provider; HTTP 404 attempts verified fallback instead of treating it as a missing manifest",async()=>{
 const up=mockUpdater(async()=>{throw Object.assign(Error("HTTP 404"),{status:404});});
 const {svc}=service(up,async()=>{throw Error("offline");});
 const result=await svc.check();
 assert.equal(result.phase,"error");
 assert.equal(result.errorCode,"UPDATE_RELEASE_NOT_FOUND");
 assert.equal(up.calls,1);
});
test("detect 404 codes and reject unrelated failures",()=>{
 assert.equal(isGitHubUpdateNotFound({statusCode:404}),true);
 assert.equal(isGitHubUpdateNotFound({code:"ERR_HTTP_404"}),true);
 assert.equal(isGitHubUpdateNotFound({message:"status: 404"}),true);
 assert.equal(isGitHubUpdateNotFound({message:"Cannot find alpha.yml"}),true);
 assert.equal(isGitHubUpdateNotFound({message:"timeout"}),false);
 assert.equal(isGitHubUpdateNotFound({status:403}),false);
});
