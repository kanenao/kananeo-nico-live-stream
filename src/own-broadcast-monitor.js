"use strict";
const CHECK_MS=15000,RETRY_MS=30000;
const LIVE=new Set(["ON_AIR","ONAIR","TEST"]);
function createOwnBroadcastMonitor({getOwnBroadcast,onLive=()=>{},onStatus=()=>{},now=Date.now,setIntervalFn=setInterval,clearIntervalFn=clearInterval}){
 if(typeof getOwnBroadcast!=="function")throw new TypeError("getOwnBroadcast required");
 let running=false,busy=false,timer=null,epoch=0,nextCheckAt=0,lastCheckAt="",userId="",phase="stopped",message="自分の放送の監視を準備中です。",activePrograms=[],seen=new Set();
 const status=()=>({running,busy,phase,message,lastCheckAt,nextCheckAt,userId,activePrograms:activePrograms.map(x=>({...x}))});
 const notify=()=>{try{onStatus(status());}catch{}};
 async function check(force=false){
  if(!running||busy||(!force&&now()<nextCheckAt))return status();
  const token=epoch;busy=true;phase="checking";notify();let delay=CHECK_MS;
  try{
   const own=await getOwnBroadcast();
   if(token!==epoch||!running)return status();
   if(!own?.ok){
    delay=RETRY_MS;activePrograms=[];phase="waiting-login";
    message="ログイン確認中："+String(own?.message||"自分の放送を取得できません。").slice(0,120);
    userId="";seen.clear();
   }else{
    const account=String(own.userId||"");
    if(!/^\d{1,20}$/.test(account))throw Error("ログインアカウントの確認に失敗しました。");
    if(account!==userId){userId=account;seen.clear();}
    const rows=Array.isArray(own.programs)?own.programs:[];
    activePrograms=rows.filter(x=>/^lv\d{1,20}$/i.test(String(x?.programId||""))&&LIVE.has(String(x?.programStatus||"").toUpperCase())).map(x=>({
     programId:String(x.programId).toLowerCase(),title:String(x.title||x.programId).slice(0,200),userId:account
    }));
    for(const item of activePrograms){
     if(token!==epoch||!running)break;
     if(seen.has(item.programId))continue;
     seen.add(item.programId);if(seen.size>200)seen=new Set([...seen].slice(-100));
     try{onLive(item);}catch{}
    }
    phase="watching";message="自分の放送を監視中（約15秒間隔）。放送中："+activePrograms.length+"件";
   }
   lastCheckAt=new Date(now()).toISOString();
  }catch(error){
   if(token===epoch&&running){delay=RETRY_MS;phase="error";message="自分の放送の監視エラー："+String(error?.message||"通信エラー").slice(0,120);}
  }finally{
   busy=false;if(token===epoch&&running)nextCheckAt=now()+delay;notify();
  }
  return status();
 }
 function start(){
  if(running)return status();
  running=true;epoch++;phase="starting";message="アプリ起動とともに監視を開始しました。";nextCheckAt=0;
  timer=setIntervalFn(()=>{void check();},1000);notify();return status();
 }
 function stop(){epoch++;running=false;if(timer!==null)clearIntervalFn(timer);timer=null;busy=false;phase="stopped";activePrograms=[];message="アプリ終了により監視を停止しました。";notify();return status();}
 return Object.freeze({start,stop,check,status});
}
module.exports={CHECK_MS,RETRY_MS,createOwnBroadcastMonitor};
