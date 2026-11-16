"use strict";

const {evaluateAutoNextFrame}=require("./broadcast-management");
const CHECK_MS=5000, RETRY_MS=15000;

function createNextFrameMonitor({getOwnBroadcast, verifyProgram, openCreate, onStatus=()=>{},
 now=Date.now, setIntervalFn=setInterval, clearIntervalFn=clearInterval}){
 if([getOwnBroadcast,verifyProgram,openCreate,onStatus].some(fn=>typeof fn!=="function"))
  throw new TypeError("次枠監視の処理が不足しています。");
 let generation=0,timer=null,userId="",armedProgramId="",lastTriggeredId="";
 let enabled=false,busy=false,autoCreate=false,nextProgramId="",phase="disabled",message="自動次枠監視は停止中です。",lastCheckAt="",nextCheckAt=0;
 const validId=value=>/^lv\d{1,20}$/i.test(String(value||""))?String(value).toLowerCase():"";
 const status=()=>({enabled,busy,autoCreate,nextProgramId,armedProgramId,lastTriggeredId,phase,message,lastCheckAt,nextCheckAt});
 const emit=()=>{try{onStatus(status());}catch{}};
 const active=token=>enabled&&token===generation;
 async function poll(force=false){
  if(!enabled||busy||(!force&&now()<nextCheckAt))return status();
  const token=generation;
  busy=true;phase="checking";emit();
  let interval=CHECK_MS;
  try{
   const own=await getOwnBroadcast();
   if(!active(token))return status();
   if(!own?.ok)throw Error(own?.message||"自分の番組を取得できませんでした。");
   const account=String(own.userId||"");
   if(!/^\d{1,20}$/.test(account))throw Error("ログイン中のアカウントを確認できませんでした。");
   if(account!==userId){
    if(userId)lastTriggeredId="";
    userId=account;armedProgramId="";nextProgramId="";
   }
   const plan=evaluateAutoNextFrame({armedProgramId},own.programs,lastTriggeredId);
   armedProgramId=plan.armedProgramId;
   lastCheckAt=new Date(now()).toISOString();
   if(plan.triggerProgramId){
    const info=await verifyProgram(plan.triggerProgramId);
    if(!active(token))return status();
    const ended=["ENDED","END","CLOSED"].includes(String(info?.programStatus||"").toUpperCase());
    if(!info?.ok||validId(info.programId)!==plan.triggerProgramId||!ended){
     phase="verifying";message="番組終了を確定できません。次回再確認します。";
    }else{
     const opened=await openCreate(plan.triggerProgramId,account,autoCreate);
     if(!active(token))return status();
     if(!opened?.ok)throw Error(opened?.message||"番組作成画面を開けませんでした。");
     lastTriggeredId=plan.triggerProgramId;armedProgramId="";
     nextProgramId=validId(opened.programId);
     phase="prepared";
     message=nextProgramId
      ?"放送 "+plan.triggerProgramId+" の設定を引き継ぎ、次枠 "+nextProgramId+" を自動作成しました。"
      :"放送 "+plan.triggerProgramId+" の終了を検知し、次枠の作成画面を開きました。作成確定は公式画面で行ってください。";
    }
   }else if(plan.reason==="watching-live"){
    phase="watching";message="放送 "+armedProgramId+" をアプリ本体で監視中（約5秒間隔）。";
   }else if(plan.reason==="next-already-exists"){
    phase="skipped";message="別の予約番組があるため重複準備を防止しました。";
   }else if(plan.reason==="already-triggered"){
    phase="prepared";message="この番組の次枠準備は一度実行済みです。";
   }else{
    phase="waiting";message="自分の放送開始・終了をアプリ本体で確認しています（約5秒間隔）。";
   }
  }catch(error){
   if(active(token)){interval=RETRY_MS;phase="error";message="次枠監視エラー："+String(error?.message||"通信失敗").slice(0,120);}
  }finally{
   busy=false;
   if(active(token))nextCheckAt=now()+interval;
   emit();
  }
  return status();
 }
 function configure(input){
  if(!input||typeof input.enabled!=="boolean")
   return {ok:false,code:"INVALID_INPUT",message:"次枠監視設定を確認してください。"};
  if(!input.enabled){
   generation++;if(timer!==null)clearIntervalFn(timer);timer=null;
   enabled=false;autoCreate=false;armedProgramId="";userId="";phase="disabled";message="自動次枠監視は停止中です。";nextCheckAt=0;
   emit();return {ok:true,status:status()};
  }
  autoCreate=input.autoCreate===true;
  if(!enabled){
   generation++;enabled=true;lastTriggeredId=validId(input.lastTriggeredId);
   phase="waiting";message="自分の番組を確認しています…";nextCheckAt=0;
   timer=setIntervalFn(()=>{void poll();},1000);
  }
  emit();return {ok:true,status:status()};
 }
 return Object.freeze({configure,poll,status,dispose:()=>configure({enabled:false})});
}
module.exports={createNextFrameMonitor,CHECK_MS,RETRY_MS};
