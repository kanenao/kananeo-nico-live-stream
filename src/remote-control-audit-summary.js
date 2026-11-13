"use strict";
const WARNING_TYPES=new Set(["peer_rejected","host_rejected","origin_rejected","cross_site_rejected","ip_rate_limited","pair_rate_limited","auth_failed","device_rate_limited","command_failed","security_anomaly"]);
function summarizeRemoteAudit(entries){
 const rows=Array.isArray(entries)?entries:[];
 let warnings=0,anomalies=0;
 const sources=new Set();
 for(const row of rows){
  if(!row||typeof row!=="object")continue;
  if(WARNING_TYPES.has(row.type)||row.severity==="warning")warnings++;
  if(row.type==="security_anomaly")anomalies++;
  if(typeof row.ip==="string"&&row.ip.trim())sources.add(row.ip.trim());
 }
 return Object.freeze({total:rows.length,warnings,anomalies,uniqueSources:sources.size});
}
if(typeof module!=="undefined"&&module.exports)module.exports={summarizeRemoteAudit};
if(typeof window!=="undefined")window.KananeoRemoteAuditSummary={summarizeRemoteAudit};
