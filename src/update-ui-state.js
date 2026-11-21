"use strict";
// Shared state machine for a persistent in-app update banner. This module never
// creates URLs or starts an installation; actions are handled by guarded IPC.
function inAppUpdateNotice(status={},release=null){
 const phase=String(status?.phase||"");
 const supported=status?.supported===true;
 const candidate=String(status?.version||release?.latestVersion||"").slice(0,70);
 const available=release?.ok===true&&release?.updateAvailable===true;
 const normal={visible:true,title:"自動更新",detail:"更新状況を確認しています。",action:"",actionLabel:"",showReleases:false};
 if(supported&&phase==="downloaded"){
  return {...normal,visible:true,title:"アプリの更新準備ができました： "+(candidate||"新しいバージョン"),
   detail:"ダウンロード完了。放送終了後に「更新して再起動」を押すか、通常終了時に自動適用できます。",
   action:"apply",actionLabel:"更新して再起動",showReleases:true};
 }
 if(supported&&phase==="downloading"){
  const percent=Math.max(0,Math.min(100,Math.round(Number(status?.percent)||0)));
  return {...normal,visible:true,title:"新しいα版をダウンロード中"+(candidate?"： "+candidate:""),
   detail:"ダウンロード "+percent+"%。完了したらアプリ内から更新できます。",
   showReleases:false};
 }
 if(supported&&phase==="installing"){
  return {...normal,visible:true,title:"更新の適用を開始しました",
   detail:"アプリ終了処理の完了後にインストーラーを起動します。",showReleases:false};
 }
 if(!available){
  if(phase==="checking")return {...normal,title:"自動更新を確認中",detail:"GitHub Releasesの更新情報を確認しています。"};
  if(phase==="error"||phase==="unavailable")return {...normal,
   title:"自動更新を確認できませんでした",
   detail:String(status?.message||"更新情報の取得に失敗しました。").slice(0,220),
   action:supported?"check":"releases",actionLabel:supported?"再確認":"配布ページを開く",showReleases:supported};
  if(release?.ok===true&&release?.updateAvailable===false)return {...normal,
   title:"自動更新：最新版です",
   detail:"現在のバージョンは最新です。必要に応じて再確認できます。",
   action:supported?"check":"releases",actionLabel:supported?"更新を確認":"配布ページを開く",showReleases:supported};
  return {...normal,title:"自動更新：更新待機中",
   detail:"更新があるか確認できます。更新が見つからない場合もこの欄は表示されます。",
   action:supported?"check":"releases",actionLabel:supported?"更新を確認":"配布ページを開く",showReleases:supported};
 }
 if(supported&&release?.automaticUpdateAvailable===true){
  if(phase==="checking")return {...normal,visible:true,
   title:"新しいα版が公開されています： "+candidate,
   detail:"アプリから更新ファイルを確認しています。",showReleases:true};
  if(phase==="error")return {...normal,visible:true,
   title:"新しいα版がありますが、アプリ内更新に失敗しました： "+candidate,
   detail:String(status?.message||"設定から更新診断を確認してください。").slice(0,220),
   action:"check",actionLabel:"再度ダウンロードを試す",showReleases:true};
  return {...normal,visible:true,title:"新しいα版が公開されました： "+candidate,
   detail:"アプリ内で更新ファイルを取得できます。配信中には強制再起動しません。",
   action:"check",actionLabel:"アプリ内で更新する",showReleases:true};
 }
 if(!supported&&phase==="idle")return {...normal,visible:true,
  title:"新しいα版が公開されています： "+candidate,
  detail:"自動更新機能を準備しています。",showReleases:true};
 return {...normal,visible:true,title:"新しいα版が公開されています： "+candidate,
  detail:"この環境またはリリースではアプリ内更新できません。GitHub Releasesから更新してください。",
  action:"releases",actionLabel:"配布ページを開く",showReleases:false};
}
if(typeof module!=="undefined"&&module.exports)module.exports={inAppUpdateNotice};
if(typeof window!=="undefined")window.KananeoUpdateUi={inAppUpdateNotice};
