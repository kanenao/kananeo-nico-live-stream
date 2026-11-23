(()=>{
"use strict";

// P2P地震情報で配信される気象庁「地震情報」(code 551) 専用。
// 「緊急地震速報」(code 556) やユーザー感知情報は扱わない。
const EARTHQUAKE_HISTORY_URL="https://api.p2pquake.net/v2/history?codes=551&limit=10";
const REQUEST_TIMEOUT_MS=12000;
const MAX_RESPONSE_CHARS=600000;
const MAX_REPORT_AGE_MS=10*60*1000;
const MIN_POST_INTERVAL_MS=3*60*1000;
const SCALE_CODES=Object.freeze([10,20,30,40,45,50,55,60,70]);
const SCALE_LABELS=Object.freeze({10:"1",20:"2",30:"3",40:"4",45:"5弱",46:"5弱以上",50:"5強",55:"6弱",60:"6強",70:"7"});
const DEFAULT_SETTINGS=Object.freeze({enabled:false,minScale:30,intervalSeconds:30,seenIds:[],postedKeys:[],lastPostedAt:"",history:[]});

function normalizeId(value){const id=String(value||"").trim();return /^[\w-]{6,100}$/.test(id)?id:"";}
function normalizeScale(value){
 const scale=Number(value);
 return scale===46?45:SCALE_CODES.includes(scale)?scale:null;
}
function trimText(value,limit=60){return String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,limit);}
function parseJapanDate(value){
 if(typeof value!=="string")return null;
 const m=value.trim().match(/^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:\s*(?:JST|\+09:00))?$/);
 if(!m)return null;
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 const hh=Number(m[4]),mm=Number(m[5]),ss=Number(m[6]);
 const ms=Number((m[7]||"").padEnd(3,"0"));
 if(year<2000||year>2100||month<1||month>12||day<1||day>31||hh>23||mm>59||ss>59)return null;
 const at=Date.UTC(year,month-1,day,hh-9,mm,ss,ms);
 const local=new Date(at+9*3600000);
 if(local.getUTCFullYear()!==year||local.getUTCMonth()+1!==month||local.getUTCDate()!==day)return null;
 return at;
}
function normalizeReport(raw){
 if(!raw||typeof raw!=="object"||Number(raw.code)!==551)return null;
 const id=normalizeId(raw.id);
 const e=raw.earthquake;
 if(!id||!e||typeof e!=="object"||/cancel/i.test(String(raw.issue?.correct||"")))return null;
 const scale=normalizeScale(e.maxScale);
 const reportedAt=parseJapanDate(raw.time)||parseJapanDate(raw.issue?.time);
 if(!reportedAt||!scale)return null;
 const originTime=parseJapanDate(e.time);
 const hypocenter=trimText(e.hypocenter?.name||"",30);
 if(!originTime||!hypocenter)return null;
 const mag=Number(e.hypocenter?.magnitude);
 const magnitude=Number.isFinite(mag)&&mag>=0&&mag<=10?Math.round(mag*10)/10:null;
 const label=SCALE_LABELS[Number(e.maxScale)]||SCALE_LABELS[scale]||"不明";
 const key=originTime?String(originTime):id;
 return {id,key,reportedAt,originTime,scale,scaleLabel:label,hypocenter,magnitude,
   source:trimText(raw.issue?.source||"P2P地震情報",30)};
}
function normalizeNoticeSettings(value){
 const v=value&&typeof value==="object"?value:{};
 const unique=(items,limit,valid)=>[...new Set((Array.isArray(items)?items:[]).filter(valid))].slice(-limit);
 const minScale=SCALE_CODES.includes(Number(v.minScale))?Number(v.minScale):30;
 const intervalSeconds=[30,60,120,300].includes(Number(v.intervalSeconds))?Number(v.intervalSeconds):30;
 const seenIds=unique(v.seenIds,120,x=>typeof x==="string"&&/^[\w-]{6,100}$/.test(x));
 const postedKeys=unique(v.postedKeys,120,x=>typeof x==="string"&&/^[\w-]{6,100}$/.test(x));
 const history=(Array.isArray(v.history)?v.history:[]).slice(0,40).map(item=>({
   at:typeof item?.at==="string"?item.at:"",
   reportId:normalizeId(item?.reportId),
   scaleLabel:trimText(item?.scaleLabel,12),
   programId:/^lv\d{1,12}$/i.test(item?.programId||"")?item.programId.toLowerCase():"",
   status:["sent","failed","skipped"].includes(item?.status)?item.status:"skipped",
   message:trimText(item?.message,200)
 })).filter(x=>x.at&&x.reportId);
 return {enabled:v.enabled===true,minScale,intervalSeconds,seenIds,postedKeys,
   lastPostedAt:typeof v.lastPostedAt==="string"?v.lastPostedAt:"",history};
}
function isRecent(report,now=Date.now()){
 return !!report&&Number.isFinite(report.reportedAt)&&now-report.reportedAt>=-90000&&now-report.reportedAt<=MAX_REPORT_AGE_MS;
}
function planNotices(reports,settings,{seed=false,now=Date.now()}={}){
 const normalized=normalizeNoticeSettings(settings);
 const values=(Array.isArray(reports)?reports:[]).filter(Boolean)
  .slice().sort((a,b)=>a.reportedAt-b.reportedAt);
 const known=new Set(normalized.seenIds),keys=new Set(normalized.postedKeys);
 const candidates=[];
 for(const report of values){
  if(!report?.id||known.has(report.id))continue;
  known.add(report.id);
  if(seed||!isRecent(report,now)||report.scale<normalized.minScale||keys.has(report.key))continue;
  candidates.push(report);
 }
 // 消費済みIDを記録するため、後から設定変更・接続復旧しても古い地震を誤送信しない。
 normalized.seenIds=[...known].slice(-120);
 return {settings:normalized,candidates:seed?[]:candidates.slice(0,3)};
}
function formatJapanTime(ms){
 if(!Number.isFinite(ms))return "";
 const d=new Date(ms+9*3600000);
 return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");
}
function makeOperatorComment(report){
 if(!report||!SCALE_CODES.includes(report.scale))return "";
 const shortPlace=trimText(report.hypocenter,18)||"震源地不明";
 const parts=["【地震情報】最大震度"+report.scaleLabel,"震源:"+shortPlace];
 if(report.magnitude!=null)parts.push("M"+report.magnitude.toFixed(1));
 if(report.originTime)parts.push(formatJapanTime(report.originTime)+"頃");
 parts.push("出典:気象庁/P2P地震情報");
 const text=parts.join("／");
 return Array.from(text).length<=80?text:"";
}
function appendHistory(settings,entry){
 const v=normalizeNoticeSettings(settings);
 v.history=[{at:new Date().toISOString(),reportId:normalizeId(entry?.reportId),scaleLabel:trimText(entry?.scaleLabel,12),
    programId:/^lv\d{1,12}$/i.test(entry?.programId||"")?entry.programId.toLowerCase():"",
    status:["sent","failed","skipped"].includes(entry?.status)?entry.status:"skipped",message:trimText(entry?.message,200)},...v.history].slice(0,40);
 return v;
}
async function fetchEarthquakeReports(options={}){
 const fetchImpl=typeof options.fetchImpl==="function"?options.fetchImpl:globalThis.fetch;
 if(typeof fetchImpl!=="function")return {ok:false,code:"FETCH_UNAVAILABLE",message:"地震情報の取得に対応していません。",reports:[]};
 try{
  const response=await fetchImpl(EARTHQUAKE_HISTORY_URL,{
   method:"GET",redirect:"error",headers:{Accept:"application/json"},
   signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if(!response?.ok)return {ok:false,code:"HTTP_ERROR",message:"地震情報を取得できませんでした（HTTP "+Number(response?.status||0)+"）。",reports:[]};
  if(response.url&&response.url!==EARTHQUAKE_HISTORY_URL)
   return {ok:false,code:"UNEXPECTED_ENDPOINT",message:"情報提供元以外への転送が発生しました。",reports:[]};
  const len=Number(response.headers?.get?.("content-length")||0);
  if(len>MAX_RESPONSE_CHARS)return {ok:false,code:"RESPONSE_TOO_LARGE",message:"地震情報のサイズ上限を超えました。",reports:[]};
  const body=await response.text();
  if(body.length>MAX_RESPONSE_CHARS)return {ok:false,code:"RESPONSE_TOO_LARGE",message:"地震情報のサイズ上限を超えました。",reports:[]};
  let values;
  try{values=JSON.parse(body);}catch{return {ok:false,code:"INVALID_JSON",message:"地震情報を読み取れませんでした。",reports:[]};}
  if(!Array.isArray(values))return {ok:false,code:"INVALID_RESPONSE",message:"地震情報の形式が変更された可能性があります。",reports:[]};
  const reports=values.slice(0,20).map(normalizeReport).filter(Boolean);
  return {ok:true,source:"P2P地震情報",checkedAt:new Date().toISOString(),reports};
 }catch(error){
  return {ok:false,code:"NETWORK_ERROR",message:error?.name==="TimeoutError"?"地震情報の取得がタイムアウトしました。":"地震情報APIに接続できませんでした。",reports:[]};
 }
}
const api={EARTHQUAKE_HISTORY_URL,REQUEST_TIMEOUT_MS,MAX_REPORT_AGE_MS,MIN_POST_INTERVAL_MS,
 SCALE_CODES,SCALE_LABELS,DEFAULT_SETTINGS,normalizeScale,normalizeReport,normalizeNoticeSettings,
 parseJapanDate,isRecent,planNotices,formatJapanTime,makeOperatorComment,appendHistory,fetchEarthquakeReports};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoEarthquakeNotice=api;

})();
