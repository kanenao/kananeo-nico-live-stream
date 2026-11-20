"use strict";
(()=>{
 const TERMINAL=new Set(["playing","completed","skipped","rejected"]);
 function hasPendingRequests(requests){
  if(!Array.isArray(requests))return false;
  return requests.some(item=>item&&typeof item==="object"&&!TERMINAL.has(String(item.status||"queued").toLowerCase())&&
   item.noLivePlay!==true&&item.no_live_play!==true&&item.no_live_play!==1&&item.playable!==false);
 }
 function formatNoRequestsComment(){
  return {ok:true,text:"【リクエスト案内】次の動画リクエストがありません。自動アンケートは省略します。リクエスト募集中です。"};
 }
 function formatRepeatCountdownComment({round,delaySeconds}={}){
  if(!Number.isSafeInteger(round)||round<1||round>=100||
     !Number.isSafeInteger(delaySeconds)||delaySeconds<1||delaySeconds>3600)
   return {ok:false,code:"INVALID_REPEAT_DELAY"};
  const text="【再アンケート予告】次の"+(round+1)+"回目の投票は"+delaySeconds+"秒後に開始します。";
  if(Array.from(text).length>80)return {ok:false,code:"COMMENT_TOO_LONG"};
  return {ok:true,text};
 }
 const api=Object.freeze({hasPendingRequests,formatNoRequestsComment,formatRepeatCountdownComment});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoPollNotices=api;
})();