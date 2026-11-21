"use strict";

// A broadcast extension must never spend points or tickets automatically.
// The historical NicoLive endpoint accepts {minutes}; confirm it with GET
// /extension first and verify the new end time independently afterwards.
const API_BASE="https://live2.nicovideo.jp/watch/";
function buildFreeExtensionRequest(programId, minutes){
 if(typeof programId!=="string"||!/^lv\d{1,20}$/i.test(programId))
  return {ok:false,code:"INVALID_PROGRAM_ID",message:"番組IDを確認してください。"};
 if(!Number.isInteger(minutes)||minutes<1||minutes>360)
  return {ok:false,code:"INVALID_EXTENSION_MINUTES",message:"延長時間を確認できません。"};
 return {ok:true,url:API_BASE+encodeURIComponent(programId.toLowerCase())+"/extension",
  method:"POST",body:{minutes}};
}
function selectFreeExtensionMethod(methods){
 if(!Array.isArray(methods))return null;
 const free=methods.filter(x=>String(x?.type||"").trim().toLowerCase()==="free"
  &&Number.isInteger(x?.minutes)&&x.minutes>=1&&x.minutes<=360);
 free.sort((a,b)=>a.minutes-b.minutes);
 return free.find(x=>x.minutes>=30)||free[0]||null;
}
function shouldTryAutoExtend(checked,nowMs=Date.now(),windowSeconds=300){
 const end=Number(checked?.endTime),programId=String(checked?.programId||"").toLowerCase();
 const status=String(checked?.programStatus||"").toUpperCase();
 if(checked?.ok!==true||!/^lv\d{1,20}$/.test(programId)||
   !["ON_AIR","ONAIR"].includes(status)||!Number.isFinite(end)||end<=0)
  return {due:false,reason:"unverified"};
 const secondsRemaining=end-nowMs/1000;
 return {due:secondsRemaining>0&&secondsRemaining<=windowSeconds,
  secondsRemaining,endTime:end,programId,
  reason:secondsRemaining<=0?"expired":secondsRemaining>windowSeconds?"early":"due"};
}
function createAutoExtensionMonitor({getOwnBroadcast,checkProgram,getOptions,extend,onStatus=()=>{},
 now=Date.now,setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}){
 if([getOwnBroadcast,checkProgram,getOptions,extend].some(fn=>typeof fn!=="function"))
  throw new TypeError("Auto extension monitor callbacks are required.");
 let enabled=false,busy=false,timer=null,disposed=false,phase="disabled",
  message="自動無料延長はOFFです。",lastCheckedAt="",lastProgramId="",lastSuccessAt="";
 let attempts=new Map();
 const status=()=>({enabled,busy,phase,message,lastCheckedAt,lastProgramId,lastSuccessAt});
 const emit=()=>{try{onStatus(status());}catch{}};
 async function poll(){
  if(disposed||!enabled||busy)return status();
  busy=true;phase="checking";message="自分の放送と無料延長の条件を確認中です。";emit();
  try{
   const own=await getOwnBroadcast();
   if(disposed||!enabled)return status();
   if(!own?.ok)throw new Error(own?.message||"自分の放送一覧を取得できません。");
   const current=(own.programs||[]).find(p=>["ON_AIR","ONAIR"].includes(String(p?.programStatus||"").toUpperCase())&&/^lv\d{1,20}$/i.test(String(p?.programId||"")));
   if(!current){phase="idle";message="自分の配信中の番組を待っています。";return status();}
   const id=String(current.programId).toLowerCase();lastProgramId=id;
   const info=await checkProgram(id);
   if(disposed||!enabled)return status();
   const due=shouldTryAutoExtend(info,now());
   if(!due.due||due.programId!==id){
    phase="watching";message=due.reason==="early"?"終了5分前まで監視中です（"+Math.ceil(due.secondsRemaining/60)+"分）。":"延長対象の放送時刻・状態を確認できません。";
    return status();
   }
   const key=id+":"+due.endTime;
   const attempted=attempts.get(key);
   // A failed or ambiguous POST is not repeated automatically for the same end time.
   if(attempted){
    phase=attempted.phase;message=attempted.message;return status();
   }
   const options=await getOptions({programId:id});
   if(disposed||!enabled)return status();
   if(!options?.ok){phase="unavailable";message=options?.message||"延長方法を確認できませんでした。";return status();}
   const free=selectFreeExtensionMethod(options.methods);
   if(!free){phase="unavailable";message="無料延長の選択肢がありません。有料延長は実行しません。";return status();}
   attempts.set(key,{phase:"pending",message:"延長要求を送信中です。"});
   phase="extending";message="無料延長 "+free.minutes+"分を要求しています。";emit();
   const result=await extend({programId:id,minutes:free.minutes,expectedEndTime:due.endTime});
   const finalMessage=String(result?.message||"延長要求の結果を確認できません。").slice(0,240);
   const finalPhase=result?.verified?"extended":result?.ok?"unverified":"error";
   attempts.set(key,{phase:finalPhase,message:finalMessage});
   if(result?.verified)lastSuccessAt=new Date(now()).toISOString();
   phase=finalPhase;message=finalMessage;
   if(attempts.size>40)attempts=new Map([...attempts].slice(-20));
   return status();
  }catch(error){phase="error";message=String(error?.message||"自動延長を確認できませんでした。").slice(0,240);return status();}
  finally{busy=false;lastCheckedAt=new Date(now()).toISOString();emit();}
 }
 function configure(input={}){
  if(disposed)return {ok:false,code:"DISPOSED"};
  enabled=input.enabled===true;
  if(timer!==null){clearIntervalFn(timer);timer=null;}
  if(enabled){
   phase="waiting";message="自分の配信を監視し、終了5分前に無料延長を確認します。";
   timer=setIntervalFn(()=>{void poll();},20000);void poll();
  }else{phase="disabled";message="自動無料延長はOFFです。";}
  emit();return {ok:true,status:status()};
 }
 function dispose(){disposed=true;enabled=false;if(timer!==null)clearIntervalFn(timer);timer=null;emit();}
 return Object.freeze({configure,poll,status,dispose});
}
module.exports={buildFreeExtensionRequest,selectFreeExtensionMethod,shouldTryAutoExtend,createAutoExtensionMonitor};
