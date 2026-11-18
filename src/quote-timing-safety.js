"use strict";
(() => {
const VIDEO_ID=/^(?:sm|nm|so)\d{1,12}$/i;
const PROGRAM_ID=/^lv\d{1,20}$/i;

// Only the video ID being quoted can provide the duration for a poll.
function findQuotedItem(videoId,requests,stocks){
 const id=String(videoId||"").toLowerCase();
 if(!VIDEO_ID.test(id))return null;
 const items=[...(Array.isArray(requests)?requests:[]),...(Array.isArray(stocks)?stocks:[])];
 return items.find(item=>String(item?.videoId||"").toLowerCase()===id)||null;
}
// A locally observed quote start can remain valid even while its duration is
// being fetched. Never infer a start from a watch-page request or a past session.
function trustedQuoteStart(input={},now=Date.now()){
 const programId=String(input.programId||"").toLowerCase();
 const videoId=String(input.videoId||"").toLowerCase();
 const startedAt=Number(input.startedAt),current=Number(now);
 return PROGRAM_ID.test(programId)&&VIDEO_ID.test(videoId)&&
  String(input.storedProgramId||"").toLowerCase()===programId&&
  String(input.storedVideoId||"").toLowerCase()===videoId&&
  Number.isFinite(startedAt)&&Number.isFinite(current)&&
  startedAt>0&&current>=startedAt&&current-startedAt<86400000;
}
function trustedQuoteTiming(input={},now=Date.now()){
 const durationMs=Number(input.durationMs),startedAt=Number(input.startedAt);
 return trustedQuoteStart(input,now)&&
  Number.isFinite(durationMs)&&durationMs>0&&durationMs<=86400000&&
  // Cached times that have already passed cannot anchor a safe future poll.
  startedAt+durationMs>Number(now);
}
const api=Object.freeze({findQuotedItem,trustedQuoteStart,trustedQuoteTiming});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoQuoteTiming=api;
})();
