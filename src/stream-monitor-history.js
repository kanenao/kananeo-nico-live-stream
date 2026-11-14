"use strict";

const MAX_HISTORY=100;
const MAX_MESSAGE_LENGTH=240;
function normalizeHistory(input){
 if(!Array.isArray(input))return [];
 return input.slice(0,MAX_HISTORY).filter(item=>item&&typeof item==="object"&&typeof item.at==="string"&&Number.isFinite(Date.parse(item.at))).map(item=>({
  type:["live","error","started","stopped","resumed","info"].includes(item.type)?item.type:"info",
  programId:typeof item.programId==="string"&&/^lv\d{1,20}$/i.test(item.programId)?item.programId.toLowerCase():"",
  message:typeof item.message==="string"?item.message.slice(0,MAX_MESSAGE_LENGTH):"",
  at:new Date(item.at).toISOString()
 })).filter(item=>item.message);
}
function appendHistory(input,event){
 const normalized=normalizeHistory(input);
 if(!event||typeof event!=="object")return normalized;
 const next=normalizeHistory([{
  type:event.type,programId:event.programId,message:event.message,at:event.at
 },...normalized]);
 return next.slice(0,MAX_HISTORY);
}
if(typeof module!=="undefined"&&module.exports)module.exports={MAX_HISTORY,normalizeHistory,appendHistory};
if(typeof window!=="undefined")window.KananeoStreamMonitorHistory={MAX_HISTORY,normalizeHistory,appendHistory};
