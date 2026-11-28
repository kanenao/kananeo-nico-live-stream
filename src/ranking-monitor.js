"use strict";

const SOURCES = Object.freeze([
  Object.freeze({id:"chikuwa",name:"ちくわちゃん",url:"https://www.chikuwachan.com/live/NCU/",description:"NCUリアルタイムランキング"}),
  Object.freeze({id:"nicoran",name:"nico-ran.stream",url:"https://nico-ran.stream/",description:"独自集計リアルタイムランキング"}),
  Object.freeze({id:"official",name:"ニコ生公式",url:"https://live.nicovideo.jp/ranking",description:"公式ランキング"}),
  Object.freeze({id:"kanachin",name:"かなちんランキング",url:"https://kanachin-app-collection.kanenao0224.workers.dev/#rankings",apiUrl:"https://kane-nao.tail7d733c.ts.net/api/rankings/compact",description:"かなちん独自集計ランキング"})
]);
const SOURCE_MAP = new Map(SOURCES.map(source=>[source.id,source]));
const MAX_PAGE_CHARS=6*1024*1024;
const REQUEST_TIMEOUT_MS=15000;
const LIVE_STATUSES=new Set(["ON_AIR","ONAIR","LIVE","TEST"]);

function safeText(value,max=200){
 return String(value??"").replace(/<[^>]*>/g," ").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
function decodeEntities(value){
 return String(value||"")
  .replace(/&nbsp;|&#160;/gi," ")
  .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&#x([0-9a-f]{1,6});/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
  .replace(/&#(\d{1,7});/g,(_,number)=>String.fromCodePoint(Number(number)));
}
function stripHtml(value){
 return decodeEntities(String(value||"")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi," ")
  .replace(/<!--[\s\S]*?-->/g," ")
  .replace(/<[^>]+>/g," ")
  .replace(/\s+/g," ")).trim();
}
function firstString(object,keys){
 for(const key of keys){
  const value=object?.[key];
  if(typeof value==="string"||typeof value==="number"){
   const text=String(value).trim();
   if(text)return text;
  }
 }
 return "";
}
function normalizeUserId(value){
 const text=String(value||"").trim();
 const match=text.match(/(?:NCU[_-]?|\/user\/|userId["'\s:=]+)(\d{1,20})/i)||text.match(/^(\d{1,20})$/);
 return match?match[1]:"";
}
function normalizeProgramId(value){
 const match=String(value||"").match(/\b(lv\d{1,20})\b/i);
 return match?match[1].toLowerCase():"";
}
function readNumber(value){
 if(typeof value==="number"&&Number.isFinite(value)&&value>=0)return Math.floor(value);
 const match=String(value??"").replace(/,/g,"").match(/\d{1,12}/);
 return match?Number(match[0]):null;
}
function readSignedNumber(value){
 if(typeof value==="number"&&Number.isFinite(value))return Math.trunc(value);
 const match=String(value??"").replace(/,/g,"").match(/-?\d{1,12}/);
 return match?Number(match[0]):null;
}
function parseMetrics(block){
 const text=stripHtml(block);
 const points=text.match(/(\d[\d,]*)\s*points?\b/i)||text.match(/(?:ポイント|pt)\s*[:：]?\s*(\d[\d,]*)/i);
 const viewers=text.match(/(?:👨‍👨‍👦|来場者(?:数)?|視聴者(?:数)?|viewers?)\s*[:：]?\s*(\d[\d,]*)/i);
 const comments=text.match(/(?:💬|コメント(?:数)?|comments?)\s*[:：]?\s*(\d[\d,]*)/i);
 const score=text.match(/(?:勢い|スコア|score)\s*[:：]?\s*(\d[\d,]*)/i);
 return {
  points:points?readNumber(points[1]):null,
  viewers:viewers?readNumber(viewers[1]):null,
  comments:comments?readNumber(comments[1]):null,
  score:score?readNumber(score[1]):null
 };
}
function parseExplicitRank(block){
 const patterns=[
  /\bdata-rank\s*=\s*["']?(\d{1,5})/i,
  /\bdata-position\s*=\s*["']?(\d{1,5})/i,
  /class\s*=\s*["'][^"']*(?:rank|position|順位)[^"']*["'][^>]*>\s*(?:#|No\.?\s*)?(\d{1,5})\b/i,
  /aria-label\s*=\s*["'][^"']*(?:rank|順位)\s*[:：#]?\s*(\d{1,5})/i,
  /(?:順位|rank|position)\s*[:：#]?\s*(\d{1,5})/i
 ];
 for(const pattern of patterns){const match=String(block||"").match(pattern);if(match)return readNumber(match[1]);}
 return null;
}
function parseTitle(block){
 const text=String(block||"");
 const titleAttr=text.match(/\btitle\s*=\s*["']([^"']{1,240})["']/i);
 if(titleAttr)return safeText(decodeEntities(titleAttr[1]),200);
 const heading=text.match(/<(?:h[1-6]|strong|b)\b[^>]*>([\s\S]{1,500}?)<\/(?:h[1-6]|strong|b)\s*>/i);
 if(heading){const value=stripHtml(heading[1]);if(value)return safeText(value,200);}
 const anchor=[...text.matchAll(/<a\b[^>]*>([\s\S]{1,500}?)<\/a\s*>/gi)]
  .map(match=>stripHtml(match[1])).find(value=>value.length>1);
 return safeText(anchor||"",200);
}
function parseHtmlEntry(block,index){
 const raw=String(block||"");
 const userId=normalizeUserId(raw.match(/NCU[_-]?\d{1,20}/i)?.[0]||raw.match(/\/user\/\d{1,20}/i)?.[0]||raw.match(/(?:userId|providerId|ownerId)["'\s:=]+["']?\d{1,20}/i)?.[0]||"");
 const programId=normalizeProgramId(raw.match(/\blv\d{1,20}\b/i)?.[0]||"");
 if(!userId&&!programId)return null;
 return {
  rank:parseExplicitRank(raw)||index+1,
  userId,programId,title:parseTitle(raw),metrics:parseMetrics(raw)
 };
}
function collectBlocks(html,tag){
 const expression=new RegExp("<"+tag+"\\b[^>]*>[\\s\\S]*?<\\/"+tag+"\\s*>","gi");
 return [...String(html||"").matchAll(expression)].map(match=>({block:match[0],index:match.index||0}));
}
function deduplicateEntries(rows){
 const map=new Map();
 for(const row of rows){
  const key=(row.programId||"")+"|"+(row.userId||"");
  if(!key||key==="|")continue;
  const previous=map.get(key);
  if(!previous){map.set(key,row);continue;}
  const score=item=>(item.title?2:0)+(item.rank?1:0)+(Object.values(item.metrics||{}).some(x=>x!==null)?1:0);
  if(score(row)>score(previous))map.set(key,row);
 }
 const result=[...map.values()];
 result.forEach((row,index)=>{if(!Number.isInteger(row.rank)||row.rank<1)row.rank=index+1;});
 return result;
}
function collectJsonRows(value,rows,depth=0,budget={count:0}){
 if(depth>18||budget.count>50000||value==null)return;
 budget.count++;
 if(Array.isArray(value)){for(const item of value)collectJsonRows(item,rows,depth+1,budget);return;}
 if(typeof value!=="object")return;
 const userId=normalizeUserId(firstString(value,["userId","providerId","ownerId","broadcasterId","user_id","provider_id"]));
 const programId=normalizeProgramId(firstString(value,["programId","liveId","watchId","contentId","watchUrl","url","program_id","id"]));
 if(userId||programId){
  const rank=readNumber(value.rank??value.position??value.ranking??value.order??value.rankNumber);
  const title=safeText(firstString(value,["title","programTitle","name","label"]),200);
  const metrics={
   points:readNumber(value.points??value.point??value.score),
   viewers:readNumber(value.viewers??value.viewerCount??value.watchCount??value.totalViewers),
   comments:readNumber(value.comments??value.commentCount??value.totalComments),
   score:readNumber(value.active??value.activity??value.score)
  };
  rows.push({rank,userId,programId,title,metrics});
 }
 for(const [key,item] of Object.entries(value)){
  if(key==="__proto__"||key==="constructor"||key==="prototype")continue;
  if(item&&typeof item==="object")collectJsonRows(item,rows,depth+1,budget);
 }
}
function parseEmbeddedJson(html){
 const rows=[];
 const scripts=String(html||"").matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi);
 for(const match of scripts){
  const attrs=match[1]||"",body=match[2]||"";
  const isJson=/application\/(?:ld\+)?json/i.test(attrs)||/__NEXT_DATA__|__INITIAL_STATE__|__NUXT__/i.test(attrs);
  if(!isJson&&!/^\s*[\[{]/.test(body))continue;
  const trimmed=body.trim();
  if(trimmed.length>MAX_PAGE_CHARS)continue;
  try{collectJsonRows(JSON.parse(trimmed),rows);}catch{}
 }
 return deduplicateEntries(rows);
}
function parseHtmlRows(html){
 const source=String(html||"");
 let blocks=[];
 for(const tag of ["li","article","tr"]){
  const found=collectBlocks(source,tag).filter(item=>/(?:NCU[_-]?\d{1,20}|\blv\d{1,20}\b|\/user\/\d{1,20})/i.test(item.block));
  if(found.length){blocks=found;break;}
 }
 if(!blocks.length){
  const expression=/<div\b([^>]*class\s*=\s*["'][^"']*(?:rank|item|card|program|live|stream|entry)[^"']*["'][^>]*)>[\s\S]*?<\/div\s*>/gi;
  blocks=[...source.matchAll(expression)].filter(match=>/(?:NCU[_-]?\d{1,20}|\blv\d{1,20}\b|\/user\/\d{1,20})/i.test(match[0])).map(match=>({block:match[0],index:match.index||0}));
 }
 blocks.sort((a,b)=>a.index-b.index);
 return deduplicateEntries(blocks.map((item,index)=>parseHtmlEntry(item.block,index)).filter(Boolean));
}
function parsePlainTextRows(html){
 const text=decodeEntities(String(html||"").replace(/<[^>]+>/g,"\n")).replace(/\r/g,"\n");
 const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);
 const rows=[];
 for(let i=0;i<lines.length;i++){
  const userId=normalizeUserId(lines[i].match(/NCU[_-]?\d{1,20}/i)?.[0]||lines[i].match(/\/user\/\d{1,20}/i)?.[0]||"");
  const programId=normalizeProgramId(lines[i]);
  if(!userId&&!programId)continue;
  let rank=null;
  for(let j=i-1;j>=Math.max(0,i-8);j--){
   const match=lines[j].match(/^(?:#|No\.?\s*)?(\d{1,4})[.)]?$/i);
   if(match){rank=Number(match[1]);break;}
  }
  rows.push({rank:rank||rows.length+1,userId,programId,title:safeText(lines[i-1]||"",200),metrics:{points:null,viewers:null,comments:null,score:null}});
 }
 return deduplicateEntries(rows);
}
function extractRankingEntries(html){
 const embedded=parseEmbeddedJson(html);
 if(embedded.length)return embedded;
 const structured=parseHtmlRows(html);
 if(structured.length)return structured;
 return parsePlainTextRows(html);
}
function matchOwnBroadcast(entries,userId,programIds){
 const ids=new Set((Array.isArray(programIds)?programIds:[]).map(normalizeProgramId).filter(Boolean));
 const byProgram=entries.filter(entry=>entry.programId&&ids.has(entry.programId));
 const byUser=userId?entries.filter(entry=>entry.userId===String(userId)): [];
 const matches=byProgram.length?byProgram:byUser;
 return matches.sort((a,b)=>a.rank-b.rank)[0]||null;
}
// Public JSON only. Require explicitly labelled Nico rows, ranks and a fresh
// timestamp. Unknown formats are errors, not an invented rank or omission.
function parseKanachinRanking(raw,identity={},now=Date.now()){
 const source=SOURCE_MAP.get("kanachin");
 const base={sourceId:source.id,name:source.name,url:source.url};
 const failure=message=>({...base,ok:false,status:"parse-error",entriesCount:0,message});
 let data;try{data=JSON.parse(raw);}catch{return failure("かなちんランキングのJSONを読み取れません。");}
 if(!data||typeof data!=="object"||data.ok===false||data.stale===true)return failure("ランキングの取得状態を確認できません。");
 const group=data.niconico??data.rankings?.niconico??data.data?.niconico;
 const rows=Array.isArray(group)?group:(Array.isArray(group?.items)?group.items:Array.isArray(group?.programs)?group.programs:null);
 const stamp=group?.updatedAt??group?.generatedAt??data.updatedAt??data.generatedAt??data.checkedAt??data.data?.updatedAt;
 const timestamp=typeof stamp==="string"?Date.parse(stamp):typeof stamp==="number"?(stamp<1e12?stamp*1000:stamp):NaN;
 if(!Number.isFinite(timestamp)||timestamp>now+60000||now-timestamp>300000)return failure("ランキングの更新時刻が不明、または古いため通知を保留します。");
 if(!rows||!rows.length||rows.length>100||group?.stale===true||group?.ok===false)return failure("ニコニコのランキング形式を確認できません。");
 const seen=new Set(),entries=[];
 for(const row of rows){
  const id=String(row?.programId??row?.nicoliveProgramId??row?.liveId??row?.id??"").toLowerCase();
  const rank=Number(row?.rank??row?.position);
  if(!/^lv\d{1,20}$/.test(id)||!Number.isInteger(rank)||rank<1||rank>100||seen.has(id))return failure("番組IDまたは順位の形式を確認できません。");
  seen.add(id);
  entries.push({programId:id,rank,title:safeText(row.title||row.programTitle||id),metrics:{points:readNumber(row.points??row.score),viewers:readNumber(row.watchCount??row.viewerCount??row.viewers),comments:readNumber(row.commentCount??row.comments),score:readNumber(row.score??row.momentum)}});
 }
 const ids=new Set((identity.programIds||[]).map(normalizeProgramId).filter(Boolean));
 const match=entries.filter(row=>ids.has(row.programId)).sort((a,b)=>a.rank-b.rank)[0];
 if(!match)return {...base,ok:true,status:"not-listed",rank:null,programId:"",entriesCount:entries.length,message:"取得したランキング範囲に自分の配信は見つかりませんでした。"};
 return {...base,...match,ok:true,status:"ranked",entriesCount:entries.length,matchType:"programId",message:"ランキング掲載中"};
}
function parseRankingPage(html,sourceId,identity={}){
 const source=SOURCE_MAP.get(sourceId);
 if(!source)return {ok:false,status:"unavailable",sourceId,message:"未対応のランキングサイトです。"};
 if(typeof html!=="string"||!html.trim()||html.length>MAX_PAGE_CHARS)
  return {ok:false,status:"unavailable",sourceId,message:"ランキングページの内容が空か、取得上限を超えています。"};
 if(sourceId==="kanachin")return parseKanachinRanking(html,identity);
 const entries=extractRankingEntries(html);
 if(!entries.length)return {ok:false,status:"parse-error",sourceId,name:source.name,url:source.url,entriesCount:0,message:"ランキング項目を読み取れません。ページ構造が変更された可能性があります。"};
 const userId=String(identity.userId||"");
 const programIds=Array.isArray(identity.programIds)?identity.programIds:[];
 const match=matchOwnBroadcast(entries,userId,programIds);
 if(!match)return {ok:true,status:"not-listed",sourceId,name:source.name,url:source.url,entriesCount:entries.length,rank:null,title:"",programId:"",metrics:null,message:"取得したランキング範囲に自分の配信は見つかりませんでした。"};
 return {ok:true,status:"ranked",sourceId,name:source.name,url:source.url,entriesCount:entries.length,rank:match.rank,title:match.title,programId:match.programId,metrics:match.metrics,matchType:match.programId&&programIds.map(normalizeProgramId).includes(match.programId)?"programId":"userId",message:"ランキング掲載中"};
}
function isAllowedRedirect(source,responseUrl){
 if(!responseUrl)return true;
 let actual;
 try{actual=new URL(responseUrl);}catch{return false;}
 const expected=new URL(source.apiUrl||source.url);
 if(actual.protocol!=="https:")return false;
 const root=host=>host.toLowerCase().replace(/^www\./,"");
 return root(actual.hostname)===root(expected.hostname);
}
async function fetchRankingSource(sourceId,identity={},options={}){
 const source=SOURCE_MAP.get(sourceId);
 if(!source)return {ok:false,status:"unavailable",sourceId,message:"未対応のランキングサイトです。"};
 const fetchImpl=typeof options.fetchImpl==="function"?options.fetchImpl:globalThis.fetch;
 if(typeof fetchImpl!=="function")return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:"この環境ではHTTP取得を利用できません。"};
 try{
  const response=await fetchImpl(source.apiUrl||source.url,{
   method:"GET",redirect:source.apiUrl?"error":"follow",
   headers:source.apiUrl?{Accept:"application/json"}:{Accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8","Cache-Control":"no-cache"},
   signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if(!response?.ok)return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:"HTTP "+Number(response?.status||0)+"：ランキングを取得できません。"};
  if(!isAllowedRedirect(source,response.url))return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:"安全確認できない別サイトへの転送を拒否しました。"};
  const length=Number(response.headers?.get?.("content-length")||0);
  if(length>MAX_PAGE_CHARS)return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:"ランキングページが大きすぎるため取得を中止しました。"};
  const html=await response.text();
  if(html.length>MAX_PAGE_CHARS)return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:"ランキングページが大きすぎるため取得を中止しました。"};
  return sourceId==="kanachin"?parseKanachinRanking(html,identity,options.now instanceof Date?options.now.getTime():Date.now()):parseRankingPage(html,sourceId,identity);
 }catch(error){
  const aborted=error?.name==="TimeoutError"||error?.name==="AbortError";
  return {ok:false,status:"unavailable",sourceId,name:source.name,url:source.url,message:aborted?"応答がタイムアウトしました。":"通信できませんでした。"};
 }
}
async function fetchOwnBroadcastRankings(input={},options={}){
 const userId=String(input.userId||"");
 const programs=(Array.isArray(input.programs)?input.programs:[]).filter(item=>LIVE_STATUSES.has(String(item?.programStatus||"").toUpperCase())&&normalizeProgramId(item?.programId));
 const programIds=programs.map(item=>normalizeProgramId(item.programId));
 const checkedAt=(options.now instanceof Date?options.now:new Date()).toISOString();
 if(!/^\d{1,20}$/.test(userId))return {ok:false,code:"LOGIN_REQUIRED",message:"ログイン中のユーザーIDを確認できません。",checkedAt,results:[]};
 if(!programIds.length)return {ok:true,status:"not-live",userId,programs:[],checkedAt,results:SOURCES.map(source=>({ok:true,status:"not-live",sourceId:source.id,name:source.name,url:source.url,rank:null,entriesCount:0,message:"自分の配信を検出していません。"}))};
 const results=await Promise.all(SOURCES.map(source=>fetchRankingSource(source.id,{userId,programIds},{fetchImpl:options.fetchImpl,now:options.now})));
 return {ok:true,status:"checked",userId,programs:programs.map(item=>({programId:normalizeProgramId(item.programId),title:safeText(item.title||item.programId,200)})),checkedAt,results};
}
function normalizeRankingMonitorState(input){
 const value=input&&typeof input==="object"?input:{};
 const interval=Number(value.intervalSeconds);
 const snapshots={};
 for(const source of SOURCES){
  const item=value.snapshots?.[source.id];
  if(!item||typeof item!=="object")continue;
  const rank=readNumber(item.rank),bestRank=readNumber(item.bestRank);
  snapshots[source.id]={
   status:["ranked","not-listed","not-live","unavailable","parse-error"].includes(item.status)?item.status:"unavailable",
   rank:rank&&rank<=100000?rank:null,bestRank:bestRank&&bestRank<=100000?bestRank:null,
   previousRank:readNumber(item.previousRank),delta:readSignedNumber(item.delta),
   title:safeText(item.title||"",200),programId:normalizeProgramId(item.programId),
   entriesCount:readNumber(item.entriesCount)||0,
   metrics:item.metrics&&typeof item.metrics==="object"?{
    points:readNumber(item.metrics.points),viewers:readNumber(item.metrics.viewers),
    comments:readNumber(item.metrics.comments),score:readNumber(item.metrics.score)
   }:null,
   checkedAt:typeof item.checkedAt==="string"?item.checkedAt:"",message:safeText(item.message||"",240)
  };
 }
 const history=(Array.isArray(value.history)?value.history:[]).slice(0,200).map(item=>({
  sourceId:SOURCE_MAP.has(item?.sourceId)?item.sourceId:"",
  previousRank:readNumber(item?.previousRank),rank:readNumber(item?.rank),
  programId:normalizeProgramId(item?.programId),title:safeText(item?.title||"",160),
  at:typeof item?.at==="string"?item.at:""
 })).filter(item=>item.sourceId&&item.at);
 const notified=(Array.isArray(value.notified)?value.notified:[]).filter(key=>typeof key==="string"&&/^(?:chikuwa|nicoran|official|kanachin):\d{1,20}:lv\d{1,20}$/.test(key)).slice(0,400);
 return {notified,enabled:value.enabled!==false,intervalSeconds:[60,90,120,300].includes(interval)?interval:60,snapshots,history,lastCheckedAt:typeof value.lastCheckedAt==="string"?value.lastCheckedAt:"",userId:/^\d{1,20}$/.test(String(value.userId||""))?String(value.userId):"",programs:Array.isArray(value.programs)?value.programs.slice(0,5).map(item=>({programId:normalizeProgramId(item?.programId),title:safeText(item?.title||"",200)})).filter(item=>item.programId):[]};
}
function applyRankingSnapshot(stateInput,result,checkedAt=new Date().toISOString()){
 const state=normalizeRankingMonitorState(stateInput);
 if(!result||!SOURCE_MAP.has(result.sourceId))return state;
 const previous=state.snapshots[result.sourceId]||{};
 const previousRank=previous.status==="ranked"?previous.rank:null;
 const rank=result.status==="ranked"?readNumber(result.rank):null;
 const bestCandidates=[previous.bestRank,rank].filter(value=>Number.isInteger(value)&&value>0);
 const bestRank=bestCandidates.length?Math.min(...bestCandidates):null;
 const delta=previousRank&&rank?previousRank-rank:null;
 state.snapshots[result.sourceId]={
  status:result.status,rank,bestRank,previousRank,delta,
  title:safeText(result.title||"",200),programId:normalizeProgramId(result.programId),
  entriesCount:readNumber(result.entriesCount)||0,
  metrics:result.metrics&&typeof result.metrics==="object"?{
   points:readNumber(result.metrics.points),viewers:readNumber(result.metrics.viewers),
   comments:readNumber(result.metrics.comments),score:readNumber(result.metrics.score)
  }:null,
  checkedAt,message:safeText(result.message||"",240)
 };
 if(rank&&previousRank&&rank!==previousRank){
  state.history.unshift({sourceId:result.sourceId,previousRank,rank,programId:normalizeProgramId(result.programId),title:safeText(result.title||"",160),at:checkedAt});
  state.history=state.history.slice(0,200);
 }
 return state;
}

// Notify once per account, site and exact live program. Unavailable
// results cannot trigger a notice or reset deduplication.
function recordRankInNotice(stateInput,result,userId,programIds){
 const state=normalizeRankingMonitorState(stateInput);
 const id=normalizeProgramId(result?.programId),account=String(userId||"");
 if(result?.ok!==true||result.status!=="ranked"||!SOURCE_MAP.has(result.sourceId)||!/^\d{1,20}$/.test(account)||
    !id||!(programIds||[]).map(normalizeProgramId).includes(id)||!Number.isInteger(result.rank)||result.rank<1||result.rank>100000)return {state,notice:null};
 const key=result.sourceId+":"+account+":"+id;
 if(state.notified.includes(key))return {state,notice:null};
 state.notified=[key,...state.notified].slice(0,400);
 return {state,notice:{sourceId:result.sourceId,programId:id,rank:result.rank,title:safeText(result.title||id),message:SOURCE_MAP.get(result.sourceId).name+"で "+result.rank+"位にランクイン！"}};
}
const api={
 parseKanachinRanking,recordRankInNotice,SOURCES,MAX_PAGE_CHARS,REQUEST_TIMEOUT_MS,normalizeUserId,normalizeProgramId,
 extractRankingEntries,parseRankingPage,fetchRankingSource,fetchOwnBroadcastRankings,
 normalizeRankingMonitorState,applyRankingSnapshot,matchOwnBroadcast,isAllowedRedirect
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoRankingMonitor=api;
