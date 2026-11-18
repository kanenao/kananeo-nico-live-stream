"use strict";
// Keep classic browser script globals private, just like the other renderer helpers.
(() => {
const INITIAL_START_SECONDS=5;
const SAFETY_SECONDS=5;
function mediaPlan(input={}){
 const now=Number(input.now??Date.now()),startedAt=Number(input.startedAt),durationMs=Number(input.durationMs);
 const startWaitSeconds=Number(input.startWaitSeconds??0);
 const voteSeconds=Number(input.voteSeconds),resultSeconds=Number(input.resultSeconds);
 const safetySeconds=Number(input.safetySeconds??SAFETY_SECONDS);
 if(![now,startWaitSeconds,voteSeconds,resultSeconds,safetySeconds].every(Number.isFinite)||
    now<=0||startWaitSeconds<0||voteSeconds<3||resultSeconds<0||safetySeconds<0){
  return {ok:false,code:"INVALID_POLL_SETTINGS",message:"アンケートの待機・投票・結果表示の時間設定を確認してください。"};
 }
 if(!Number.isFinite(startedAt)||startedAt<=0||startedAt>now){
  return {ok:false,code:"UNKNOWN_QUOTE_START",message:"現在の動画の再生開始時刻を確認できません。アプリから引用再生を開始してください。"};
 }
 if(!Number.isFinite(durationMs)||durationMs<=0){
  return {ok:false,code:"UNKNOWN_VIDEO_DURATION",message:"現在の動画の長さを取得できません。動画時間の自動取得または手動設定を確認してください。"};
 }
 const remainingMs=Math.max(0,durationMs-Math.max(0,now-startedAt));
 const requiredSeconds=startWaitSeconds+voteSeconds+resultSeconds+safetySeconds;
 const requiredMs=Math.ceil(requiredSeconds*1000);
 if(remainingMs<requiredMs){
  return {ok:false,code:"INSUFFICIENT_VIDEO_DURATION",remainingMs,requiredMs,requiredSeconds,
    message:"動画の残り時間が短いためアンケートを省略します（必要 "+requiredSeconds+"秒／残り "+Math.floor(remainingMs/1000)+"秒）。"};
 }
 return {ok:true,remainingMs,requiredMs,requiredSeconds,mediaEndsAt:startedAt+durationMs};
}
function repeatDelaySeconds(decision){
 if(!decision||decision.decision!=="repeat")return null;
 const keep=Number(decision.continueRate),next=Number(decision.nextRate);
 if(!Number.isFinite(keep)||!Number.isFinite(next)||keep<0||next<0||keep>100||next>100)return null;
 if(keep===0&&next===0)return 5;
 if(Math.abs(keep-next)<0.0001)return 10;
 if(keep<=next)return null;
 const ratio=keep/(keep+next);
 return Math.max(10,Math.min(60,Math.round(10+(ratio-0.5)*100)));
}
function repeatPlan(input={}){
 const delaySeconds=repeatDelaySeconds(input.decision);
 if(delaySeconds==null)return {ok:false,code:"INVALID_RESULT",message:"投票結果に基づく再投票間隔を算出できません。"};
 const plan=mediaPlan({...input,startWaitSeconds:delaySeconds});
 if(!plan.ok)return {...plan,delaySeconds};
 const reserveSeconds=delaySeconds+Number(input.voteSeconds)+Number(input.resultSeconds)+Number(input.safetySeconds??SAFETY_SECONDS);
 const previousEnd=Number(input.scheduledEndAt);
 const baseEndAt=Number.isFinite(previousEnd)&&previousEnd>0?Math.max(previousEnd,Number(input.now??Date.now())):Number(input.now??Date.now());
 return {...plan,delaySeconds,reserveSeconds,plannedEndAt:baseEndAt+reserveSeconds*1000};
}
const api=Object.freeze({INITIAL_START_SECONDS,SAFETY_SECONDS,mediaPlan,repeatDelaySeconds,repeatPlan});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoPollTiming=api;
})();
