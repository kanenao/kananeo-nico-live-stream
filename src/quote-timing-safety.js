"use strict";
const VIDEO_ID=/^(?:sm|nm|so)\d{1,12}$/i;
const PROGRAM_ID=/^lv\d{1,20}$/i;

// Only the video ID being quoted can provide the duration for a poll.
function findQuotedItem(videoId,requests,stocks){
 const id=String(videoId||"").toLowerCase();
 if(!VIDEO_ID.test(id))return null;
 const items=[...(Array.isArray(requests)?requests:[]),...(Array.isArray(stocks)?stocks:[])];
 return items.find(item=>String(item?.videoId||"").toLowerCase()===id)||null;
}
function trustedQuoteTiming(input={},now=Date.now()){
 const programId=String(input.programId||"").toLowerCase();
 const videoId=String(input.videoId||"").toLowerCase();
 const startedAt=Number(input.startedAt),durationMs=Number(input.durationMs),current=Number(now);
 return PROGRAM_ID.test(programId)&&VIDEO_ID.test(videoId)&&
  String(input.storedProgramId||"").toLowerCase()===programId&&
  String(input.storedVideoId||"").toLowerCase()===videoId&&
  [startedAt,durationMs,current].every(Number.isFinite)&&
  startedAt>0&&startedAt<=current&&durationMs>0&&durationMs<=86400000&&
  // Cached times that have already passed cannot anchor a safe future poll.
  startedAt+durationMs>current;
}
module.exports={findQuotedItem,trustedQuoteTiming};
