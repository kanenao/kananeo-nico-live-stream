"use strict";
const VALID=/^(?:sm|nm|so)\d{1,12}$/i;
const MAX_DURATION_SECONDS=86400;
function buildVideoMetadataRequest(videoId,now=Date.now()){
 if(typeof videoId!=="string"||!VALID.test(videoId))return {ok:false,code:"INVALID_VIDEO_ID",message:"ニコニコ動画のIDを確認してください。"};
 // Nico watch v3_guest requires actionTrackId: 10 alphanumerics + "_" + 13-digit milliseconds.
 const stamp=Math.trunc(Number(now));
 if(!Number.isSafeInteger(stamp)||stamp<1000000000000||stamp>9999999999999)return {ok:false,code:"INVALID_TIME"};
 const id=videoId.toLowerCase();
 const url="https://www.nicovideo.jp/api/watch/v3_guest/"+id+
  "?actionTrackId=kanenonico_"+String(stamp)+"&noSideEffect=true";
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
 if(!Number.isFinite(seconds)||seconds<=0||seconds>MAX_DURATION_SECONDS)
  return {ok:false,code:"DURATION_UNKNOWN",message:"動画の再生時間が取得できません。手動で動画の長さを登録してください。"};
 return {ok:true,videoId:String(videoId).toLowerCase(),durationMs:Math.round(seconds*1000),title:String(video.title||"").slice(0,180),source:"watch-v3"};
}
// Read-only alternate endpoint. Do not rely on a watch API returning HTTP 200.
// Its XML contains an exact video ID and a duration in M:SS or H:MM:SS.
function buildThumbInfoRequest(videoId){
 if(typeof videoId!=="string"||!VALID.test(videoId))
  return {ok:false,code:"INVALID_VIDEO_ID",message:"ニコニコ動画のIDを確認してください。"};
 const id=videoId.toLowerCase();
 return {ok:true,videoId:id,url:"https://ext.nicovideo.jp/api/getthumbinfo/"+id,
  options:{method:"GET",credentials:"omit",redirect:"error",
   headers:{Accept:"application/xml,text/xml;q=0.9,*/*;q=0.8"},
   signal:AbortSignal.timeout(8000)}};
}
function parseThumbInfoResponse(status,text,videoId){
 if(status!==200)
  return {ok:false,code:"THUMBINFO_HTTP_ERROR",message:"別の動画情報APIも取得できません（HTTP "+status+"）。"};
 if(typeof text!=="string"||text.length>256*1024)
  return {ok:false,code:"THUMBINFO_INVALID",message:"別の動画情報APIの応答を解析できません。"};
 if(!/<nicovideo_thumb_response\b[^>]*\bstatus\s*=\s*["']ok["']/i.test(text))
  return {ok:false,code:"THUMBINFO_UNAVAILABLE",message:"別の動画情報APIで動画を確認できません。"};
 const thumb=/<thumb\b[^>]*>([\s\S]*?)<\/thumb\s*>/i.exec(text)?.[1]||"";
 const id=/<video_id>\s*([^<\s]+)\s*<\/video_id>/i.exec(thumb)?.[1]||"";
 if(!VALID.test(videoId)||id.toLowerCase()!==String(videoId).toLowerCase())
  return {ok:false,code:"THUMBINFO_MISMATCH",message:"別の動画情報APIの動画IDが一致しません。"};
 const duration=/<length>\s*([0-9]{1,3}:[0-9]{2}(?::[0-9]{2})?)\s*<\/length>/i.exec(thumb)?.[1]||"";
 const parts=duration.split(":").map(Number);
 if((parts.length!==2&&parts.length!==3)||parts.some(x=>!Number.isSafeInteger(x))||
    parts[parts.length-1]>=60||(parts.length===3&&parts[1]>=60))
  return {ok:false,code:"THUMBINFO_DURATION_UNKNOWN",message:"別の動画情報APIでも動画時間を確認できません。"};
 const seconds=parts.reduce((acc,x)=>acc*60+x,0);
 if(seconds<=0||seconds>MAX_DURATION_SECONDS)
  return {ok:false,code:"THUMBINFO_DURATION_UNKNOWN",message:"別の動画情報APIでも動画時間を確認できません。"};
 return {ok:true,videoId:String(videoId).toLowerCase(),durationMs:seconds*1000,source:"getthumbinfo"};
}
function isExpectedResponseUrl(responseUrl,requestUrl){
 try{
  const expected=new URL(requestUrl),actual=new URL(responseUrl||requestUrl);
  return actual.protocol==="https:"&&actual.hostname===expected.hostname&&
   actual.pathname===expected.pathname;
 }catch{return false;}
}
// Only two bounded, read-only GET requests. Never guess a length from an
// unrelated video, HTTP error page, or older quote.
async function fetchVideoMetadataWithFallback(videoId,transport,now=Date.now()){
 const primary=buildVideoMetadataRequest(videoId,now);
 if(!primary.ok)return primary;
 const fallback=buildThumbInfoRequest(primary.videoId);
 async function fetchParsed(request,parse){
  try{
   const response=await transport(request);
   if(!isExpectedResponseUrl(response?.url,request.url))
    return {ok:false,code:"METADATA_UNTRUSTED",message:"公式以外の動画情報応答を拒否しました。"};
   const text=await response.text();
   return parse(response.status,text,primary.videoId);
  }catch{
   return {ok:false,code:"METADATA_NETWORK_ERROR",message:"動画情報APIに接続できませんでした。"};
  }
 }
 const first=await fetchParsed(primary,parseVideoMetadataResponse);
 if(first.ok||first.code==="METADATA_UNTRUSTED")return first;
 const second=await fetchParsed(fallback,parseThumbInfoResponse);
 if(second.ok)return second;
 if(second.code==="METADATA_UNTRUSTED")return second;
 return {ok:false,code:"METADATA_ALL_SOURCES_FAILED",videoId:primary.videoId,
  message:"動画時間の取得に失敗しました。動画API: "+first.message+
   " 別の動画情報API: "+second.message+
   " 動画IDを確認し、取得できない場合は手動で動画の長さを設定してください。"};
}
module.exports={buildVideoMetadataRequest,parseVideoMetadataResponse,
 buildThumbInfoRequest,parseThumbInfoResponse,fetchVideoMetadataWithFallback};
