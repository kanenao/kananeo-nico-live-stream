"use strict";
// GitHub's Atom-based prerelease resolver can select a release whose channel
// file cannot be downloaded even when the actual current alpha release has it.
// Recover only via verified assets of this fixed public repository.
const {compareVersions}=require("./update-checker");
const {getReleaseChannel}=require("./update-channel");
const REPO="kanenao/kananeo-nico-live-stream";
const API_URL="https://api.github.com/repos/"+REPO+"/releases?per_page=20";
const RELEASE_BASE="https://github.com/"+REPO+"/releases/download/";

function selectAlphaUpdateRelease(releases,currentVersion){
 if(!Array.isArray(releases)||getReleaseChannel(currentVersion)!=="alpha")return null;
 const valid=[];
 for(const release of releases){
  if(!release||release.draft===true||release.prerelease!==true)continue;
  const tag=String(release.tag_name||"");
  if(!/^v\d+\.\d+\.\d+-alpha\.\d+$/.test(tag))continue;
  if(!(compareVersions(tag.slice(1),currentVersion)>0))continue;
  const assets=Array.isArray(release.assets)?release.assets:[];
  if(!assets.some(asset=>asset?.name==="alpha.yml"&&Number(asset.size)>0))continue;
  if(!assets.some(asset=>/^[A-Za-z0-9. _-]+-Setup-x64\.exe$/.test(String(asset?.name||""))&&Number(asset.size)>0))continue;
  valid.push({tag,version:tag.slice(1),url:RELEASE_BASE+encodeURIComponent(tag)+"/"});
 }
 valid.sort((left,right)=>compareVersions(right.version,left.version));
 return valid[0]||null;
}
async function fetchVerifiedAlphaReleases(fetchImpl=fetch){
 try{
  if(typeof fetchImpl!=="function")return null;
  const response=await fetchImpl(API_URL,{method:"GET",redirect:"error",signal:AbortSignal.timeout(8000),
   headers:{Accept:"application/vnd.github+json","User-Agent":"kananeo-nico-live-stream-updater"}});
  if(!response||response.status!==200||response.url!==API_URL)return null;
  const contentLength=Number(response.headers?.get?.("content-length")||0);
  if(contentLength>2*1024*1024)return null;
  const raw=await response.text();
  if(typeof raw!=="string"||raw.length>2*1024*1024)return null;
  const list=JSON.parse(raw);
  return Array.isArray(list)?list:null;
 }catch{return null;}
}
function isMetadataMissingError(error){
 const code=String(error?.code||"").toUpperCase();
 const detail=String(error?.message||"");
 // Match only missing channel information, not arbitrary 404s for unrelated API calls.
 return code==="ERR_UPDATER_CHANNEL_FILE_NOT_FOUND"||
  /\bCannot find (?:alpha|beta|latest)\.yml\b/i.test(detail)||
  /https:\/\/github\.com\/kanenao\/kananeo-nico-live-stream\/releases\/download\/[^\s]+\/(?:alpha|beta|latest)\.yml[^\s]*.*(?:404|Not Found)/i.test(detail);
}
module.exports={API_URL,RELEASE_BASE,selectAlphaUpdateRelease,fetchVerifiedAlphaReleases,isMetadataMissingError};
