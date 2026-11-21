"use strict";
// Presentation only: release and update actions remain guarded in the renderer/main IPC.
function escapeHistoryText(value){
 return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function historyLines(values){
 return (Array.isArray(values)?values:[]).filter(value=>typeof value==="string"&&value.trim()).map(value=>value.trim());
}
function historyType(version){
 return /-alpha\./i.test(String(version))?"alpha":/-(?:beta|rc)\./i.test(String(version))?"beta":"stable";
}
function readableDate(value){
 const date=value?new Date(value):null;
 return date&&Number.isFinite(date.getTime())?date.toLocaleString("ja-JP"):"公開日未確認";
}
function compactHistoryLine(value,max=160){
 const clean=String(value??"").replace(/\s+/g," ").trim();
 return clean.length>max?clean.slice(0,max)+"…":clean;
}
function releaseHistorySummary(state={},installedVersion="",check={},auto={}){
 const items=Array.isArray(state.items)?state.items:[];
 const verified=check?.result?.ok===true;
 const fetched=(!state.offline&&items.find(item=>item?.localOnly!==true&&item?.version))||null;
 const latest=(verified&&(check.result.latestVersion||check.result.release?.version))||fetched?.version||"未確認";
 const source=verified?"GitHubの更新確認結果":fetched?"取得済みの公開履歴（最新版とは限りません）":"公開版は未確認";
 let status="更新状況を確認中",detail="アプリ起動時に更新を確認します。手動でも再確認できます。",tone="neutral";
 const phase=String(auto?.phase||"");
 if(phase==="downloaded"){status="更新の準備ができました";detail="ダウンロード済みです。放送終了後に更新を適用してください。";tone="ready";}
 else if(phase==="downloading"){status="ダウンロード中";detail="更新ファイルを取得中："+Math.max(0,Math.min(100,Math.round(Number(auto.percent)||0)))+"%";tone="checking";}
 else if(phase==="installing"){status="更新の適用中";detail="アプリを終了して更新を適用します。";tone="checking";}
 else if(phase==="error"||phase==="unavailable"){status="自動更新を確認できません";detail=String(auto.message||"設定画面から更新診断を確認してください。").slice(0,180);tone="error";}
 else if(check?.error){status="公開版の確認に失敗";detail=String(check.error).slice(0,180);tone="error";}
 else if(verified&&check.result.updateAvailable===true){status="新しいバージョンがあります";detail="更新情報を確認し、アプリ内から更新できます。";tone="available";}
 else if(verified&&check.result.updateAvailable===false){status="現在の版は最新です";detail="公開済みの更新情報を確認しました。";tone="ready";}
 else if(check?.loading){status="GitHubの公開版を確認中";detail="更新情報を取得しています。";tone="checking";}
 const current=escapeHistoryText(installedVersion||"取得できません");
 const latestHtml=escapeHistoryText(latest);
 const statusHtml=escapeHistoryText(status),detailHtml=escapeHistoryText(detail);
 const apply=phase==="downloaded"&&auto?.supported===true?
  '<button class="btn primary" type="button" data-update-auto-apply>更新して再起動</button>':"";
 return '<div class="release-overview" aria-label="バージョン情報の概要">'+
  '<div class="release-overview-cell"><span>現在のバージョン</span><strong>'+current+'</strong><small>このパソコンで使用中</small></div>'+
  '<div class="release-overview-cell"><span>確認できた公開版</span><strong>'+latestHtml+'</strong><small>'+escapeHistoryText(source)+'</small></div>'+
  '<div class="release-overview-cell release-overview-state '+tone+'"><span>更新状態</span><strong>'+statusHtml+'</strong><small>'+detailHtml+'</small></div></div>'+
  '<div class="release-overview-actions"><button class="btn primary" type="button" data-update-auto-check>更新を確認する</button>'+apply+
  '<button class="btn" type="button" data-go="settings">更新設定・診断を開く</button>'+
  '<span class="release-overview-help">放送中に自動で再起動しません。Portable版は配布ページをご利用ください。</span></div>';
}
function releaseHistoryEntries(state={},installedVersion=""){
 const sourceItems=Array.isArray(state.items)?state.items:[];
 const query=String(state.query||"").trim().toLocaleLowerCase("ja-JP");
 const filter=String(state.type||"all");
 const items=sourceItems.filter(item=>{
  if(!item||typeof item!=="object")return false;
  if(filter!=="all"&&historyType(item.version)!==filter)return false;
  if(!query)return true;
  return [item.version,item.title,...historyLines(item.notes),...historyLines(item.details)].join(" ").toLocaleLowerCase("ja-JP").includes(query);
 });
 const markup=items.map((item,index)=>{
  const local=item.localOnly===true,kind=historyType(item.version);
  const type=kind==="alpha"?"α開発版":kind==="beta"?"βテスト版":"製品版";
  const notes=historyLines(item.notes),details=historyLines(item.details);
  const installed=item.version===String(installedVersion||"");
  const preview=[...notes,...details].slice(0,2);
  const previewHtml=preview.length?'<ul class="release-history-preview">'+preview.map(note=>'<li>'+escapeHistoryText(compactHistoryLine(note))+'</li>').join("")+'</ul>':
   '<p class="release-history-empty-note">変更内容の詳細は登録されていません。</p>';
  const renderNotes=(label,rows)=>rows.length?
   '<section class="release-history-note-group"><h3>'+label+'</h3><ul class="release-notes">'+rows.map(note=>'<li>'+escapeHistoryText(note)+'</li>').join("")+'</ul></section>':"";
  const infoCount=details.length+notes.length;
  const disclosure=infoCount?
   '<details class="release-history-disclosure"><summary>すべての変更内容を見る（'+infoCount+'項目）</summary>'+
    '<div class="release-history-full">'+renderNotes("GitHub Releasesに掲載された変更",notes)+
    renderNotes("アプリ同梱の詳細更新履歴",details)+'</div></details>':"";
  const label=local?"公開情報未確認":item.setupAvailable===true?"Windows Setupあり":"Setup配布は未確認";
  const external=local?
   '<button class="btn" type="button" data-update-open-releases>公開一覧を開く</button>':
   '<button class="btn" type="button" data-release-history-open="'+escapeHistoryText(item.tag||"")+'">GitHubで確認</button>';
  const title=String(item.title||"").trim();
  const top=!index&&!query&&filter==="all";
  return '<article class="release-history-item'+(top?' release-history-featured':'')+'">'+
    '<div class="release-history-heading"><div class="release-history-heading-main">'+
    '<div class="release-history-meta"><span>'+escapeHistoryText(type)+'</span>'+
    (installed?'<span class="release-history-pill installed">使用中</span>':"")+
    (top?'<span class="release-history-pill">取得履歴の先頭</span>':"")+'</div>'+
    '<b>'+escapeHistoryText(item.version||"バージョン不明")+'</b>'+
    (title&&title!==item.version?'<p class="release-history-release-title">'+escapeHistoryText(compactHistoryLine(title,180))+'</p>':"")+
    '<small>公開：'+escapeHistoryText(readableDate(item.publishedAt))+'　·　'+escapeHistoryText(label)+(local?'　·　アプリ同梱の情報':"")+'</small>'+
    '</div>'+external+'</div>'+previewHtml+disclosure+'</article>';
 }).join("");
 const empty=state.loading?"履歴を読み込んでいます…":
  sourceItems.length?"条件に合うバージョンはありません。検索語や公開区分を変更してください。":
  state.error?"取得に失敗しました。「最新の履歴を再取得」をお試しください。":
  "公開済みの履歴はまだ表示できません。";
 return {markup:markup||'<div class="empty">'+escapeHistoryText(empty)+'</div>',count:items.length};
}
if(typeof module!=="undefined"&&module.exports)module.exports={releaseHistorySummary,releaseHistoryEntries,historyType,readableDate};
if(typeof window!=="undefined")window.KananeoReleaseHistoryUi={releaseHistorySummary,releaseHistoryEntries,historyType,readableDate};
