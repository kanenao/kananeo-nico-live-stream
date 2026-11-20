"use strict";
(()=>{
 const LIVE=/^lv\d{1,20}$/i,VIDEO=/^(?:sm|nm|so)\d{1,12}$/i;
 const MAX_AGE_MS=6*60*60*1000;
 function quoteProgress(input={},now=Date.now()){
  const programId=String(input.programId||"").toLowerCase();
  const videoId=String(input.videoId||"").toLowerCase();
  const startedAt=Number(input.startedAt),durationMs=Number(input.durationMs);
  if(!LIVE.test(programId)||!VIDEO.test(videoId)||
   input.storedProgramId!==undefined&&String(input.storedProgramId||"").toLowerCase()!==programId||
   input.storedVideoId!==undefined&&String(input.storedVideoId||"").toLowerCase()!==videoId||
   !Number.isFinite(startedAt)||startedAt<=0||startedAt>now||
   now-startedAt>86400000||!Number.isFinite(durationMs)||durationMs<=0||durationMs>86400000)
   return {ok:false,elapsedMs:0,remainingMs:0,percent:0};
  const elapsedMs=Math.min(durationMs,Math.max(0,now-startedAt));
  return {ok:true,programId,videoId,elapsedMs,remainingMs:durationMs-elapsedMs,
   durationMs,percent:Math.max(0,Math.min(100,elapsedMs/durationMs*100))};
 }
 function checkpointFromProgress(progress,options={}){
  if(!progress?.ok||options.verified!==true||!Number.isFinite(options.now))return null;
  if(progress.elapsedMs<1000||progress.remainingMs<=3000)return null;
  return {programId:progress.programId,videoId:progress.videoId,
   offsetMs:Math.floor(progress.elapsedMs/1000)*1000,durationMs:progress.durationMs,
   savedAt:Math.floor(options.now),
   title:String(options.title||progress.videoId).slice(0,150)};
 }
 function continueInfo(checkpoint,nextProgramId,now=Date.now()){
  const c=checkpoint||{},offsetMs=Number(c.offsetMs),length=Number(c.durationMs),
   savedAt=Number(c.savedAt),nextId=String(nextProgramId||"").toLowerCase();
  if(!LIVE.test(String(c.programId||""))||!LIVE.test(nextId)||
   nextId===String(c.programId).toLowerCase()||!VIDEO.test(String(c.videoId||""))||
   !Number.isFinite(savedAt)||savedAt<=0||now<savedAt||now-savedAt>MAX_AGE_MS||
   !Number.isFinite(offsetMs)||offsetMs<1000||!Number.isFinite(length)||
   length<=0||offsetMs>=length-3000)return {ok:false,reason:"NO_VALID_CHECKPOINT"};
  return {ok:true,programId:c.programId,videoId:String(c.videoId).toLowerCase(),
   title:String(c.title||c.videoId).slice(0,150),offsetMs,durationMs:length,
   // The quotation API has no verified seek parameter. A marker is not
   // permission to restart video at 0 and claim it resumed.
   seekSupported:false,canAutoResume:false};
 }
 const api=Object.freeze({quoteProgress,checkpointFromProgress,continueInfo});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoQuoteResume=api;
})();