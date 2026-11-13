"use strict";

const FAILURE_TYPES = new Set([
  "peer_rejected","host_rejected","origin_rejected","cross_site_rejected",
  "ip_rate_limited","pair_rate_limited","pair_failed","auth_failed",
  "device_rate_limited","command_failed"
]);

function createRemoteControlAnomalyDetector({
  now=()=>Date.now(),windowMs=60_000,ipThreshold=5,globalThreshold=10,cooldownMs=300_000,maxIps=128
}={}) {
  const events=[];
  const notifiedAt=new Map();
  function prune(time) {
    while(events.length&&time-events[0].at>windowMs)events.shift();
    for(const [key,last] of notifiedAt)if(time-last>cooldownMs)notifiedAt.delete(key);
  }
  function observe(input={}) {
    if(!input||!FAILURE_TYPES.has(input.type))return null;
    const time=Number(now());
    if(!Number.isFinite(time))return null;
    prune(time);
    const ip=typeof input.ip==="string"&&input.ip.length<=64?input.ip:"";
    events.push({at:time,ip,type:input.type});
    if(events.length>1000)events.splice(0,events.length-1000);
    if(ip) {
      const matching=events.filter(row=>row.ip===ip);
      if(matching.length>=ipThreshold) {
        const key="ip:"+ip,last=notifiedAt.get(key)||0;
        if(!notifiedAt.has(key)||time-last>=cooldownMs) {
          notifiedAt.set(key,time);
          return {type:"security_anomaly",ip,command:"ip_burst"};
        }
      }
    }
    if(events.length>=globalThreshold) {
      const key="global",last=notifiedAt.get(key)||0;
      if(!notifiedAt.has(key)||time-last>=cooldownMs) {
        notifiedAt.set(key,time);
        return {type:"security_anomaly",ip:"",command:"connection_burst"};
      }
    }
    if(notifiedAt.size>maxIps+1) {
      const oldest=[...notifiedAt.entries()].sort((a,b)=>a[1]-b[1]).slice(0,notifiedAt.size-maxIps-1);
      for(const [key] of oldest)notifiedAt.delete(key);
    }
    return null;
  }
  function reset(){events.length=0;notifiedAt.clear();}
  return Object.freeze({observe,reset});
}

module.exports={FAILURE_TYPES,createRemoteControlAnomalyDetector};
