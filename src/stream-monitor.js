"use strict";
const LIVE_STATUSES=new Set(["ON_AIR","onAir","LIVE","live"]);
const ENDED_STATUSES=new Set(["ENDED","ended","CLOSED","closed"]);
function normalizeStreamMonitorSettings(input){
 const value=input&&typeof input==="object"?input:{};
 const seen=new Set(),targets=[];
 for(const item of Array.isArray(value.targets)?value.targets:[]){
  const id=typeof item?.programId==="string"?item.programId.trim().toLowerCase():"";
  if(!/^lv\d{1,20}$/.test(id)||seen.has(id)||targets.length>=50)continue;
  seen.add(id);
  targets.push({programId:id,status:["onAir","ended","unknown"].includes(item.status)?item.status:"unknown",title:typeof item.title==="string"?item.title.slice(0,200):"",lastCheckedAt:typeof item.lastCheckedAt==="string"?item.lastCheckedAt:"",lastError:typeof item.lastError==="string"?item.lastError.slice(0,240):""});
 }
 const interval=Number(value.intervalSeconds);
 return {enabled:value.enabled===true,intervalSeconds:[30,60,120,300].includes(interval)?interval:60,autoComments:value.autoComments===true,targets};
}
function applyProgramCheck(target,result,checkedAt=new Date().toISOString()){
 const previous=target&&typeof target==="object"?target:{};
 if(!result||result.ok!==true){
  return {target:{...previous,lastCheckedAt:checkedAt,lastError:String(result?.message||"番組ページを確認できませんでした。").slice(0,240)},becameLive:false};
 }
 const raw=typeof result.programStatus==="string"?result.programStatus:"";
 const status=LIVE_STATUSES.has(raw)?"onAir":ENDED_STATUSES.has(raw)?"ended":"unknown";
 return {target:{...previous,status,title:typeof result.title==="string"?result.title.slice(0,200):previous.title||"",lastCheckedAt:checkedAt,lastError:""},becameLive:status==="onAir"&&previous.status!=="onAir"};
}
function isStreamMonitorGenerationCurrent(capturedGeneration,currentGeneration){return Number.isInteger(capturedGeneration)&&capturedGeneration===currentGeneration;}
function statusLabel(status){return status==="onAir"?"放送中":status==="ended"?"終了":"状態未確認";}
if(typeof module!=="undefined"&&module.exports)module.exports={normalizeStreamMonitorSettings,applyProgramCheck,isStreamMonitorGenerationCurrent,statusLabel};
if(typeof window!=="undefined")window.KananeoStreamMonitor={normalizeStreamMonitorSettings,applyProgramCheck,isStreamMonitorGenerationCurrent,statusLabel};
