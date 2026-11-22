"use strict";
(()=>{
 const MODES=Object.freeze(["split","wide","video","dual"]);
 const DEFAULTS=Object.freeze({mode:"split",videoShare:60,theater:false,secondaryProgramId:"",secondaryAudio:false});
 function normalizeBroadcastView(input){
  const v=input&&typeof input==="object"?input:{};
  const value=Number(v.videoShare);
  const id=String(v.secondaryProgramId||"").trim().toLowerCase();
  return {
   mode:MODES.includes(v.mode)?v.mode:DEFAULTS.mode,
   videoShare:Number.isFinite(value)?Math.max(50,Math.min(78,Math.round(value/2)*2)):DEFAULTS.videoShare,
   theater:v.theater===true,
   secondaryProgramId:/^lv\d{1,20}$/.test(id)?id:"",
   secondaryAudio:v.secondaryAudio===true
  };
 }
 function visiblePanes(settings){
  const mode=normalizeBroadcastView(settings).mode;
  return {main:true,secondary:mode==="dual",comments:mode!=="video"};
 }
 function layoutClass(settings){
  const mode=normalizeBroadcastView(settings).mode;
  return "broadcast-live-layout broadcast-mode-"+mode;
 }
 function canLoadSecondView(value){
  const id=String(value||"").trim().toLowerCase();
  if(/^lv\d{1,20}$/.test(id))return id;
  try{
   const u=new URL(id);
   if(u.protocol!=="https:"||!["live.nicovideo.jp","live2.nicovideo.jp"].includes(u.hostname.toLowerCase()))return "";
   return u.pathname.match(/^\/watch\/(lv\d{1,20})\/?$/i)?.[1]?.toLowerCase()||"";
  }catch{return "";}
 }
 const api=Object.freeze({MODES,DEFAULTS,normalizeBroadcastView,visiblePanes,layoutClass,canLoadSecondView});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoBroadcastView=api;
})();
