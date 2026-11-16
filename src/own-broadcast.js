"use strict";
function loggedInId(cookies){
 const value=(Array.isArray(cookies)?cookies:[]).find(x=>x?.name==="user_session")?.value||"";
 const match=/^user_session_([0-9]{1,20})_/.exec(value);
 return match?match[1]:null;
}
function broadcastHistoryUrl(userId){
 if(typeof userId!=="string"||!/^\d{1,20}$/.test(userId))return null;
 const url=new URL("https://live.nicovideo.jp/front/api/v2/user-broadcast-history");
 for(const [k,v] of Object.entries({providerId:userId,providerType:"user",isIncludeNonPublic:"true",offset:"0",limit:"5",withTotalCount:"false"}))url.searchParams.set(k,v);
 return url.toString();
}
function parseHistory(text){
 let data;try{if(typeof text!=="string"||text.length>1024*1024)throw Error();data=JSON.parse(text);}catch{return {ok:false,message:"放送履歴を解析できませんでした。"};}
 if(!Array.isArray(data?.data?.programsList))return {ok:false,message:"ニコニコの放送履歴の形式が変わった可能性があります。"};
 const programs=data.data.programsList.slice(0,5).map(x=>{
  const id=String(x?.id?.value||x?.id||"").trim().toLowerCase();
  return {programId:id,title:String(x?.program?.title||id).slice(0,200),programStatus:String(x?.program?.schedule?.status||"").toUpperCase()};
 }).filter(x=>/^lv\d{1,20}$/.test(x.programId));
 return {ok:true,programs};
}
function programFromCreateUrl(value){
 try{const u=new URL(value);if(u.protocol!=="https:"||!["live.nicovideo.jp","live2.nicovideo.jp"].includes(u.hostname.toLowerCase()))return "";
 return u.pathname.match(/\/(?:watch|edit|manage|broadcast)\/(lv\d{1,20})(?:\/|$)/i)?.[1]?.toLowerCase()||"";}catch{return "";}
}
module.exports={loggedInId,broadcastHistoryUrl,parseHistory,programFromCreateUrl};
