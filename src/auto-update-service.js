"use strict";
const {getReleaseChannel}=require("./update-channel");
const {compareVersions}=require("./update-checker");
const {fetchVerifiedAlphaReleases,selectAlphaUpdateRelease,isMetadataMissingError,isGitHubUpdateNotFound}=require("./update-metadata-recovery");

/** Windows NSIS alpha-updater; never forces a restart during a live broadcast. */
function describeUpdateError(error){
 const rawCode=String(error?.code||"").toUpperCase();
 const code=/^[A-Z][A-Z0-9_]{1,69}$/.test(rawCode)?rawCode:"UPDATE_FAILED";
 const detail=String(error?.message||"");
 if(isMetadataMissingError(error))
  return {code:"UPDATE_METADATA_NOT_FOUND",message:"GitHubに自動更新用のチャンネル情報が見つかりません。対象リリースの更新用YMLファイルを確認してください。"};
 if(isGitHubUpdateNotFound(error))
  return {code:"UPDATE_RELEASE_NOT_FOUND",message:"GitHubの更新ファイルを取得できませんでした（HTTP 404）。配布版の確認または再試行をしてください。"};
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
function createAutoUpdateService({app,updater,platform=process.platform,portable=false,notify=()=>{},schedule=setTimeout,repeat=setInterval,releaseFetch=fetch,fallbackDownload=null,launchInstaller=null}){
 const installedVersion=String(app?.getVersion?.()||"0.2.0-alpha.0");
 const channel=getReleaseChannel(installedVersion)||"alpha";
 const supported=platform==="win32"&&!!app?.isPackaged&&!portable&&!!updater;
 let status={
  supported,channel,currentVersion:installedVersion,phase:supported?"idle":"unavailable",version:"",percent:0,errorCode:"",checkedAt:"",
  source:"",message:supported?"自動更新の初期化が完了しました。":
   portable?"Portable版は自動インストールできません。Setup版をインストールしてください。":
   !app?.isPackaged?"開発版からは自動更新できません。Windows Setup版でご利用ください。":
   "この環境ではWindows Setup版の自動更新を利用できません。"
 };
 let started=false,busy=false,installCalled=false,usingPinnedRelease=false;
 let verifiedTarget=null,fallbackFilePath="";
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
  let verifiedAvailableVersion="";
  publish({phase:"checking",errorCode:"",source:"",checkedAt:new Date().toISOString(),
   message:"公開済み"+channel+"版の配布ファイルを確認しています。"});
  function settle(result){
   if(status.phase!=="checking")return;
   const candidate=String(result?.updateInfo?.version||"");
   const compared=candidate?compareVersions(candidate,installedVersion):null;
   if(result?.isUpdateAvailable===false||compared!==null&&compared<=0){
    publish({phase:"current",errorCode:"",message:"公開済みの最新版を使用しています。"});
   }else if(compared!==null&&compared>0&&result?.downloadPromise){
    publish({phase:"downloading",version:candidate,percent:0,message:"更新版が見つかりました。ダウンロードしています。"});
   }else{
    publish({phase:"error",errorCode:"UPDATE_CHECK_INCOMPLETE",
     message:"更新確認の結果を読み取れませんでした。配布ページと通信状態を確認してください。"});
   }
  }
  async function runFeed(){
   const result=await updater.checkForUpdates();
   // A tagged API release has already proven there is a newer alpha. Do not
   // let a stale GitHub/Atom response incorrectly claim the app is current.
   const candidate=String(result?.updateInfo?.version||"");
   const comparison=candidate?compareVersions(candidate,installedVersion):null;
   if(verifiedAvailableVersion&&(result?.isUpdateAvailable===false||
      comparison!==null&&comparison<=0)){
    publish({phase:"error",errorCode:"UPDATE_FEED_MISMATCH",
     message:"新しいα版 "+verifiedAvailableVersion+" は公開済みですが、更新サービスから古い版が返されました。安全のため適用しません。"});
    return result;
   }
   settle(result);
   // electron-updater may reject downloadPromise only after checkForUpdates
   // has resolved. Await it so download-time HTTP 404 is never lost.
   if(result?.downloadPromise)await result.downloadPromise;
   return result;
  }
  function selectVerifiedTarget(releases){
   if(!Array.isArray(releases)||releases.length===0)return {checked:false};
   const target=selectAlphaUpdateRelease(releases,installedVersion);
   if(target)return {checked:true,target};
   const hasNewer=releases.some(release=>release?.draft!==true&&release?.prerelease===true&&
    /^v\d+\.\d+\.\d+-alpha\.\d+$/.test(String(release?.tag_name||""))&&
    compareVersions(String(release.tag_name).slice(1),installedVersion)>0);
   if(hasNewer)return {checked:true,missing:true};
   const hasCurrent=releases.some(release=>release?.draft!==true&&release?.prerelease===true&&
    release?.tag_name==="v"+installedVersion);
   if(hasCurrent)return {checked:true,current:true};
   return {checked:false};
  }
  function pinVerifiedRelease(target){
   verifiedTarget=target;
   updater.setFeedURL({provider:"generic",url:target.url,channel:"alpha"});
   usingPinnedRelease=true;
   verifiedAvailableVersion=target.version;
   publish({phase:"checking",source:"verified-release",version:target.version,errorCode:"",
    message:"GitHubで確認した "+target.tag+" の配布ファイルから更新を取得しています。"});
  }
  function resetToGitHub(){
   updater.setFeedURL({provider:"github",owner:"kanenao",repo:"kananeo-nico-live-stream",channel});
   usingPinnedRelease=false;
  }
  async function tryVerifiedInstallerFallback(){
   // Fall back only after a known HTTP 404 on the official verified updater
   // routes. The official asset digest is checked before the Setup is usable.
   if(!verifiedTarget||typeof fallbackDownload!=="function")return false;
   publish({phase:"downloading",source:"github-asset-fallback",version:verifiedTarget.version,
    percent:0,errorCode:"",
    message:"更新サーバーの404を検出しました。公式GitHubのSetup版を別経路で検証・取得しています。"});
   try{
    const downloaded=await fallbackDownload(verifiedTarget,percent=>{
     if(status.phase!=="downloading"||status.source!=="github-asset-fallback")return;
     publish({percent:Math.max(0,Math.min(100,Math.floor(Number(percent)||0)))});
    });
    if(!downloaded||downloaded.version!==verifiedTarget.version||
      typeof downloaded.filePath!=="string"||!downloaded.filePath)
      throw Object.assign(Error("安全確認されたSetup版を取得できませんでした。"),{code:"UPDATE_VERIFY_FAILED"});
    fallbackFilePath=downloaded.filePath;
    publish({phase:"downloaded-manual",version:verifiedTarget.version,percent:100,
     errorCode:"",source:downloaded.source||"github-asset-fallback",
     message:"公式GitHubのSetup版を検証・取得しました。「インストーラーを起動」から更新できます。自動的な上書きインストールではありません。"});
   }catch(error){
    fallbackFilePath="";
    const code=String(error?.code||"");
    publish({phase:"error",errorCode:code==="DOWNLOAD_VERIFY_FAILED"||code==="DOWNLOAD_SIZE_MISMATCH"?"UPDATE_VERIFY_FAILED":"UPDATE_FALLBACK_FAILED",
     message:code==="DOWNLOAD_VERIFY_FAILED"||code==="DOWNLOAD_SIZE_MISMATCH"?
      "公式配布ファイルの検証に失敗しました。ファイルは適用しません。":
      "GitHub公式の予備ダウンロードにも失敗しました。配布ページからSetup版を確認してください。"});
   }
   return true;
  }
  async function handleVerifiedAlpha(releases){
   const checked=selectVerifiedTarget(releases);
   if(!checked.checked)return false;
   if(checked.current){
    publish({phase:"current",errorCode:"",message:"GitHubの公開リリースを確認しました。現在のα版が最新版です。"});
    return true;
   }
   if(checked.missing){
    publish({phase:"error",errorCode:"UPDATE_METADATA_NOT_FOUND",
     message:"新しいα版が公開されていますがalpha.ymlまたはSetup版が不足しています。配布ページを確認してください。"});
    return true;
   }
   pinVerifiedRelease(checked.target);
   await runFeed();
   return true;
  }
  try{
   // GitHubProvider can receive 404 on GitHub's prerelease discovery even
   // though a versioned Release contains valid alpha.yml and NSIS Setup.
   // On alpha, prefer the public Releases API and pin the complete release
   // *before* electron-updater attempts to resolve its metadata or binaries.
   if(channel==="alpha"&&typeof updater.setFeedURL==="function"){
    const verified=await fetchVerifiedAlphaReleases(releaseFetch);
    if(await handleVerifiedAlpha(verified))return getStatus();
   }
   // API inaccessible: keep the original provider as a safe fallback.
   if(usingPinnedRelease)resetToGitHub();
   publish({source:"github-fallback"});
   await runFeed();
  }catch(error){
   // A generic pinned feed might suffer a transient 404 at the release CDN.
   // Try the official GitHub provider once more, without changing the target
   // repository or bypassing update checksum verification.
   if(usingPinnedRelease&&isGitHubUpdateNotFound(error)){
    try{
     publish({phase:"checking",errorCode:"",
      message:"確認済みリリースの取得に失敗したためGitHub標準経路で再試行します。"});
     resetToGitHub();
     publish({source:"github-fallback"});
     await runFeed();
    }catch(retryError){if(!await tryVerifiedInstallerFallback())reportError(retryError);}
   }else if(channel==="alpha"&&isGitHubUpdateNotFound(error)&&
            typeof updater.setFeedURL==="function"){
    const retryReleases=await fetchVerifiedAlphaReleases(releaseFetch);
    try{
     if(!await handleVerifiedAlpha(retryReleases))reportError(error);
    }catch(retryError){if(!await tryVerifiedInstallerFallback())reportError(retryError);}
   }else reportError(error);
  }finally{busy=false;}
  return getStatus();
 }
 async function launchFallbackInstaller(){
  if(!supported||status.phase!=="downloaded-manual"||!fallbackFilePath||
    installCalled||typeof launchInstaller!=="function")
   return {ok:false,code:"UPDATE_NOT_READY",message:"検証済みSetup版が準備できていません。"};
  installCalled=true;
  try{
   const result=await launchInstaller(fallbackFilePath);
   if(typeof result==="string"&&result)throw Error(result);
   publish({phase:"installing",message:"Setup版を起動しました。画面に従ってインストールしてください。"});
   return {ok:true,message:"Setup版を起動しました。アプリを終了します。"};
  }catch{
   installCalled=false;
   publish({phase:"downloaded-manual",errorCode:"UPDATE_INSTALLER_LAUNCH_FAILED",
    message:"Setup版を起動できませんでした。Windowsのアクセス権やセキュリティ設定を確認してください。"});
   return {ok:false,code:"UPDATE_INSTALLER_LAUNCH_FAILED",message:"Setup版を起動できませんでした。"};
  }
 }
 function installReadyUpdate({relaunch=false}={}){
  if(!supported||status.phase!=="downloaded"||installCalled)return false;
  installCalled=true;
  try{
   publish({phase:"installing",message:relaunch?"更新を適用してアプリを再起動します。":"アプリ終了後に更新を適用しています。"});
   // NSIS full-installer, silent, do not relaunch automatically. Caller has
   // already stopped comments/remote server before invoking this.
   updater.quitAndInstall(true,relaunch===true);
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
  updater.allowPrerelease=channel!=="latest";
  updater.channel=channel;
  updater.allowDowngrade=false;
  // Releases publish full NSIS EXEs and alpha.yml, but not differential blockmaps.
  // Avoid depending on missing .blockmap assets or HTTP range support.
  updater.disableDifferentialDownload=true;
  updater.on("checking-for-update",()=>publish({phase:"checking",message:channel+"チャンネルの更新を確認しています。"}));
  updater.on("update-available",info=>publish({
   phase:"downloading",version:String(info?.version||"").slice(0,70),percent:0,errorCode:"",
   message:"新しいバージョンを自動ダウンロードしています。"
  }));
  updater.on("update-not-available",()=>{
   if(["downloaded","installing","downloading"].includes(status.phase))return;
   publish({phase:"current",message:"公開済みの最新版です。"});
  });
  updater.on("download-progress",info=>{
   if(status.phase==="downloaded"||status.phase==="installing")return;
   publish({phase:"downloading",percent:Math.min(100,Math.max(0,Math.round(Number(info?.percent)||0))),
    message:"更新ファイルをダウンロードしています。"});
  });
  updater.on("update-downloaded",info=>publish({
   phase:"downloaded",version:String(info?.version||status.version).slice(0,70),percent:100,
   message:"更新ファイルを取得しました。終了時に適用できます。"
  }));
  updater.on("error",error=>{if(!busy&&status.phase!=="downloaded-manual")reportError(error);});
  schedule(()=>{void check();},12000);
  repeat(()=>{void check();},30*60*1000);
  publish({});
  return getStatus();
 }
 return {start,check,getStatus,installReadyUpdate,launchFallbackInstaller,reportError};
}
module.exports={createAutoUpdateService,describeUpdateError};
