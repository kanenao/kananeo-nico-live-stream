"use strict";
const VALID_USER=/^\d{1,20}$/;
function normalizeUserIds(input){
 const rows=Array.isArray(input)?input:String(input||"").split(/[\s,;]+/);
 const found=[];
 for(const row of rows){
  const raw=typeof row==="string"?row.trim():String(row||"").trim();
  let id=VALID_USER.test(raw)?raw:"";
  if(!id){const short=raw.match(/^user\/(\d{1,20})\/?$/i);if(short)id=short[1];}
  if(!id)try{
   const u=new URL(raw);
   if(u.protocol==="https:"&&["www.nicovideo.jp","nicovideo.jp","live.nicovideo.jp"].includes(u.hostname.toLowerCase()))
    id=u.pathname.match(/^\/user\/(\d{1,20})\/?$/i)?.[1]||"";
  }catch{}
  if(id&&!found.includes(id)&&found.length<30)found.push(id);
 }
 return found;
}
function buildRegisteredUserHistoryUrl(userId){
 if(!VALID_USER.test(String(userId||"")))return "";
 const url=new URL("https://live.nicovideo.jp/front/api/v2/user-broadcast-history");
 for(const [key,value] of Object.entries({providerId:userId,providerType:"user",isIncludeNonPublic:"false",offset:"0",limit:"5",withTotalCount:"false"}))
  url.searchParams.set(key,String(value));
 return url.toString();
}
function normalizeMonitorConfig(input){
 const src=input&&typeof input==="object"?input:{};
 const interval=Number(src.intervalSeconds);
 return {enabled:src.enabled===true,userIds:normalizeUserIds(src.userIds),
  intervalSeconds:[30,60,120,300].includes(interval)?interval:60};
}
const LIVE_STATUS=new Set(["ON_AIR","ONAIR","TEST"]);
function createRegisteredUserMonitor({getUserBroadcast,onLive=()=>{},onStatus=()=>{},
 now=Date.now,setIntervalFn=setInterval,clearIntervalFn=clearInterval}){
 if(typeof getUserBroadcast!=="function")throw new TypeError("放送取得処理が必要です。");
 let config=normalizeMonitorConfig({}),timer=null,busy=false,generation=0,nextCheckAt=0,lastCheckAt="",message="登録配信者の監視は停止中です。";
 let notified=new Set();
 function status(){return {...config,busy,nextCheckAt,lastCheckAt,message};}
 function emit(){try{onStatus(status());}catch{}}
 async function poll(force=false){
  if(!config.enabled||busy||(!force&&now()<nextCheckAt))return status();
  busy=true;const token=generation;emit();
  try{
   let liveCount=0;
   for(const userId of config.userIds){
    if(token!==generation||!config.enabled)break;
    let response;
    try{response=await getUserBroadcast(userId);}
    catch(error){response={ok:false,message:error?.message||"取得できませんでした。"};}
    if(token!==generation||!config.enabled)break;
    if(!response?.ok){message="ユーザー "+userId+" の放送情報を確認できません："+String(response?.message||"通信失敗").slice(0,90);continue;}
    for(const item of response.programs||[]){
     const id=String(item?.programId||"").toLowerCase();
     if(!/^lv\d{1,20}$/.test(id)||!LIVE_STATUS.has(String(item?.programStatus||"").toUpperCase()))continue;
     liveCount++;
     const key=userId+":"+id;
     if(notified.has(key))continue;
     notified.add(key);
     if(notified.size>300)notified=new Set([...notified].slice(-200));
     try{onLive({userId,programId:id,title:String(item.title||id).slice(0,200),at:new Date(now()).toISOString()});}catch{}
    }
   }
   if(token===generation&&config.enabled){
    lastCheckAt=new Date(now()).toISOString();
    message=config.userIds.length+"人を確認、放送中 "+liveCount+"件。次回確認："+new Date(now()+config.intervalSeconds*1000).toLocaleTimeString("ja-JP");
   }
  }finally{
   busy=false;
   if(token===generation&&config.enabled)nextCheckAt=now()+config.intervalSeconds*1000;
   emit();
  }
  return status();
 }
 function configure(input){
  const next=normalizeMonitorConfig(input);
  generation++;
  if(timer!==null){clearIntervalFn(timer);timer=null;}
  config=next;
  if(!next.enabled||!next.userIds.length){
   config.enabled=false;busy=false;message="登録配信者の監視は停止中です。";emit();return {ok:true,status:status()};
  }
  const activeUserIds=new Set(config.userIds);
  notified=new Set([...notified].filter(key=>activeUserIds.has(key.split(":")[0])));
  nextCheckAt=0;message="登録配信者 "+config.userIds.length+"人の監視を開始しました。";
  timer=setIntervalFn(()=>{void poll();},1000);
  emit();return {ok:true,status:status()};
 }
 return Object.freeze({configure,poll,status,dispose:()=>configure({enabled:false})});
}
module.exports={normalizeUserIds,buildRegisteredUserHistoryUrl,normalizeMonitorConfig,createRegisteredUserMonitor};
