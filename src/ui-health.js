"use strict";

function sanitizeUiError(error) {
  const name=typeof error?.name==="string"?error.name:"Error";
  const raw=typeof error?.message==="string"?error.message:String(error||"不明なエラー");
  const message=raw
    .replace(/(?:https?:\/\/|file:\/\/)[^\s"'<>]+/gi,"[URL]")
    .replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s"'<>]+/gi,"[パス]")
    .replace(/\b(user_session|authorization|csrf_token|bearer|token)\b\s*[:=]\s*[^\s&"'<>]+/gi,"$1=[非表示]")
    .replace(/[\r\n]+/g," ").slice(0,180);
  return {name:name.slice(0,48),message};
}
function uiStatusLabel(ready,bridge) {
  if(!ready)return "画面の初期化が完了していません。";
  if(!bridge)return "Electron連携APIが見つかりません。アプリを再起動してください。";
  return "画面操作とElectron連携APIを認識しました。";
}
if(typeof module!=="undefined"&&module.exports)module.exports={sanitizeUiError,uiStatusLabel};
if(typeof window!=="undefined"&&typeof document!=="undefined"){
 (() => {
  let rendererReady=false;
  let lastAction="操作なし";
  let lastError="";
  function output(text,isError=false){
   const node=document.getElementById("ui-health-status");
   if(node){node.textContent=text;node.classList.toggle("error",isError);}
  }
  function showError(title,error){
   const detail=sanitizeUiError(error);
   lastError=title+"："+detail.name+" / "+detail.message;
   output("操作エラーを検知しました",true);
   const banner=document.getElementById("ui-error-banner");
   if(banner){banner.hidden=false;banner.textContent=lastError+"。改善しない場合は「画面を再読み込み」を押してください。";}
   const reload=document.getElementById("ui-health-reload");
   if(reload)reload.hidden=false;
  }
  function report(error,context="アプリ"){showError(String(context||"操作").slice(0,50),error);}
  function trackAction(label){lastAction=String(label||"ボタン").trim().slice(0,60);}
  function markReady(){rendererReady=true;if(!lastError)output("画面操作：準備完了");}
  async function diagnose(){
   const bridge=!!window.kananeoApp?.niconico?.getSessionStatus;
   output("診断中…");
   if(!rendererReady||!bridge){showError("操作診断",new Error(uiStatusLabel(rendererReady,bridge)));return;}
   try{
    let timer;
    const timeout=new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error("Electron連携が応答しません（6秒）。")),6000);});
    try{await Promise.race([window.kananeoApp.niconico.getSessionStatus(),timeout]);}
    finally{clearTimeout(timer);}
    if(lastError)output("診断：IPC応答あり。直近エラーを確認してください。",true);
    else output("診断OK：ボタン入力・画面初期化・Electron連携すべて応答しました。");
   }catch(error){report(error,"操作診断");}
  }
  window.addEventListener("error",event=>{
   if(event?.target&&event.target!==window){
    if(event.target.tagName==="SCRIPT")showError("画面の起動",new Error("画面用スクリプトを読み込めませんでした。"));
    return;
   }
   report(event?.error||new Error(event?.message||"JavaScriptエラー"),"画面の処理");
  },true);
  window.addEventListener("unhandledrejection",event=>{report(event?.reason||new Error("非同期処理に失敗しました。"),"通信・非同期処理");});
  document.addEventListener("DOMContentLoaded",()=>{
   document.getElementById("ui-health-check")?.addEventListener("click",()=>{trackAction("操作診断");void diagnose();});
   document.getElementById("ui-health-reload")?.addEventListener("click",()=>{window.location.reload();});
   setTimeout(()=>{if(!rendererReady&&!lastError)showError("画面の起動",new Error("初期化が完了していません。"));},2500);
  });
  window.KananeoUiHealth=Object.freeze({markReady,report,trackAction,diagnose});
 })();
}
