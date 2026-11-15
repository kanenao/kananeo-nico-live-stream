"use strict";
/* Never restart a live broadcast. Download updates, install on normal application exit. */
function createAutoUpdateService({app,updater,platform=process.platform,portable=false,notify=()=>{},schedule=setTimeout,repeat=setInterval}){
 const supported=platform==="win32"&&!!app?.isPackaged&&!portable&&!!updater;
 let status={supported,phase:supported?"idle":"unavailable",version:"",percent:0,message:supported?"自動更新を準備中です。":portable?"Portable版は自動更新できません。GitHub Releasesから更新してください。":"この環境では自動更新を利用できません。"};
 let started=false,busy=false;
 const emit=part=>{status={...status,...part};notify({...status});};
 const getStatus=()=>({...status});
 async function check(){
  if(!supported||busy||["downloading","downloaded"].includes(status.phase))return getStatus();
  busy=true;emit({phase:"checking",message:"新しいα版を確認しています。"});
  try{await updater.checkForUpdates();}
  catch{emit({phase:"error",message:"自動更新の確認に失敗しました。通信状態を確認するかGitHub Releasesから手動更新してください。"});}
  finally{busy=false;}
  return getStatus();
 }
 function start(){
  if(started)return getStatus();started=true;
  if(!supported){notify(getStatus());return getStatus();}
  updater.autoDownload=true;
  updater.autoInstallOnAppQuit=true;
  updater.allowPrerelease=true;
  updater.channel="alpha";
  updater.allowDowngrade=false;
  updater.on("checking-for-update",()=>emit({phase:"checking",message:"α版の更新情報を確認しています。"}));
  updater.on("update-available",info=>emit({phase:"downloading",version:String(info?.version||"").slice(0,70),percent:0,message:"新しいα版を自動ダウンロードしています。"}));
  updater.on("update-not-available",()=>emit({phase:"current",message:"公開済みの最新版です。"}));
  updater.on("download-progress",info=>emit({phase:"downloading",percent:Math.max(0,Math.min(100,Math.round(Number(info?.percent)||0))),message:"更新ファイルをダウンロードしています。"}));
  updater.on("update-downloaded",info=>emit({phase:"downloaded",version:String(info?.version||status.version).slice(0,70),percent:100,message:"ダウンロード完了。アプリ終了時に更新を適用します。"}));
  updater.on("error",()=>emit({phase:"error",message:"自動更新でエラーが発生しました。GitHub Releasesから手動更新できます。"}));
  schedule(()=>{void check();},12000);
  repeat(()=>{void check();},4*60*60*1000);
  notify(getStatus());
  return getStatus();
 }
 return {start,check,getStatus};
}
module.exports={createAutoUpdateService};
