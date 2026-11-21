"use strict";
// Last-resort in-app Setup retrieval when both electron-updater feeds return 404.
// Never run a binary until the SHA256 digest from the official Releases API
// has been verified against the entire downloaded file.
const path=require("node:path");
const fs=require("node:fs");
const fsp=require("node:fs/promises");
const {Readable,Transform}=require("node:stream");
const {pipeline}=require("node:stream/promises");
const {createHash}=require("node:crypto");

const API_PREFIX="https://api.github.com/repos/kanenao/kananeo-nico-live-stream/releases/assets/";
const RELEASE_PREFIX="https://github.com/kanenao/kananeo-nico-live-stream/releases/download/";
const MAX_SIZE=400*1024*1024;
function verifiedInstallerInfo(target){
 const version=String(target?.version||"");
 const tag=String(target?.tag||"");
 const asset=target?.installer||{};
 if(!/^\d+\.\d+\.\d+-alpha\.\d+$/.test(version)||tag!=="v"+version)
  return null;
 const name=String(asset.name||"");
 if(name!=="kananeo.nico.live.stream-"+version+"-Setup-x64.exe")return null;
 const size=Number(asset.size),id=Number(asset.id);
 if(!Number.isSafeInteger(size)||size<=0||size>MAX_SIZE||
  !Number.isSafeInteger(id)||id<=0)return null;
 const digest=String(asset.digest||"").toLowerCase();
 if(!/^sha256:[0-9a-f]{64}$/.test(digest))return null;
 return {name,size,id,digest:digest.slice(7),version,tag,
  releaseUrl:RELEASE_PREFIX+encodeURIComponent(tag)+"/"+encodeURIComponent(name),
  assetUrl:API_PREFIX+id};
}
function trustedAssetResponse(url){
 try{
  const u=new URL(url);
  return u.protocol==="https:"&&
   ["github.com","api.github.com","release-assets.githubusercontent.com","objects.githubusercontent.com"].includes(u.hostname)&&
   (u.username===""&&u.password==="");
 }catch{return false;}
}
async function downloadVerifiedInstaller(target,{directory,fetchImpl=fetch,onProgress=()=>{}}={}){
 const info=verifiedInstallerInfo(target);
 if(!info)throw Object.assign(Error("公式ReleaseのSetup版情報またはSHA256を確認できません。"),{code:"INVALID_RELEASE_ASSET"});
 if(typeof directory!=="string"||!path.isAbsolute(directory))throw Error("ダウンロード先を確認できません。");
 await fsp.mkdir(directory,{recursive:true});
 let lastError=null;
 for(const [url,isApi] of [[info.releaseUrl,false],[info.assetUrl,true]]){
  const temp=path.join(directory,"."+info.name+"-"+String(process.pid)+"-"+(isApi?"api":"direct")+".part");
  try{
   const resp=await fetchImpl(url,{
    method:"GET",redirect:"follow",
    headers:isApi?{Accept:"application/octet-stream","User-Agent":"kananeo-nico-live-stream-updater"}:
     {"User-Agent":"kananeo-nico-live-stream-updater"},
    signal:AbortSignal.timeout(180000)
   });
   if(resp?.status!==200||!trustedAssetResponse(resp.url||"")||!resp.body)
    throw Object.assign(Error("公式配布ファイルの取得に失敗しました。"),{code:"OFFICIAL_DOWNLOAD_UNAVAILABLE"});
   const declared=Number(resp.headers?.get?.("content-length")||0);
   if(declared>MAX_SIZE||declared>0&&declared!==info.size)
    throw Object.assign(Error("配布ファイルのサイズが公式情報と異なります。"),{code:"DOWNLOAD_SIZE_MISMATCH"});
   const hash=createHash("sha256");let bytes=0,lastPercent=-1;
   const measure=new Transform({transform(chunk,encoding,callback){
    bytes+=chunk.length;
    if(bytes>MAX_SIZE||bytes>info.size){
     callback(Object.assign(Error("更新ファイルのサイズが上限を超えました。"),{code:"DOWNLOAD_TOO_LARGE"}));return;
    }
    hash.update(chunk);
    const progress=Math.min(100,Math.floor(bytes/info.size*100));
    if(progress!==lastPercent&&progress%5===0){lastPercent=progress;try{onProgress(progress);}catch{}}
    callback(null,chunk);
   }});
   const nodeStream=Readable.fromWeb(resp.body);
   await pipeline(nodeStream,measure,fs.createWriteStream(temp,{flags:"wx",mode:0o600}));
   if(bytes!==info.size||hash.digest("hex")!==info.digest)
    throw Object.assign(Error("公式GitHubのSHA256と一致しません。ファイルを使用せず削除しました。"),{code:"DOWNLOAD_VERIFY_FAILED"});
   const filename=path.join(directory,info.name);
   await fsp.rm(filename,{force:true});
   await fsp.rename(temp,filename);
   return {filePath:filename,version:info.version,source:isApi?"github-assets-api":"github-release",bytes};
  }catch(error){
   lastError=error;
   await fsp.rm(temp,{force:true}).catch(()=>{});
   // A checksum or size mismatch is a security failure. Never try another URL.
   if(["DOWNLOAD_VERIFY_FAILED","DOWNLOAD_SIZE_MISMATCH","DOWNLOAD_TOO_LARGE"].includes(error?.code))throw error;
  }
 }
 throw Object.assign(Error("GitHubの公式配布経路で更新ファイルを取得できませんでした。ブラウザからSetup版を確認してください。"),{
  code:"OFFICIAL_DOWNLOAD_UNAVAILABLE",cause:lastError});
}
module.exports={verifiedInstallerInfo,trustedAssetResponse,downloadVerifiedInstaller};
