"use strict";
const DEFAULT_LIMIT=500,EVENT_TYPES=new Set(["peer_rejected","host_rejected","origin_rejected","cross_site_rejected","ip_rate_limited","pair_rate_limited","pair_succeeded","pair_failed","auth_failed","device_rate_limited","command_succeeded","command_failed","security_anomaly"]);
const WARNING_TYPES=new Set(["peer_rejected","host_rejected","origin_rejected","cross_site_rejected","ip_rate_limited","pair_rate_limited","auth_failed","device_rate_limited","command_failed"]);
function createRemoteAuditLog({limit=DEFAULT_LIMIT,now=()=>Date.now()}={}){
 const max=Math.max(20,Math.min(5000,Math.floor(Number(limit)||DEFAULT_LIMIT))),entries=[];
 function normalize(input={},preserveAt=false){
  const type=EVENT_TYPES.has(input.type)?input.type:"unknown",parsed=preserveAt&&typeof input.at==="string"?Date.parse(input.at):NaN;
  const at=Number.isFinite(parsed)?new Date(parsed).toISOString():new Date(now()).toISOString();
  return Object.freeze({id:0,at,type,severity:WARNING_TYPES.has(type)?"warning":"info",method:typeof input.method==="string"?input.method.slice(0,10):"",path:typeof input.path==="string"&&input.path.startsWith("/")?input.path.slice(0,100):"",ip:typeof input.ip==="string"&&input.ip.length<=64?input.ip:"",command:typeof input.command==="string"&&/^[a-z][a-z0-9:_-]{0,63}$/.test(input.command)?input.command:""});
 }
 function record(input={}){const safe=normalize(input),entry=Object.freeze({...safe,id:entries.length?entries[entries.length-1].id+1:1});entries.push(entry);if(entries.length>max)entries.splice(0,entries.length-max);return entry;}
 function restore(rows=[]){entries.length=0;let restored=0;for(const row of Array.isArray(rows)?rows:[]){if(!row||typeof row!=="object"||!EVENT_TYPES.has(row.type)||!Number.isFinite(Date.parse(row.at||"")))continue;const safe=normalize(row,true);entries.push(Object.freeze({...safe,id:restored+1}));restored++;}if(entries.length>max)entries.splice(0,entries.length-max);return entries.length;}
 function list({limit:count=100}={}){const n=Math.max(1,Math.min(max,Math.floor(Number(count)||100)));return entries.slice(-n).reverse().map(x=>({...x}));}
 return Object.freeze({record,list,restore,clear:()=>{entries.length=0;}});
}
module.exports={DEFAULT_LIMIT,createRemoteAuditLog};
