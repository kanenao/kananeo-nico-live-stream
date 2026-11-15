"use strict";

/** Windows NSIS alpha-updater; never forces a restart during a live broadcast. */
function describeUpdateError(error){
 const rawCode=String(error?.code||"").toUpperCase();
 const code=/^[A-Z][A-Z0-9_]{1,69}$/.test(rawCode)?rawCode:"UPDATE_FAILED";
 const detail=String(error?.message||"");
 if(/CHANNEL_FILE_NOT_FOUND|Cannot find.*\.yml|(?:HTTP|status)\s*404|404 Not Found/i.test(code+" "+detail))
  return {code:"UPDATE_METADATA_NOT_FOUND",message:"GitHubにα版の更新情報が見つかりません。公開ページのalpha.ymlを確認してください。"};
 if(/403|429|RATE_LIMIT|FORBIDDEN/i.test(code+" "+detail))
  return {code:"UPDATE_ACCESS_LIMIT",message:"GitHubのアクセス制限により更新を確認できません。時間を置いて再試行してください。"};
 if(/ENOTFOUND|ETIMEDOUT|ECONN|EAI_AGAIN|ERR_NETWORK|network|net::|timeout/i.test(code+" "+detail))
  return {code:"UPDATE_NETWORK_ERROR",message:"更新サーバーへの通信に失敗しました。ネット接続・プロキシ・セキュリティソフトを確認してください。"};
 if(/sha512|checksum|hash|signature|integrity|verif/i.test(code+" "+detail))
  return {code:"UPDATE_VERIFY_FAILED",message:"ダウンロードした更新ファイルの検証に失敗しました。安全のためインストールしません。"};
 if(/EACCES|EPERM|access denied|permission/i.test(code+" "+detail))
  return {code:"UPDATE_PERMISSION_DENIED",message:"更新ファイルへのアクセスが拒否されました。Windowsのアクセス権を確認してください。"};
 return {code,message:"自動更新でエラーが発生しました（"+code+"）。設定から再確認するかGitHub Releasesで更新してください。"};
}
function createAutoUpdateService({app,updater,platform=process.platform,portable=false,notify=()=>{},schedule=setTimeout,repeat=setInterval}){
 const supported=platform==="win32"&&!!app?.isPackaged&&!portable&&!!updater;
 let status={
  supported,phase:supported?"idle":"unavailable",version:"",percent:0,errorCode:"",checkedAt:"",
  message:supported?"自動更新の初期化が完了しました。":
   portable?"Portable版は自動インストールできません。Setup版をインストールしてください。":
   !app?.isPackaged?"開発版からは自動更新できません。Windows Setup版でご利用ください。":
   "この環境ではWindows Setup版の自動更新を利用できません。"
 };
 let started=false,busy=false,installCalled=false;
 function publish(part){
  status={...status,...part};
  try{notify({...status});}catch{ /* UI may have been closed */ }
 }
 const getStatus=()=>({...status});
 function reportError(error){
  const info=describeUpdateError(error);
  publish({phase:"error",errorCode:info.code,message:info.message});
  return getStatus();
 }
 async function check(){
  if(!supported||busy||["downloading","downloaded","installing"].includes(status.phase))return getStatus();
  busy=true;
  publish({phase:"checking",errorCode:"",checkedAt:new Date().toISOString(),message:"GitHub Releasesからα版の更新を確認しています。"});
  try{
   const result=await updater.checkForUpdates();
   if(status.phase==="checking"&&result?.isUpdateAvailable===false)
    publish({phase:"current",message:"公開済みの最新版を使用しています。"});
  }catch(error){reportError(error);}
  finally{busy=false;}
  return getStatus();
 }
 function installReadyUpdate(){
  if(!supported||status.phase!=="downloaded"||installCalled)return false;
  installCalled=true;
  try{
   publish({phase:"installing",message:"アプリ終了後に更新を適用しています。"});
   // NSIS full-installer, silent, do not relaunch automatically. Caller has
   // already stopped comments/remote server before invoking this.
   updater.quitAndInstall(true,false);
   return true;
  }catch(error){
   installCalled=false;
   reportError(error);
   return false;
  }
 }
 function start(){
  if(started)return getStatus();
  started=true;
  if(!supported){publish({});return getStatus();}
  updater.autoDownload=true;
  updater.autoInstallOnAppQuit=true; // fallback if the normal quit route is used
  updater.allowPrerelease=true;
  updater.channel="alpha";
  updater.allowDowngrade=false;
  // Releases publish full NSIS EXEs and alpha.yml, but not differential blockmaps.
  // Avoid depending on missing .blockmap assets or HTTP range support.
  updater.disableDifferentialDownload=true;
  updater.on("checking-for-update",()=>publish({phase:"checking",message:"α版の更新を確認しています。"}));
  updater.on("update-available",info=>publish({
   phase:"downloading",version:String(info?.version||"").slice(0,70),percent:0,errorCode:"",
   message:"新しいα版をダウンロードしています。"
  }));
  updater.on("update-not-available",()=>publish({phase:"current",message:"公開済みの最新版です。"}));
  updater.on("download-progress",info=>publish({
   phase:"downloading",percent:Math.min(100,Math.max(0,Math.round(Number(info?.percent)||0))),
   message:"更新ファイルをダウンロードしています。"
  }));
  updater.on("update-downloaded",info=>publish({
   phase:"downloaded",version:String(info?.version||status.version).slice(0,70),percent:100,
   message:"更新ファイルを取得しました。終了時に適用できます。"
  }));
  updater.on("error",reportError);
  schedule(()=>{void check();},12000);
  repeat(()=>{void check();},4*60*60*1000);
  publish({});
  return getStatus();
 }
 return {start,check,getStatus,installReadyUpdate,reportError};
}
module.exports={createAutoUpdateService,describeUpdateError};
