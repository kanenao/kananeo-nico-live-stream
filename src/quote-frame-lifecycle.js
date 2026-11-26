"use strict";
(()=>{
const PROGRAM_ID=/^lv\d{1,20}$/i;
const ENDED=new Set(["ENDED","END","CLOSED"]);
const LIVE=new Set(["ON_AIR","ONAIR"]);
function normalizeProgramId(id){return PROGRAM_ID.test(String(id||""))?String(id).toLowerCase():"";}
function frameClockTime({programId,lastProgramId,frameEndsAt=0,status="",frozenAt=0}={},now=Date.now()){
 const id=normalizeProgramId(programId),current=normalizeProgramId(lastProgramId);
 if(!id||id!==current)return Number.isFinite(frozenAt)&&frozenAt>0?Math.min(now,frozenAt):now;
 const cutoff=Number(frameEndsAt)*1000;
 const verifiedEnd=ENDED.has(String(status||"").toUpperCase());
 const scheduled=Number.isFinite(cutoff)&&cutoff>0?cutoff:now;
 const confirmed=verifiedEnd&&Number.isFinite(frozenAt)&&frozenAt>0?frozenAt:now;
 return Math.min(now,scheduled,confirmed);
}
function sameFrame(programId,lastProgramId){
 const id=normalizeProgramId(programId);
 return !!id&&id===normalizeProgramId(lastProgramId);
}
function isConfirmedFrameEnd(programId,lastProgramId,status){
 return sameFrame(programId,lastProgramId)&&ENDED.has(String(status||"").toUpperCase());
}
function shouldVerifyFrame({programId,lastProgramId,frameEndsAt=0,status=""}={},now=Date.now()){
 const id=normalizeProgramId(programId);
 if(!id||id!==normalizeProgramId(lastProgramId))return false;
 if(ENDED.has(String(status).toUpperCase()))return true;
 const end=Number(frameEndsAt)*1000;
 return Number.isFinite(end)&&end>0&&now>=end;
}
function evaluateFrameStatus(verification,expectedProgramId,now=Date.now()){
 const id=normalizeProgramId(expectedProgramId);
 if(!id||!verification?.ok||normalizeProgramId(verification.programId)!==id)
  return {kind:"unknown",message:"番組状態を公式APIで確認できません。"};
 const status=String(verification.programStatus||"").toUpperCase();
 if(ENDED.has(status))return {kind:"ended",programId:id};
 if(LIVE.has(status)){
  const end=Number(verification.endTime);
  return {kind:"live",programId:id,frameEndsAt:Number.isFinite(end)&&end>0?end:0,
   pastDeadline:Number.isFinite(end)&&end>0&&now>=end*1000};
 }
 return {kind:"unknown",message:"番組の状態が確定していません。"};
}
const api=Object.freeze({frameClockTime,shouldVerifyFrame,evaluateFrameStatus,sameFrame,isConfirmedFrameEnd});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoFrameLifecycle=api;
})();
