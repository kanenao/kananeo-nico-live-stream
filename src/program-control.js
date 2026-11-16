"use strict";
const VALID=/^lv\d{1,20}$/;
const STATES=Object.freeze({start:"on_air",end:"end"});
function validateProgramControl(programId,action){
 const id=String(programId||"").trim().toLowerCase();
 if(!VALID.test(id)||!Object.hasOwn(STATES,action))
  return {ok:false,code:"INVALID_INPUT",message:"番組IDまたは開始・終了操作を確認してください。"};
 return {ok:true,programId:id,action};
}
function canMutateProgram(programStatus,action){
 const code=String(programStatus||"").trim().toUpperCase();
 if(action==="start")return ["TEST","RESERVED","RESERVE","SCHEDULED","WAITING"].includes(code);
 if(action==="end")return ["ON_AIR","ONAIR","TEST"].includes(code);
 return false;
}
function buildProgramMutationRequest(programId,action){
 const v=validateProgramControl(programId,action);
 if(!v.ok)return v;
 return {ok:true,url:"https://live2.nicovideo.jp/watch/"+v.programId+"/segment",
  options:{method:"PUT",credentials:"include",redirect:"error",headers:{"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({state:STATES[action]}),signal:AbortSignal.timeout(15000)}};
}
function summarizeProgramMutation(responseStatus,info,action,programId){
 const valid=validateProgramControl(programId,action);if(!valid.ok)return valid;
 if(![200,201,204].includes(Number(responseStatus)))
  return {ok:false,code:"MUTATION_REJECTED",message:"ニコニコが操作を受け付けませんでした（HTTP "+String(responseStatus)+"）。"};
 const status=String(info?.programStatus||"").toUpperCase();
 const succeeded=action==="start"?["ON_AIR","ONAIR"].includes(status):["ENDED","END","CLOSED"].includes(status);
 if(info?.ok&&String(info.programId||"").toLowerCase()===valid.programId&&succeeded)
  return {ok:true,verified:true,programId:valid.programId,action,message:action==="start"?"番組開始を確認しました。":"番組終了を確認しました。"};
 return {ok:true,verified:false,programId:valid.programId,action,message:"操作要求は受け付けられましたが、番組状態への反映は未確認です。公式管理画面で確認してください。"};
}
module.exports={validateProgramControl,canMutateProgram,buildProgramMutationRequest,summarizeProgramMutation};
