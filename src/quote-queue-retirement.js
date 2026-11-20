"use strict";
(() => {
 // Remove exactly one played entry from the appropriate pending queue only
 // after the broadcaster's quotation is positively verified for this video.
 // Retain playback metadata in the renderer so polls and auto-next can continue.
 const VIDEO_ID=/^(?:sm|nm|so)\d{1,12}$/i;
 function retireVerifiedQuote(state,queueType,item,verification){
  if(!state||!["request","stock"].includes(queueType)||!item||
     typeof item.id!=="string"||!VIDEO_ID.test(String(item.videoId||""))||
     verification?.ok!==true||verification?.verified!==true)
   return {removed:false};
  const id=String(item.videoId).toLowerCase();
  if(String(verification.currentVideoId||"").toLowerCase()!==id)
   return {removed:false};
  const queue=queueType==="stock"?state.stocks:state.requests;
  if(!Array.isArray(queue))return {removed:false};
  const index=queue.findIndex(entry=>entry?.id===item.id&&
   String(entry.videoId||"").toLowerCase()===id);
  if(index<0)return {removed:false};
  const [removedItem]=queue.splice(index,1);
  return {removed:true,queueType,videoId:id,item:removedItem};
 }
 const api=Object.freeze({retireVerifiedQuote});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoQuoteQueue=api;
})();
