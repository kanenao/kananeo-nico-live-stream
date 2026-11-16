"use strict";
const VALID=/^(?:sm|nm|so)\d{1,12}$/i;
function buildVideoMetadataRequest(videoId,now=Date.now()){
 if(typeof videoId!=="string"||!VALID.test(videoId))return {ok:false,code:"INVALID_VIDEO_ID",message:"ニコニコ動画のIDを確認してください。"};
 const stamp=Math.floor(Number(now)/1000);
 if(!Number.isSafeInteger(stamp)||stamp<=0)return {ok:false,code:"INVALID_TIME"};
 const id=videoId.toLowerCase();
 const url="https://www.nicovideo.jp/api/watch/v3_guest/"+id+
  "?actionTrackId=kananeonico_"+String(stamp)+"&noSideEffect=true";
 return {ok:true,videoId:id,url,options:{method:"GET",credentials:"include",redirect:"error",
  headers:{Accept:"application/json","X-Frontend-Id":"6","X-Frontend-Version":"0"},
  signal:AbortSignal.timeout(8000)}};
}
function parseVideoMetadataResponse(status,text,videoId){
 if(status!==200)return {ok:false,code:"METADATA_HTTP_ERROR",message:"動画の長さを取得できません（HTTP "+status+"）。"};
 let payload;
 try{if(typeof text!=="string"||text.length>1024*1024)throw Error();payload=JSON.parse(text);}
 catch{return {ok:false,code:"METADATA_INVALID",message:"動画情報を解析できません。"};}
 const data=payload?.data,video=data?.video;
 if(Number(payload?.meta?.status)!==200||!video||String(video.id||"").toLowerCase()!==String(videoId||"").toLowerCase())
  return {ok:false,code:"METADATA_MISMATCH",message:"動画情報の一致を確認できません。"};
 const seconds=Number(video.duration);
 if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)
  return {ok:false,code:"DURATION_UNKNOWN",message:"動画の再生時間が取得できません。手動で動画の長さを登録してください。"};
 return {ok:true,videoId:String(videoId).toLowerCase(),durationMs:Math.round(seconds*1000),title:String(video.title||"").slice(0,180)};
}
module.exports={buildVideoMetadataRequest,parseVideoMetadataResponse};
