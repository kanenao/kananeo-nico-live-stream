"use strict";
// A short quotation must not be skipped just because there is too little
// time to fit a poll. This helper only trusts a locally observed start,
// matching program/video identity and a bounded known duration.
(()=>{
 const LIVE=/^lv\d{1,20}$/i,VIDEO=/^(?:sm|nm|so)\d{1,12}$/i;
 const MAX_DURATION_MS=12*60*60*1000;
 const END_MARGIN_MS=1500;
 function completionPlan(input={},now=Date.now()){
  const programId=String(input.programId||"").toLowerCase();
  const videoId=String(input.videoId||"").toLowerCase();
  const startedAt=Number(input.startedAt),durationMs=Number(input.durationMs);
  if(input.autoPollEnabled!==true||input.quoteActive!==true||
     input.quoteVerified!==true||!LIVE.test(programId)||!VIDEO.test(videoId)||
     String(input.storedProgramId||"").toLowerCase()!==programId||
     String(input.storedVideoId||"").toLowerCase()!==videoId||
     !Number.isSafeInteger(startedAt)||startedAt<=0||startedAt>now||
     !Number.isFinite(durationMs)||durationMs<=0||durationMs>MAX_DURATION_MS||
     now-startedAt>86400000)
   return {ok:false,code:"UNVERIFIED_QUOTE_TIMING"};
  return {ok:true,programId,videoId,startedAt,durationMs,
   dueAt:startedAt+durationMs+END_MARGIN_MS,
   key:programId+":"+videoId+":"+startedAt};
 }
 function canFinishQuotedVideo(plan,input={},now=Date.now()){
  if(plan?.ok!==true||!Number.isFinite(now)||now<plan.dueAt||
     input.autoPollEnabled!==true||input.quoteActive!==true||
     input.pollActive===true||input.quoteVerified!==true)return false;
  if(String(input.programId||"").toLowerCase()!==plan.programId||
     String(input.videoId||"").toLowerCase()!==plan.videoId||
     Number(input.startedAt)!==plan.startedAt)return false;
  if(input.quotationOk!==true)return false;
  // The quotation API exposes the current video ID but not an ended event or
  // true playhead. No quote (natural stop) or the same video at expected end
  // can be handled; a different currently quoted video cannot.
  return input.quotationExists===false||
   input.quotationExists===true&&
    String(input.currentVideoId||"").toLowerCase()===plan.videoId;
 }
 function completionComment(hasNext){
  const text=hasNext?
   "【完走】引用動画が再生予定時間に達しました。次の動画へ進みます。":
   "【完走】引用動画が再生予定時間に達しました。次のリクエストを待っています。";
  return {ok:true,text};
 }
 const api=Object.freeze({completionPlan,canFinishQuotedVideo,completionComment});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoQuoteCompletion=api;
})();
