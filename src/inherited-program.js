"use strict";

// 2021-era /unama/api/v2/programs schema. Fail closed if content or
// privacy settings cannot be copied exactly; no payload is assembled by the UI.
const API_URL="https://live2.nicovideo.jp/unama/api/v2/programs";
const validId=value=>/^lv\d{1,20}$/.test(String(value||"").toLowerCase());
function buildPreviousProgramRequest(programId,sessionToken){
 if(!validId(programId)||typeof sessionToken!=="string"||!/^user_session_\d{1,20}_\S{10,}$/.test(sessionToken))
  return {ok:false,code:"INVALID_AUTH",message:"ログインまたは前枠の番組IDを確認してください。"};
 return {ok:true,url:API_URL+"/"+String(programId).toLowerCase(),options:{
  method:"GET",credentials:"include",redirect:"error",
  headers:{Accept:"application/json","X-niconico-session":sessionToken},
  signal:AbortSignal.timeout(12000)
 }};
}
function getString(x,max){return typeof x==="string"&&x.trim()&&x.length<=max?x:null;}
function inheritPreviousProgram(data,expectedId){
 if(!data||typeof data!=="object"||Array.isArray(data))
  return {ok:false,code:"SOURCE_INVALID",message:"前枠の設定情報を取得できませんでした。"};
 if(!validId(expectedId)||String(data.id||"").toLowerCase()!==String(expectedId).toLowerCase())
  return {ok:false,code:"SOURCE_MISMATCH",message:"前枠とは異なる番組が返されました。"};
 const title=getString(data.title,200),description=typeof data.description==="string"&&data.description.length<=10000?data.description:null;
 const category=getString(data.category,100),communityId=getString(data.community?.id||data.communityId,100);
 if(!title||description===null||!category||!communityId)
  return {ok:false,code:"SOURCE_FIELDS_MISSING",message:"タイトル・説明・カテゴリ・コミュニティの引き継ぎ情報が不足しています。自動作成を中止しました。"};
 // An unknown password/visibility setting must never be converted to public.
 const protectedKeys=["isPasswordProtected","isPasswordEnabled","hasPassword","isLimited","isPrivate","isHidden"];
 if(protectedKeys.some(k=>data[k]===true)||typeof data.password==="string"&&data.password.length>0||
    typeof data.visibility==="string"&&!["public","all"].includes(data.visibility.toLowerCase()))
  return {ok:false,code:"PRIVATE_SETTINGS_UNSUPPORTED",message:"合言葉・非公開などの設定を安全に引き継げないため、自動作成を中止しました。"};
 if(typeof data.isMemberOnly!=="boolean")
  return {ok:false,code:"VISIBILITY_UNKNOWN",message:"前枠の公開設定を検証できないため、自動作成を中止しました。"};
 if(data.tags!==undefined&&!Array.isArray(data.tags))
  return {ok:false,code:"TAGS_INVALID",message:"前枠のタグ設定を検証できませんでした。"};
 const tags=(data.tags||[]).slice(0,30).map(tag=>{
  if(!tag||!getString(tag.label,100)||typeof tag.isLocked!=="boolean")return null;
  return {label:tag.label,isLocked:tag.isLocked};
 });
 if(tags.includes(null)||(data.tags||[]).length>30)
  return {ok:false,code:"TAGS_INVALID",message:"前枠のタグを完全に引き継げません。"};
 const payload={
  title,description,category,communityId,tags,
  isMemberOnly:data.isMemberOnly
 };
 const boolFlags=["isTagOwnerLock","isTimeshiftEnabled","isUadEnabled","isIchibaEnabled",
  "isOfficialIchibaOnly","isQuotable","isAutoCommentFilterEnabled"];
 for(const key of boolFlags){
  if(data[key]!==undefined){
   if(typeof data[key]!=="boolean")return {ok:false,code:"FLAG_INVALID",message:"前枠の設定を検証できません："+key};
   payload[key]=data[key];
  }
 }
 if(data.optionalCategories!==undefined){
  if(!Array.isArray(data.optionalCategories)||data.optionalCategories.length>20||
     data.optionalCategories.some(x=>!getString(x,100)))
   return {ok:false,code:"CATEGORY_INVALID",message:"前枠の追加カテゴリを検証できません。"};
  payload.optionalCategories=[...data.optionalCategories];
 }
 if(data.maxQuality!==undefined){
  if(!getString(data.maxQuality,64))return {ok:false,code:"QUALITY_INVALID",message:"前枠の画質設定を検証できません。"};
  payload.maxQuality=data.maxQuality;
 }
 if(data.rightsItems!==undefined&&data.rightsItems.length){
  if(!Array.isArray(data.rightsItems)||data.rightsItems.length>30)
   return {ok:false,code:"RIGHTS_INVALID",message:"前枠の権利表記を検証できません。"};
  // Rights items use a richer schema; avoid copying an incomplete record.
  for(const item of data.rightsItems){
   if(!item||typeof item!=="object"||!getString(item.code,120))
    return {ok:false,code:"RIGHTS_INVALID",message:"前枠の権利表記を安全に引き継げません。"};
  }
  payload.rightsItems=data.rightsItems.map(item=>({
   code:item.code,title:String(item.title||""),artist:String(item.artist||""),
   lyric:String(item.lyric||""),composer:String(item.composer||""),
   time:String(item.time||""),org:String(item.org||"")
  }));
 }
 // Past schedule fields are intentionally not copied: this makes a new immediate frame.
 return {ok:true,payload};
}
function parsePreviousProgram(text,httpStatus,expectedId){
 if(httpStatus!==200)return {ok:false,code:"SOURCE_HTTP_ERROR",message:"前枠の詳細取得に失敗しました（HTTP "+httpStatus+"）。"};
 let response;try{if(text.length>1024*1024)throw Error();response=JSON.parse(text);}catch{return {ok:false,code:"SOURCE_PARSE_ERROR",message:"前枠の設定情報を解析できません。"};}
 if(Number(response?.meta?.status)!==200)return {ok:false,code:"SOURCE_API_ERROR",message:"前枠の設定情報が取得できませんでした。"};
 return inheritPreviousProgram(response.data,expectedId);
}
function buildCreateProgramRequest(payload,sessionToken){
 if(!payload||typeof payload!=="object"||typeof sessionToken!=="string"||!/^user_session_\d{1,20}_\S{10,}$/.test(sessionToken))
  return {ok:false,code:"INVALID_CREATE_REQUEST",message:"次枠の作成設定を確認してください。"};
 return {ok:true,url:API_URL,options:{method:"POST",credentials:"include",redirect:"error",
  headers:{Accept:"application/json","Content-Type":"application/json","X-niconico-session":sessionToken},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)}};
}
function parseCreateProgramResponse(text,httpStatus){
 let response;try{if(text.length>200000)throw Error();response=JSON.parse(text);}catch{return {ok:false,code:"CREATE_PARSE_ERROR",message:"次枠の作成結果を確認できません。重複防止のため自動再試行しません。"};}
 const id=String(response?.data?.id||"").toLowerCase();
 if(httpStatus===201&&Number(response?.meta?.status)===201&&validId(id))
  return {ok:true,programId:id};
 return {ok:false,code:"CREATE_API_ERROR",message:"次枠の作成が確認できませんでした（HTTP "+httpStatus+"、"+String(response?.meta?.errorCode||"API_ERROR").slice(0,60)+"）。自動再試行しません。"};
}
module.exports={API_URL,inheritPreviousProgram,buildPreviousProgramRequest,
 parsePreviousProgram,buildCreateProgramRequest,parseCreateProgramResponse};
