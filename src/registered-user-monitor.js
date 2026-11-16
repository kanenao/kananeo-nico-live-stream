"use strict";
const VALID_USER=/^\d{1,20}$/;
const MAX_CONCURRENT_CHECKS=3;
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
 return {
  enabled:src.enabled===true,userIds:normalizeUserIds(src.userIds),
  intervalSeconds:[30,60,120,300].includes(interval)?interval:60,
  notifyOnLive:src.notifyOnLive===true
 };
}
const LIVE_STATUS=new Set(["ON_AIR","ONAIR","TEST"]);
function createRegisteredUserMonitor({getUserBroadcast,onLive=()=>{},onStatus=()=>{},
 now=Date.now,setIntervalFn=setInterval,clearIntervalFn=clearInterval}){
 if(typeof getUserBroadcast!=="function")throw new TypeError("放送取得処理が必要です。");
 let config=normalizeMonitorConfig({}),timer=null,busy=false,generation=0,nextCheckAt=0,lastCheckAt="";
 let message="登録配信者の監視は停止中です。",checkedUsers=0,failedUsers=0,liveCount=0,checkDurationMs=0;
 let notified=new Set();
 function status(){return {...config,busy,nextCheckAt,lastCheckAt,message,checkedUsers,failedUsers,liveCount,checkDurationMs};}
 function emit(){try{onStatus(status());}catch{}}
 const active=token=>token===generation&&config.enabled;
 async function poll(force=false){
  if(!config.enabled||busy||(!force&&now()<nextCheckAt))return status();
  const token=generation,startedAt=now(),users=config.userIds.slice();
  let checked=0,failed=0,lives=0,lastFailure="";
  busy=true;message="登録配信者 "+users.length+"人を並列確認中…";emit();
  let index=0;
  async function worker(){
   while(active(token)){
    const position=index++;
    if(position>=users.length)return;
    const userId=users[position];
    let response;
    try{response=await getUserBroadcast(userId);}
    catch(error){response={ok:false,message:error?.message||"通信エラー"};}
    if(!active(token))return;
    checked++;
    if(!response?.ok){
     failed++;
     lastFailure="ユーザー "+userId+"："+String(response?.message||"取得失敗").slice(0,90);
     continue;
    }
    const programs=Array.isArray(response.programs)?response.programs:[];
    for(const item of programs){
     if(!active(token))return;
     const id=String(item?.programId||"").toLowerCase();
     if(!/^lv\d{1,20}$/.test(id)||!LIVE_STATUS.has(String(item?.programStatus||"").toUpperCase()))continue;
     lives++;
     const key=userId+":"+id;
     if(notified.has(key))continue;
     notified.add(key);
     if(notified.size>300)notified=new Set([...notified].slice(-200));
     try{onLive({userId,programId:id,title:String(item.title||id).slice(0,200),at:new Date(now()).toISOString()});}catch{}
    }
   }
  }
  try{
   await Promise.all(Array.from({length:Math.min(MAX_CONCURRENT_CHECKS,users.length)},()=>worker()));
   if(active(token)){
    checkedUsers=checked-failed;failedUsers=failed;liveCount=lives;
    lastCheckAt=new Date(now()).toISOString();checkDurationMs=Math.max(0,now()-startedAt);
    message="登録配信者 "+checked+"/"+users.length+"人を確認。放送中 "+lives+"件"+
      (failed?"、取得失敗 "+failed+"人（"+lastFailure+"）":"")+
      "。次回確認は約"+config.intervalSeconds+"秒後。";
   }
  }finally{
   // Reconfiguration may start a new request while the previous request is still
   // finishing. An old generation must not overwrite the new generation's flags.
   if(token===generation){
    busy=false;
    if(config.enabled)nextCheckAt=now()+config.intervalSeconds*1000;
    emit();
   }
  }
  return status();
 }
 function configure(input){
  const next=normalizeMonitorConfig(input);
  const unchanged=next.enabled===config.enabled&&next.intervalSeconds===config.intervalSeconds&&
   next.notifyOnLive===config.notifyOnLive&&next.userIds.join(",")===config.userIds.join(",");
  if(unchanged)return {ok:true,status:status()};
  generation++;
  if(timer!==null){clearIntervalFn(timer);timer=null;}
  config=next;busy=false;
  if(!next.enabled||!next.userIds.length){
   config.enabled=false;nextCheckAt=0;
   message="登録配信者の監視は停止中です。";
   emit();return {ok:true,status:status()};
  }
  const allowed=new Set(config.userIds);
  notified=new Set([...notified].filter(key=>allowed.has(key.split(":")[0])));
  nextCheckAt=0;
  message="登録配信者 "+config.userIds.length+"人の監視を開始しました（最大"+MAX_CONCURRENT_CHECKS+"件並列）。";
  timer=setIntervalFn(()=>{void poll();},1000);
  emit();return {ok:true,status:status()};
 }
 return Object.freeze({configure,poll,status,dispose:()=>configure({enabled:false})});
}
module.exports={MAX_CONCURRENT_CHECKS,normalizeUserIds,buildRegisteredUserHistoryUrl,normalizeMonitorConfig,createRegisteredUserMonitor};
