(() => {
const names={dashboard:"ダッシュボード",broadcast:"放送・枠管理",comments:"コメントビューア",requests:"動画リクエスト",stocks:"ストック",poll:"自動アンケート",player:"プレイヤー・BGM",automation:"自動枠取り・延長",external:"OBS・外部ツール",voice:"音声・自動応答",users:"ユーザー・NG管理",logs:"履歴・バックアップ",settings:"設定"};
const key="kananeo-beta2";
let commentConnection={state:"disconnected",message:"コメントサーバー未接続",programId:"",recordingEnabled:false};
let receivedComments=[];
const pendingCommentRequestIds=new Set();
const requestReplyQueue=[];
const repliedRequestComments=new Set();
let requestReplyBusy=false;
let lastRequestReplySentAt=0;
let lastRequestReplyErrorToastAt=0;
let playerState={state:"closed",currentTime:0,duration:0,message:"プレイヤー未起動"};
const MAX_DISPLAY_COMMENTS=1000;
const MAX_QUEUE_ITEMS=1000;
let nicoStatus={authenticated:false,label:"状態を確認中"};
let dashboardStats={loading:false,watchCount:null,commentCount:null,updatedAt:"",error:""};
let extensionOptionsState={loading:false,methods:[],updatedAt:"",error:""};
let quotePlayback={active:false,verified:false,programId:"",videoId:"",queueType:"",itemId:"",message:"ニコ生への引用再生は停止中です。"};
let quoteAutoTimer=null;
let quoteAutoToken=0;
let quoteAutoSchedule=null;
let quoteAutoBusy=false;
let quoteAutoMessage="引用再生の自動次動画はOFFです。";
let pollRuntime={active:false,status:"idle",message:"アンケートは停止中です。",result:[]};
let pollRunToken=0;
let pollCurrentProgramId="";
let pollEnqueteOpen=false;
let pollWaitTimer=null;
let pollWaitResolve=null;
let pollFinishPromise=null;
const initial={requests:[],stocks:[],playback:{playStyle:1,randomStock:false,mainVolume:1,subVolume:0,quoteAutoNext:false,nextIntervalSeconds:10},ngWords:[],ngUsers:[],playlist:[],poll:{question:"この動画を続けますか？",wait:15,result:10,continue:"もう一度",next:"次の動画へ",tie:true,zero:true},automation:{autoNext:false,autoExtend:false,keepPosition:true,adjustVideo:true,extend:30},player:{currentId:"",currentQueueType:"request",autoNext:true,status:"closed",currentTime:0,duration:0,endedFor:""},requestSettings:{acceptComments:false,maxPerUser:5,replyEnabled:false,replyAccepted:"リクエスト受付：{video_id}",replyRejected:"リクエスト不可：{reason}"},external:{obs:"",nair:"",xsplit:""},logs:["β2 UIプロトタイプを起動しました"]};
let state=load(),page="dashboard";
function load(){
try{
const stored=JSON.parse(localStorage.getItem(key)||"{}");
const loaded={...initial,...stored};
loaded.player={...initial.player,...(stored.player||{})};
loaded.playback={...initial.playback,...(stored.playback||{})};
loaded.poll={...initial.poll,...(stored.poll||{})};
loaded.requestSettings={...initial.requestSettings,...(stored.requestSettings||{})};
loaded.requests=(Array.isArray(stored.requests)?stored.requests:[]).map((item,index)=>({...item,id:typeof item?.id==="string"?item.id:"legacy-"+index,status:item?.status||"queued"}));
loaded.stocks=(Array.isArray(stored.stocks)?stored.stocks:[]).map((item,index)=>({...item,id:typeof item?.id==="string"?item.id:"stock-legacy-"+index,status:item?.status||"queued"}));
return loaded;
}catch{return structuredClone(initial)}
}
function save(){localStorage.setItem(key,JSON.stringify(state))}
function renderExtensionOptions(){
const node=document.getElementById("extension-options");
const updated=document.getElementById("extension-updated");
const button=document.querySelector("[data-extension-check]");
if(node)node.textContent=extensionOptionsState.loading?"延長方法を確認しています…":extensionOptionsState.error|| (extensionOptionsState.methods.length?extensionOptionsState.methods.map(x=>x.type+"："+x.minutes+"分").join(" / "):"利用可能な延長方法はありません。");
if(updated)updated.textContent=extensionOptionsState.updatedAt?"更新："+new Date(extensionOptionsState.updatedAt).toLocaleTimeString("ja-JP"):"未確認";
if(button)button.disabled=extensionOptionsState.loading;
}
async function refreshExtensionOptions(){
const programId=state.lastProgramId||commentConnection.programId;
if(!programId){extensionOptionsState.error="先に「放送・枠管理」で放送IDを確認してください。";renderExtensionOptions();toast(extensionOptionsState.error);return;}
if(extensionOptionsState.loading)return;
extensionOptionsState.loading=true;extensionOptionsState.error="";renderExtensionOptions();
try{
const result=await window.kananeoApp.niconico.getExtensionOptions({programId});
if(!result?.ok)throw new Error(result?.message||"延長方法を取得できませんでした。");
extensionOptionsState={loading:false,methods:result.methods||[],updatedAt:result.updatedAt||new Date().toISOString(),error:""};
}catch(error){extensionOptionsState.loading=false;extensionOptionsState.error=error?.message||"延長方法を取得できませんでした。";}
renderExtensionOptions();
if(extensionOptionsState.error)toast(extensionOptionsState.error);
}
function programStatusLabel(status){return ({onAir:"放送中",ON_AIR:"放送中",test:"テスト放送",reserved:"予約",ended:"終了",ENDED:"終了"}[status]||"状態未確認")}
function formatRemainingTime(){const end=Number(state.lastProgramEndAt);if(!Number.isFinite(end)||end<=0)return "—";const left=Math.ceil(end-Date.now()/1000);if(left<=0)return "終了予定を超過";const h=Math.floor(left/3600),m=Math.floor((left%3600)/60),sec=left%60;return h?String(h)+"時間"+String(m)+"分":m?String(m)+"分"+String(sec)+"秒":String(sec)+"秒"}
function updateDashboardStatsUi(){const viewers=document.getElementById("dashboard-viewers"),comments=document.getElementById("dashboard-comments"),requests=document.getElementById("dashboard-requests"),remaining=document.getElementById("dashboard-remaining"),updated=document.getElementById("dashboard-updated"),error=document.getElementById("dashboard-stats-error"),program=document.getElementById("dashboard-program-label"),refresh=document.querySelector("[data-dashboard-refresh]");if(viewers)viewers.textContent=dashboardStats.loading&&dashboardStats.watchCount==null?"取得中…":dashboardStats.watchCount==null?"—":Number(dashboardStats.watchCount).toLocaleString("ja-JP");if(comments)comments.textContent=dashboardStats.loading&&dashboardStats.commentCount==null?"取得中…":dashboardStats.commentCount==null?"—":Number(dashboardStats.commentCount).toLocaleString("ja-JP");if(requests)requests.textContent=String(state.requests.filter(x=>!["completed","skipped"].includes(x.status)).length);if(remaining)remaining.textContent=formatRemainingTime();if(updated)updated.textContent=dashboardStats.updatedAt?"更新："+new Date(dashboardStats.updatedAt).toLocaleTimeString("ja-JP"):dashboardStats.loading?"取得中…":"統計未取得";if(error)error.textContent=dashboardStats.error||"";if(program)program.textContent=state.lastProgramId?(state.lastProgramTitle||state.lastProgramId)+" / "+programStatusLabel(state.lastProgramStatus):"放送ID未設定";if(refresh)refresh.disabled=dashboardStats.loading}
async function refreshDashboardStatistics(silent=false){const programId=state.lastProgramId||commentConnection.programId;if(!programId){dashboardStats.error="放送IDを確認すると来場者数・コメント数を表示できます。";updateDashboardStatsUi();if(!silent)toast(dashboardStats.error);return;}if(dashboardStats.loading)return;dashboardStats.loading=true;dashboardStats.error="";updateDashboardStatsUi();try{const result=await window.kananeoApp.niconico.getProgramStatistics({programId});if(!result?.ok)throw new Error(result?.message||"番組統計を取得できませんでした。");dashboardStats={loading:false,watchCount:result.watchCount,commentCount:result.commentCount,updatedAt:result.updatedAt||new Date().toISOString(),error:""};}catch(error){dashboardStats.loading=false;dashboardStats.error=error?.message||"番組統計を取得できませんでした。";}updateDashboardStatsUi()}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(s){const t=document.getElementById("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function hero(k,t,d,b=""){return `<div class="hero"><div><div class="eyebrow">${k}</div><h1>${t}</h1><p class="desc">${d}</p></div>${b}</div>`}
function panel(t,d,body){return `<article class="panel"><h2>${t}</h2><p>${d}</p>${body}</article>`}
function field(label,id,value="",placeholder=""){return `<div class="field"><label>${label}</label><input class="input" id="${id}" value="${esc(value)}" placeholder="${placeholder}"></div>`}
function toggle(id,title,desc,on){return `<div class="switchrow"><div><b>${title}</b><small>${desc}</small></div><input type="checkbox" data-toggle="${id}" ${on?"checked":""}></div>`}
function render(){
document.getElementById("crumb").textContent=names[page];
document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
let html="";
if(page==="dashboard"){
html=hero("STREAM CONTROL CENTER","配信コントロールセンター","配信に必要な操作を、ひとつの画面からまとめて管理します。",'<button class="btn primary" data-go="broadcast">放送管理を開く</button>')+
'<div class="banner"><i class="led"></i><div><b>ニコニコ生放送に接続していません</b><small>公式ログインとNDGRコメント受信に対応しました。コメント送信・番組作成・延長操作は未実装です。</small></div><button data-go="broadcast">接続設定 →</button></div>'+
'<div class="section"><div><h2>現在の配信状況</h2><p id="dashboard-program-label">'+(state.lastProgramId?(state.lastProgramTitle||state.lastProgramId)+" / "+programStatusLabel(state.lastProgramStatus):"放送ID未設定")+'</p></div><button class="btn" data-dashboard-refresh '+(dashboardStats.loading?"disabled":"")+'>統計を更新</button></div>'+
'<div class="stats"><div class="card"><label>来場者数</label><strong id="dashboard-viewers">'+(dashboardStats.watchCount==null?"—":Number(dashboardStats.watchCount).toLocaleString("ja-JP"))+'</strong><small>累計来場者数</small></div><div class="card"><label>コメント数</label><strong id="dashboard-comments">'+(dashboardStats.commentCount==null?"—":Number(dashboardStats.commentCount).toLocaleString("ja-JP"))+'</strong><small>累計コメント数</small></div><div class="card"><label>リクエスト待ち</label><strong id="dashboard-requests">'+state.requests.filter(x=>!["completed","skipped"].includes(x.status)).length+'</strong><small>未再生キュー</small></div><div class="card"><label>放送残り時間</label><strong id="dashboard-remaining">'+formatRemainingTime()+'</strong><small id="dashboard-updated">'+(dashboardStats.updatedAt?"更新："+new Date(dashboardStats.updatedAt).toLocaleTimeString("ja-JP"):"統計未取得")+'</small></div></div>'+
'<div class="muted" id="dashboard-stats-error">'+esc(dashboardStats.error||"")+'</div>'+
'<div class="columns">'+panel("クイック操作","よく使う機能",'<div class="quick">'+[["♫","動画リクエスト","requests"],["◈","自動アンケート","poll"],["⟳","次枠・自動延長","automation"],["▣","OBS・外部ツール","external"]].map(x=>`<button data-go="${x[2]}"><span>${x[0]}</span><b>${x[1]}</b><small>機能を開く</small></button>`).join("")+'</div>')+
panel("システムログ","ローカルに記録した直近の操作",state.logs.slice(0,5).map(x=>`<div class="row"><i></i><div><b>${esc(x)}</b><small>ローカル記録</small></div></div>`).join(""))+'</div>'+
'<footer>kananeo nico live stream <span>0.1.0-beta.14 · Beta preview</span></footer>';
}else if(page==="requests"){
const waiting=state.requests.filter(x=>!["completed","skipped","rejected"].includes(x.status)).length;
const requestRows=state.requests.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(x.status==="playing"?"再生中":x.status==="completed"?"再生済み":x.status==="skipped"?"スキップ":x.status==="rejected"?"引用不可":"待機中")+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.videoId||x.url)+'</td><td><button class="btn" data-play="'+esc(x.id)+'">プレビュー</button> <button class="btn primary" data-quote-request="'+esc(x.id)+'">ニコ生へ送る</button> <button class="btn" data-up="'+i+'" '+(i===0?"disabled":"")+'>&uarr;</button> <button class="btn" data-down="'+i+'" '+(i===state.requests.length-1?"disabled":"")+'>&darr;</button> <button class="btn" data-remove="'+esc(x.id)+'">削除</button></td></tr>').join("");
html=hero("VIEWER REQUESTS","動画リクエスト","視聴者から受け付けた動画を管理します。プレビューとニコ生への引用再生は別操作です。")+
panel("動画リクエストを追加","動画ID・watch URLと、分かる場合は動画時間も登録します。",'<form id="request-form" class="grid3">'+field("動画タイトル（任意）","req-title","","未入力なら動画IDを表示")+field("動画URL / ID","req-url","","sm12345678 または動画URL")+field("動画時間（秒・任意）","req-duration","","例：240")+'<button class="btn primary">キューに追加</button></form><label class="switchrow"><span><b>コメントからリクエスト自動受付</b><small>明示コマンドのみ受付。NGユーザー・NGワード・重複・上限を順に確認します。</small></span><input type="checkbox" id="request-from-comments" '+(state.requestSettings.acceptComments?"checked":"")+'></label><div class="field"><label>1ユーザーあたりの未再生リクエスト上限（1〜50）</label><input class="input" id="request-max-per-user" type="number" min="1" max="50" value="'+(state.requestSettings.maxPerUser||5)+'"></div><label class="switchrow"><span><b>受付結果を運営コメントで自動返信</b><small>初期設定OFF。配信主権限が必要で、送信間隔は最低5秒に制限します。</small></span><input type="checkbox" id="request-reply-enabled" '+(state.requestSettings.replyEnabled?"checked":"")+'></label><div class="field"><label>受付時の返信（80文字以内）</label><textarea class="input" id="request-reply-accepted" rows="2" maxlength="80">'+esc(state.requestSettings.replyAccepted||initial.requestSettings.replyAccepted)+'</textarea></div><div class="field"><label>却下時の返信（80文字以内）</label><textarea class="input" id="request-reply-rejected" rows="2" maxlength="80">'+esc(state.requestSettings.replyRejected||initial.requestSettings.replyRejected)+'</textarea></div><div class="muted">使用できる置換：{video_id}、{comment_no}、{reason}。受付返信はキュー登録後、却下返信はNG・重複・上限などの判定後に送信します。一般コメントとしてではなく、ニコ生の運営コメントとして投稿されます。</div><div class="muted">「プレビュー」は動画ページを開くだけです。「ニコ生へ送る」は放送中の番組に引用再生を要求します。</div>')+
panel("リクエストキュー",waiting+" 件が未再生",state.requests.length?'<table class="table"><thead><tr><th>#</th><th>状態</th><th>タイトル</th><th>動画ID</th><th>操作</th></tr></thead><tbody>'+requestRows+'</tbody></table><div class="actions"><button class="btn" data-player-next>次の動画をプレビュー</button><button class="btn primary" data-quote-next>次の動画をニコ生へ引用再生</button><button class="btn" data-clear>リクエストを全消去</button><button class="btn" data-go="stocks">ストックを管理</button></div>':'<div class="empty">リクエストキューは空です。</div>');
}else if(page==="stocks"){
const waiting=state.stocks.filter(x=>!["completed","skipped","rejected"].includes(x.status)).length;
const stockRows=state.stocks.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(x.status==="playing"?"再生中":x.status==="completed"?"再生済み":x.status==="skipped"?"スキップ":x.status==="rejected"?"引用不可":"待機中")+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.videoId||x.url)+'</td><td><button class="btn" data-preview-stock="'+esc(x.id)+'">プレビュー</button> <button class="btn primary" data-quote-stock="'+esc(x.id)+'">ニコ生へ送る</button> <button class="btn" data-stock-up="'+i+'" '+(i===0?"disabled":"")+'>&uarr;</button> <button class="btn" data-stock-down="'+i+'" '+(i===state.stocks.length-1?"disabled":"")+'>&darr;</button> <button class="btn" data-stock-remove="'+esc(x.id)+'">削除</button></td></tr>').join("");
html=hero("STOCK LIBRARY","ストック","運営が事前に用意した動画をリクエストとは別に管理します。リクエストが空になった場合の次候補として使います。")+
panel("ストックを追加","動画ID・watch URLと動画時間を登録します。マイリスト一括取込は次段階で対応します。",'<form id="stock-form" class="grid3">'+field("動画タイトル（任意）","stock-title","","未入力なら動画IDを表示")+field("動画URL / ID","stock-url","","sm12345678 または動画URL")+field("動画時間（秒・任意）","stock-duration","","例：240")+'<button class="btn primary">ストックに追加</button></form>')+
panel("ストックキュー",waiting+" 件が未再生",state.stocks.length?'<table class="table"><thead><tr><th>#</th><th>状態</th><th>タイトル</th><th>動画ID</th><th>操作</th></tr></thead><tbody>'+stockRows+'</tbody></table><div class="actions"><button class="btn primary" data-quote-next>次の候補をニコ生へ引用再生</button><button class="btn" data-stock-clear>ストックを全消去</button></div>':'<div class="empty">ストックは空です。</div>');
}else if(page==="poll"){
const pollActive=pollRuntime.active;
const pollResults=(pollRuntime.result||[]).map(item=>esc(item.name)+"："+Number(item.rate).toFixed(1)+"%").join(" / ");
html=hero("AUTOMATIC POLL","自動アンケート","投票を作成し、設定時間後に結果を取得。継続票が最多なら再投票、次動画票が最多ならリクエスト優先でニコ生へ引用再生します。")+
'<div class="grid2">'+panel("アンケート内容","選択肢は2つです。表示名は投票結果と完全一致させます。",field("質問","poll-question",state.poll.question)+field("継続の選択肢","poll-continue",state.poll.continue)+field("次動画の選択肢","poll-next",state.poll.next))+
panel("投票時間・判定ルール","投票時間は3〜300秒、結果表示は0〜120秒",field("投票待ち時間（秒）","poll-wait",state.poll.wait)+field("結果表示時間（秒）","poll-result",state.poll.result)+toggle("poll-tie","同票なら再投票","同率の場合は現在の動画を維持",state.poll.tie)+toggle("poll-zero","無投票なら再投票","0票の場合は現在の動画を維持",state.poll.zero)+'<button class="btn" data-save-poll>設定を保存</button>')+'</div>'+
panel("自動アンケート実行","放送主権限のあるログインで、配信中の放送IDを指定してください。",'<div class="banner"><i class="led"></i><div><b id="poll-status-label">'+esc(pollRuntime.status==="idle"?"停止中":pollRuntime.status==="voting"?"投票中":pollRuntime.status==="results"?"結果表示中":pollRuntime.status==="repeating"?"再投票準備中":pollRuntime.status==="next"?"次動画へ進みました":pollRuntime.status==="error"?"エラー":"処理中")+'</b><small id="poll-status-message">'+esc(pollRuntime.message)+'</small></div></div><div id="poll-results" class="empty">'+(pollResults||"投票結果はまだありません。")+'</div><div class="actions"><button class="btn primary" data-poll-start '+(pollActive?"disabled":"")+'>自動アンケート開始</button><button class="btn" data-poll-stop '+(!pollActive?"disabled":"")+'>停止</button></div><div class="muted">最大100回まで連続再投票します。配信主権限がない場合はニコ生API側で拒否されます。</div>');
}else if(page==="automation"){
html=hero("AUTOMATION","自動枠取り・延長","次枠取得・無料延長と、動画の再生時間に合わせた配信運用を管理します。")+
'<div class="grid2">'+panel("次枠管理","番組情報と再生状態を引き継ぐ",toggle("auto-next","放送終了時に次枠を自動取得","次枠を準備して再開",state.automation.autoNext)+toggle("keep-position","再生位置を引き継ぐ","次枠でも現在位置を維持",state.automation.keepPosition))+
panel("自動延長","動画の残り時間と枠の残り時間を同期",toggle("auto-extend","自動延長を有効にする","延長APIの仕様・条件を実機確認後に有効化します",state.automation.autoExtend)+toggle("adjust-video","動画の長さに合わせて延長時間を調整","動画終了後の黒画面・ロスタイムを抑える",state.automation.adjustVideo)+field("基本追加時間（秒）","extend",state.automation.extend)+'<button class="btn primary" data-save-auto>設定を保存</button>')+'</div>'+panel("延長可能な方法を確認","現在の放送で利用できる延長方法・分数を読み取ります。ここでは延長操作を実行しません。",'<div class="actions"><button class="btn primary" data-extension-check '+(extensionOptionsState.loading?"disabled":"")+ '>延長方法を確認</button><span class="muted" id="extension-updated">'+(extensionOptionsState.updatedAt?"更新："+new Date(extensionOptionsState.updatedAt).toLocaleTimeString("ja-JP"):"未確認")+'</span></div><div id="extension-options" class="empty">'+esc(extensionOptionsState.error||(extensionOptionsState.methods.length?extensionOptionsState.methods.map(x=>x.type+"："+x.minutes+"分").join(" / "):"放送IDを確認してから延長方法を取得してください。"))+'</div>');
}else if(page==="external"){
html=hero("EXTERNAL TOOLS","OBS・外部配信ツール","OBS Studio / N Air / XSplitの起動パスを登録します。外部操作は未実装です。")+
'<div class="grid3">'+panel("OBS Studio","実行ファイルのパス",field("OBS実行ファイル","obs",state.external.obs,"obs64.exe"))+panel("N Air","実行ファイルのパス",field("N Air実行ファイル","nair",state.external.nair,"N Air.exe"))+panel("XSplit","実行ファイルのパス",field("XSplit実行ファイル","xsplit",state.external.xsplit,"XSplit.exe"))+'</div><button class="btn primary" data-save-paths>パスを保存</button>';
}else if(page==="users"){
html=hero("MODERATION","ユーザー・NG管理","NGワード・NGユーザーをローカル保存します。")+
'<div class="grid2">'+panel("NGワード","非表示対象の文字列",'<form id="ng-word-form" class="actions"><input id="ng-word" class="input" placeholder="NGワード" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngWords.map((x,i)=>`<span class="tag">${esc(x)} <button data-ngw="${i}">×</button></span>`).join("")+'</div>')+
panel("NGユーザー","ユーザーID単位で制限",'<form id="ng-user-form" class="actions"><input id="ng-user" class="input" placeholder="ユーザーID" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngUsers.map((x,i)=>`<span class="tag">${esc(x)} <button data-ngu="${i}">×</button></span>`).join("")+'</div>')+'</div>';
}else if(page==="player"){
const current=currentQueueItem();
const playerLabel=({closed:"未起動",loading:"読み込み中",playing:"再生中",paused:"一時停止",ended:"再生終了",error:"読み込みエラー"}[playerState.state]||"状態確認中");
const quoteLabel=quotePlayback.active?(quotePlayback.verified?"引用再生中（状態確認済み）":"引用再生API受付済み（状態未確認）"):"停止中";
const playlistRows=state.playlist.map((x,i)=>'<div class="row"><b>'+esc(x)+'</b><button class="btn" data-track="'+i+'">削除</button></div>').join("");
html=hero("PLAYER & BGM","プレイヤー・BGM","プレビュー再生と、配信中の番組へ動画を送る引用再生を分けて管理します。")+
panel("プレビュー用Webプレイヤー",current?esc(current.title):"プレビュー対象の動画はありません",'<div class="row"><b>プレイヤー状態</b><span id="player-state-label">'+playerLabel+'</span></div><div class="row"><b>再生位置</b><span id="player-time-label">'+formatVideoTime(playerState.currentTime)+' / '+formatVideoTime(playerState.duration)+'</span></div><progress id="player-progress" max="100" value="'+(playerState.duration?Math.min(100,playerState.currentTime/playerState.duration*100):0)+'"></progress><div class="muted" id="player-message">'+esc(playerState.message||"")+'</div><label class="switchrow"><span><b>プレビュー終了後に自動で次へ</b><small>公式Webプレイヤーの終了を検知した場合だけ次のプレビューを開きます。</small></span><input type="checkbox" id="player-auto-next" '+(state.player.autoNext?"checked":"")+'></label><div class="actions"><button class="btn" data-player-focus>プレビューを前面に表示</button><button class="btn" data-player-next>次のプレビュー</button><button class="btn" data-player-close>プレビューを閉じる</button></div>')+
panel("ニコ生への引用再生",quotePlayback.videoId?"現在の動画ID："+esc(quotePlayback.videoId):"引用再生中の動画はありません。",'<div class="banner"><i class="led"></i><div><b>'+quoteLabel+'</b><small>'+esc(quotePlayback.message)+'</small></div></div><div class="row"><b>対象放送</b><span>'+esc(quotePlayback.programId||state.lastProgramId||"放送ID未確認")+'</span></div><div class="actions"><button class="btn" data-quote-refresh>引用再生状態を確認</button><button class="btn primary" data-quote-next>次の候補をニコ生へ送る</button><button class="btn danger" data-quote-stop '+(!quotePlayback.active?"disabled":"")+'>引用再生を停止</button></div><div class="muted">「ニコ生へ送る」を押すと放送中の視聴者へ実際に動画が流れます。実行前に確認ダイアログを表示します。引用再生は放送主権限が必要です。</div>')+
panel("再生スケジューラー","リクエストを優先し、リクエストが無い場合はストックから選びます。",'<div class="grid2">'+
'<div class="field"><label>再生モード</label><select class="input" id="play-style"><option value="0" '+(state.playback.playStyle===0?"selected":"")+ '>手動（自分で次へ）</option><option value="1" '+(state.playback.playStyle===1?"selected":"")+ '>自動順次</option><option value="2" '+(state.playback.playStyle===2?"selected":"")+ '>自動ランダム</option></select><small class="muted">手動モードでは自動次動画を無効にし、ボタン操作だけで次へ進みます。</small></div>'+
'<label class="switchrow"><span><b>ストックをランダム再生</b><small>リクエストを優先した後、ストックをランダムに選びます。</small></span><input type="checkbox" id="random-stock" '+(state.playback.randomStock?"checked":"")+'></label>'+
toggle("quote-auto-next","引用再生の終了後に自動で次動画へ","登録した動画時間＋待ち時間で次の動画へ差し替えます。初期状態はOFFです。",state.playback.quoteAutoNext)+
field("次動画へ移る待ち時間（秒）","quote-gap",state.playback.nextIntervalSeconds)+
field("メイン動画音量（0〜1）","quote-main-volume",state.playback.mainVolume)+field("マイク音量（0〜1）","quote-sub-volume",state.playback.subVolume)+'</div><div class="muted" id="quote-schedule-state">'+esc(quoteAutoMessage)+'</div><button class="btn" data-save-playback>再生設定を保存</button><div class="muted">動画時間が未登録の場合や、アプリ外で開始され開始時刻が不明な引用再生は、自動切替を行いません。放送残り時間が分かる場合は、枠内に収まる候補を選びます。</div>')+
panel("BGMプレイリスト","曲名の登録・削除（音源再生は未実装）",'<form id="track-form" class="actions"><input id="track" class="input" placeholder="曲名・音源ファイル名" required><button class="btn primary">追加</button></form>'+ (playlistRows||'<div class="empty">プレイリストは空です。</div>'))+
'<div class="banner"><i class="led"></i><div><b>2種類の再生方法</b><small>プレビューは別ウィンドウで動画ページを開きます。引用再生はニコ生の番組へ動画を送る方式で、参考アプリの再生方法に近い構成です。</small></div></div>';
}else if(page==="comments"){
const active=["connecting","connected","recovering"].includes(commentConnection.state);
const statusLabel=({disconnected:"未接続",connecting:"接続中",connected:"接続済み",recovering:"再接続中",error:"接続エラー"}[commentConnection.state]||"未接続");
html=hero("COMMENT VIEWER","コメントビューア","ニコ生のNDGRコメントストリームからコメント・放送者コメント・ギフト・通知を受信します。")+
'<div class="banner"><i class="led"></i><div><b id="comment-state-label">'+statusLabel+'</b><small id="comment-state-message">'+esc(commentConnection.message)+'</small></div><span class="version" id="comment-program-label">'+esc(commentConnection.programId||"放送未選択")+'</span><span class="version" id="comment-recording-label">'+(commentConnection.recordingEnabled?"自動保存：ON":"自動保存：OFF")+'</span></div>'+
panel("コメント接続","放送IDまたは番組URLを指定して受信を開始",'<div class="field"><label>放送ID / URL</label><input class="input" id="comments-program-id" value="'+esc(state.lastProgramId||commentConnection.programId||"")+'" placeholder="lv123456789 または番組URL" maxlength="512"></div><label class="switchrow"><span><b>過去コメントも取得する</b><small>接続直後に取得できるバックログを読み込みます。</small></span><input type="checkbox" id="comments-backlog" checked></label><label class="switchrow"><span><b>コメントを自動保存する</b><small>受信した全コメントをJSONL形式でPC内に保存します。</small></span><input type="checkbox" id="comments-save" checked></label><div class="actions"><button class="btn primary" data-comment-start '+(active?"disabled":"")+'>▶ コメント受信を開始</button><button class="btn danger" data-comment-stop '+(commentConnection.state==="disconnected"?"disabled":"")+'>■ 切断</button><button class="btn" data-comment-open-folder>保存先フォルダ</button></div><div class="muted">Cookie・生Protobufは保存せず、画面とログにも出しません。CSV出力は表示中の最大1,000件です。</div>')+
panel("受信コメント",'<span id="comment-count">'+receivedComments.length+'</span> 件を表示中','<div class="grid2"><div class="field"><label>検索（本文・ユーザー名・ID）</label><input class="input" id="comments-search" placeholder="コメントを検索"></div><div class="field"><label>表示種別</label><select id="comments-filter" class="input"><option value="all">すべて</option><option value="comment">一般コメント</option><option value="operatorComment">放送者コメント</option><option value="gift">ギフト</option><option value="emotion">エモーション</option><option value="notification">通知</option></select></div></div><div class="actions"><button class="btn" data-comment-copy>表示中をコピー</button><button class="btn" data-comment-csv>CSV保存</button><button class="btn" data-comment-clear>表示をクリア</button></div><div id="comments-list" class="comment-list"><div class="empty">まだコメントはありません。ログイン後、接続を開始してください。</div></div>');
}else if(page==="broadcast"){
const authTitle=nicoStatus.authenticated?"ログインCookieを確認しました":"ニコニコにログインしていません";
const authText=nicoStatus.authenticated?"このアプリ専用のセッションにログインCookieがあります。Cookie値は表示しません。":"下のボタンからニコニコ公式ログインを開いてください。パスワードはアプリに入力しません。";
html=hero("LIVE SESSION","放送・枠管理","ニコニコ公式ログイン、放送IDによる番組ページ確認、コメントビューアへの接続を管理します。")+
'<div class="grid2">'+
panel("ニコニコアカウント接続","公式ログインを専用セッションで開く",'<div class="empty" id="auth-status"><b>'+authTitle+'</b><br>'+authText+'</div><div class="actions"><button class="btn primary" data-nico-login>公式ログインを開く</button><button class="btn" data-nico-refresh>状態を再確認</button><button class="btn" data-nico-logout>このアプリからログアウト</button></div>')+
panel("番組ページを確認","放送IDまたはニコ生番組URLを入力",'<div class="field"><label>放送ID / URL</label><input class="input" id="live-id" value="${esc(state.lastProgramId||"")}" placeholder="lv123456789 または放送URL" maxlength="512"></div><div class="actions"><button class="btn primary" data-nico-check>番組ページを確認</button></div><div class="empty" id="program-result">確認結果はここに表示します。</div>')+
'</div>'+
panel("この段階で確認すること","番組ページ確認とコメント受信を区別します。",'<div class="row"><i></i><div><b>実装済み</b><small>公式ログイン画面、専用セッション、Cookieの存在確認、放送ID検証、番組ページの取得</small></div></div><div class="row"><i></i><div><b>次段階</b><small>NDGRコメントサーバー接続、コメント受信、配信主権限確認</small></div></div>')+
'<div class="banner"><i class="led"></i><div><b>注意</b><small>番組ページを確認しても、コメント接続や配信操作が成功したことにはなりません。</small></div></div>';
}else if(page==="voice"){
html=hero("VOICE & AUTO RESPONSE","音声・自動応答","コメント読み上げ、音声認識コマンド、定時通知、自動応答を追加予定です。")+
panel("音声・通知", "オプション機能",toggle("read","コメント読み上げ","棒読みちゃん等と連携予定",false)+toggle("reply","自動応答","許可ユーザー・頻度制限付きで実装予定",false));
}else if(page==="logs"){
html=hero("ACTIVITY & BACKUP","履歴・バックアップ","設定データのJSON書き出し・読み込み。")+
panel("システムログ","操作履歴",state.logs.map(x=>`<div class="row"><i></i><b>${esc(x)}</b></div>`).join("")+'<div class="actions"><button class="btn primary" data-export>設定JSONを書き出す</button><button class="btn" data-clear-logs>ログを消去</button></div>');
}else{
html=hero("APPLICATION SETTINGS","設定","アプリのバージョンとローカル設定を管理します。")+
panel("バージョン情報","kananeo nico live stream",'<div class="row"><b>Version</b><span>0.1.0-beta.14</span></div><div class="row"><b>Runtime</b><span>Electron 45.2.3</span></div><div class="row"><b>Status</b><span>Beta 13 / manual, sequential and random playback</span></div>');
}
document.getElementById("content").innerHTML=html;
}
function formatVideoTime(value){
const seconds=Math.max(0,Math.floor(Number(value)||0));
const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;
return h?String(h)+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"):String(m)+":"+String(sec).padStart(2,"0");
}
function currentQueueList(){return state.player.currentQueueType==="stock"?state.stocks:state.requests;}
function currentQueueItem(){return currentQueueList().find(x=>x.id===state.player.currentId)||state.requests.find(x=>x.id===state.player.currentId)||state.stocks.find(x=>x.id===state.player.currentId)||null;}
function clearQuoteAutoTimer(message){
if(quoteAutoTimer)clearTimeout(quoteAutoTimer);
quoteAutoTimer=null;
quoteAutoToken++;
quoteAutoSchedule=null;
if(message)quoteAutoMessage=message;
updateQuoteScheduleUi();
}
function updateQuoteScheduleUi(){
const node=document.getElementById("quote-schedule-state");
if(!node)return;
let message=quoteAutoMessage;
if(quoteAutoSchedule){
const remaining=window.KananeoQuoteScheduler.getRemainingMs(quoteAutoSchedule);
message=remaining>0?"自動次動画まで残り "+formatVideoTime(Math.ceil(remaining/1000)):"次動画へ切替中…";
}
node.textContent=message;
}
function storedQuoteDurationMs(item){
const itemValue=Number(item?.lengthMs??item?.durationMs??0);
if(Number.isFinite(itemValue)&&itemValue>0)return itemValue;
const storedValue=Number(state.player.quoteDurationMs||0);
return Number.isFinite(storedValue)&&storedValue>0?storedValue:0;
}
function scheduleQuoteAutoNext(item,startedAt=Date.now(),options={}){
if(options.clearExisting!==false)clearQuoteAutoTimer();
const durationMs=storedQuoteDurationMs(item);
const start=Number(startedAt)||Date.now();
state.player.quoteStartedAt=start;
state.player.quoteDurationMs=durationMs;
state.player.quoteVideoId=String(item?.videoId||item?.video_id||quotePlayback.videoId||"");
state.player.quoteProgramId=String(quotePlayback.programId||state.lastProgramId||"");
state.player.quoteExpectedEndAt=0;
if(!state.playback.quoteAutoNext){
quoteAutoMessage="引用再生の自動次動画はOFFです。";
save();updateQuoteScheduleUi();return false;
}
if(state.playback.playStyle===0){
state.playback.quoteAutoNext=false;
quoteAutoMessage="手動モードでは自動次動画を行いません。次の動画ボタンから進めてください。";
save();updateQuoteScheduleUi();return false;
}
const schedule=window.KananeoQuoteScheduler.createQuoteSchedule({
startedAt:start,durationMs,gapSeconds:Number(state.playback.nextIntervalSeconds)
});
if(!schedule.ok){
quoteAutoMessage=schedule.message;
save();updateQuoteScheduleUi();return false;
}
state.player.quoteExpectedEndAt=schedule.dueAt;
quoteAutoSchedule=schedule;
quoteAutoMessage="動画時間を基準に次動画を予約しました。";
const token=++quoteAutoToken;
save();
const delay=Math.max(0,window.KananeoQuoteScheduler.getRemainingMs(schedule));
quoteAutoTimer=setTimeout(()=>{void handleQuoteAutoNext(token);},delay);
updateQuoteScheduleUi();
return true;
}
async function handleQuoteAutoNext(token){
if(token!==quoteAutoToken)return;
if(quoteAutoBusy){
quoteAutoTimer=setTimeout(()=>{void handleQuoteAutoNext(token);},1000);
return;
}
quoteAutoTimer=null;
if(!state.playback.quoteAutoNext||state.playback.playStyle===0||!quoteAutoSchedule)return;
quoteAutoBusy=true;
quoteAutoMessage="引用再生の状態を確認しています。";
updateQuoteScheduleUi();
try{
const programId=quotePlayback.programId||state.lastProgramId;
const expectedVideoId=quotePlayback.videoId||state.player.quoteVideoId;
if(!programId||!expectedVideoId)throw new Error("対象放送または動画IDを確認できません。");
const current=await window.kananeoApp.niconico.getCurrentQuotation({programId});
if(token!==quoteAutoToken||!state.playback.quoteAutoNext)return;
if(!current?.ok)throw new Error(current?.message||"引用再生状態を確認できませんでした。");
if(!current.exists){
const finishedId=quotePlayback.itemId||state.player.currentId;
const finished=[...state.requests,...state.stocks].find(item=>item.id===finishedId);
if(finished&&finished.status==="playing")finished.status="completed";
quotePlayback={active:false,verified:true,programId,videoId:"",queueType:"",itemId:"",message:"予定時刻に引用再生が停止していたため、自動次動画を中止しました。"};
state.player.quoteStartedAt=0;state.player.quoteDurationMs=0;state.player.quoteVideoId="";state.player.quoteProgramId="";state.player.quoteExpectedEndAt=0;
save();
quoteAutoSchedule=null;
quoteAutoMessage="ニコ生の引用再生が停止しているため、自動次動画を中止しました。";
updateQuoteScheduleUi();
return;
}
if(current.currentVideoId!==expectedVideoId){
await refreshQuotePlayback({silent:true});
quoteAutoMessage="ニコ生側で別の動画に変更されたため、自動次動画を中止しました。";
updateQuoteScheduleUi();
return;
}
const finishedId=quotePlayback.itemId||state.player.currentId;
const finished=[...state.requests,...state.stocks].find(item=>item.id===finishedId);
if(finished&&finished.status==="playing"){
finished.status="completed";
state.logs.unshift("引用再生の予定時間に到達："+finished.title);
}
state.player.endedFor=finishedId||"";
save();
quoteAutoSchedule=null;
quoteAutoMessage="動画時間に到達しました。次の候補を選んでいます。";
updateQuoteScheduleUi();
if(token!==quoteAutoToken||!state.playback.quoteAutoNext)return;
const advanced=await playNextQuoteItem({skipConfirmation:true,triggeredByAuto:true});
if(token!==quoteAutoToken)return;
if(!advanced){
quoteAutoMessage="次に再生できる動画がありません。必要に応じてキューへ追加してください。";
updateQuoteScheduleUi();
}
}catch(error){
if(token!==quoteAutoToken)return;
quoteAutoMessage=error?.message||"自動次動画の処理に失敗しました。";
updateQuoteScheduleUi();
toast(quoteAutoMessage);
}finally{
quoteAutoBusy=false;
}
}
async function getNextQueueItem(){const selected=await window.kananeoApp.niconico.findNextQueueItem(state.requests.map(x=>({id:x.id,status:x.status})),state.player.currentId);return selected?state.requests.find(x=>x.id===selected.id)||null:null;}
async function refreshQuotePlayback(options={}){
const silent=options.silent===true;
const programId=state.lastProgramId||quotePlayback.programId;
if(!programId){if(!silent)toast("先に「放送・枠管理」で番組IDを確認してください。");return {ok:false};}
const result=await window.kananeoApp.niconico.getCurrentQuotation({programId});
if(!result?.ok){
quotePlayback={...quotePlayback,message:result?.message||"引用再生状態を取得できませんでした。"};
if(!silent)toast(quotePlayback.message);
if(page==="player")render();
return result;
}
const previousItemId=quotePlayback.itemId;
const matched=result.exists?[...state.requests,...state.stocks].find(item=>item.videoId===result.currentVideoId):null;
if(previousItemId!==matched?.id){
clearQuoteAutoTimer(result.exists?"引用再生の対象が変わりました。":"引用再生は停止しています。");
if(previousItemId){
for(const list of [state.requests,state.stocks])list.forEach(item=>{if(item.id===previousItemId&&item.status==="playing")item.status="queued";});
}
}
if(matched){
for(const list of [state.requests,state.stocks])list.forEach(item=>{if(item.status==="playing"&&item.id!==matched.id)item.status="queued";});
matched.status="playing";
}
quotePlayback={active:!!result.exists,verified:true,programId,videoId:result.currentVideoId||"",queueType:matched?(state.stocks.includes(matched)?"stock":"request"):"",itemId:matched?.id||"",message:result.exists?"ニコ生の引用再生状態を確認しました。":"現在、引用再生は行われていません。"};
if(matched){state.player.currentId=matched.id;state.player.currentQueueType=quotePlayback.queueType;}
else if(!result.exists){
if(state.player.currentId===previousItemId)state.player.currentId="";
clearQuoteAutoTimer("ニコ生の引用再生は停止しています。");
state.player.quoteStartedAt=0;
state.player.quoteDurationMs=0;
state.player.quoteVideoId="";
state.player.quoteExpectedEndAt=0;
}else if(result.exists){
const storedMatches=state.player.quoteVideoId===result.currentVideoId&&state.player.quoteProgramId===programId&&Number(state.player.quoteStartedAt)>0&&Number(state.player.quoteDurationMs)>0;
if(storedMatches){
const scheduleItem={videoId:result.currentVideoId,lengthMs:Number(state.player.quoteDurationMs)};
scheduleQuoteAutoNext(scheduleItem,Number(state.player.quoteStartedAt));
}else if(state.playback.quoteAutoNext){
clearQuoteAutoTimer("現在の引用再生は開始時刻が分からないため、自動次動画は予約できません。");
}else{
clearQuoteAutoTimer("引用再生の自動次動画はOFFです。");
}
}
save();
if(page==="player")render();
updateQuoteScheduleUi();
return result;
}
async function playQuotedQueueItem(item,queueType="request",skipConfirmation=false){
if(!item)return false;
const programId=state.lastProgramId||commentConnection.programId;
if(!programId){toast("先に「放送・枠管理」で配信中の放送IDを確認してください。");return false;}
const ok=skipConfirmation||confirm("ニコ生の放送へ「"+item.title+"」を引用再生します。\\n\\n視聴者に動画が流れます。放送主権限が必要です。実行しますか？");
if(!ok)return false;
try{
const validation=await window.kananeoApp.niconico.validateVideo(item.videoId||item.url);
if(!validation?.ok){toast(validation?.message||"引用再生できる動画IDではありません。");return false;}
const result=await window.kananeoApp.niconico.playQuotedVideo({
programId,videoId:validation.videoId,confirmed:true,
mainVolume:state.playback.mainVolume,subVolume:state.playback.subVolume
});
if(!result?.ok){toast(result?.message||"引用再生に失敗しました。");return false;}
const previousId=quotePlayback.itemId;
if(previousId&&previousId!==item.id){
const previous=[...state.requests,...state.stocks].find(x=>x.id===previousId);
if(previous&&previous.status==="playing")previous.status="completed";
}
if(quotePlayback.active){for(const list of [state.requests,state.stocks])list.forEach(x=>{if(x.status==="playing"&&x.id!==item.id)x.status="completed";});}
item.status="playing";
state.player.currentId=item.id;
state.player.currentQueueType=queueType;
state.player.status="playing";
state.player.currentTime=0;
state.player.duration=Math.max(0,Number(item.lengthMs)||0)/1000;
state.player.endedFor="";
const startedAt=Date.now();
state.player.quoteStartedAt=startedAt;
state.player.quoteDurationMs=storedQuoteDurationMs(item);
state.player.quoteVideoId=validation.videoId;
state.player.quoteExpectedEndAt=state.player.quoteDurationMs>0?startedAt+state.player.quoteDurationMs+Number(state.playback.nextIntervalSeconds||0)*1000:0;
quotePlayback={active:true,verified:!!result.verified,programId,videoId:result.videoId,queueType,itemId:item.id,message:result.message};
state.logs.unshift("ニコ生へ引用再生："+item.title);
scheduleQuoteAutoNext(item,startedAt);
save();
if(page==="requests"||page==="stocks"||page==="player")render();
toast(result.message||"引用再生の要求を送信しました。");
return true;
}catch{toast("引用再生APIに接続できませんでした。");return false;}
}
async function stopQuotedPlayback(){
const programId=quotePlayback.programId||state.lastProgramId;
if(!programId){toast("放送IDを確認してください。");return;}
if(!confirm("現在ニコ生へ送っている引用再生を停止しますか？"))return;
const current=await window.kananeoApp.niconico.getCurrentQuotation({programId});
if(!current?.ok){toast(current?.message||"引用再生状態を確認できませんでした。");return;}
if(!current.exists){
clearQuoteAutoTimer("引用再生は既に停止しています。");
const stoppedItemId=quotePlayback.itemId;
quotePlayback={active:false,verified:true,programId,videoId:"",queueType:"",itemId:"",message:"ニコ生側では引用再生が既に停止しています。"};
state.player.quoteStartedAt=0;state.player.quoteDurationMs=0;state.player.quoteVideoId="";state.player.quoteProgramId="";state.player.quoteExpectedEndAt=0;
for(const list of [state.requests,state.stocks])list.forEach(x=>{if(x.id===stoppedItemId&&x.status==="playing")x.status="queued";});
if(state.player.currentId===stoppedItemId){state.player.currentId="";}save();if(page==="player")render();toast(quotePlayback.message);return;
}
const result=await window.kananeoApp.niconico.stopQuotedVideo({programId,confirmed:true});
if(!result?.ok){toast(result?.message||"引用再生を停止できませんでした。");return;}
clearQuoteAutoTimer("引用再生を停止しました。");
const stoppedItemId=quotePlayback.itemId;
quotePlayback={active:false,verified:true,programId,videoId:"",queueType:"",itemId:"",message:result.message};
state.player.quoteStartedAt=0;state.player.quoteDurationMs=0;state.player.quoteVideoId="";state.player.quoteExpectedEndAt=0;
for(const list of [state.requests,state.stocks])list.forEach(x=>{if(x.id===stoppedItemId&&x.status==="playing")x.status="queued";});
if(state.player.currentId===stoppedItemId){state.player.currentId="";}save();if(page==="player"||page==="requests"||page==="stocks")render();toast(result.message);
}
async function playNextQuoteItem(options={}){
const endAt=Number(state.lastProgramEndAt);
const remainingMs=endAt>0?endAt*1000-Date.now():null;
const selected=await window.kananeoApp.niconico.selectPlaybackCandidate({
requests:state.requests.map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
stocks:state.stocks.map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
playStyle:state.playback.playStyle,
randomStock:state.playback.randomStock,
remainingMs
});
if(!selected){if(!options.triggeredByAuto)toast("再生可能なリクエスト・ストックがありません。放送残り時間や引用可否も確認してください。");return false;}
const list=selected.queue==="stock"?state.stocks:state.requests;
const item=list[selected.index];
return await playQuotedQueueItem(item,selected.queue,options.skipConfirmation===true);
}
async function playQueueItem(item,queueType="request"){
if(!item)return;
try{
const result=await window.kananeoApp.niconico.openVideo(item.url);
if(!result?.ok){toast(result?.message||"動画を開けませんでした。");return;}
if(!quotePlayback.active){for(const list of [state.requests,state.stocks])list.forEach(x=>{if(x.id!==item.id&&x.status==="playing")x.status="queued";});item.status="playing";}
state.player.currentId=item.id;state.player.currentQueueType=queueType;state.player.status="loading";state.player.currentTime=0;state.player.duration=0;state.player.endedFor="";
state.logs.unshift("動画を再生："+item.title);save();playerState={state:"loading",currentTime:0,duration:0,message:result.message||"動画ページを開きました。"};
if(page==="requests"||page==="player")render();
toast(result.message||"動画ページを開きました。");
}catch{toast("プレイヤーを起動できませんでした。");}
}
async function playNextQueueItem(manual=false){
const current=currentQueueItem();
const previousStatus=current?.status;
if(manual&&current&&current.status==="playing")current.status="skipped";
const next=await getNextQueueItem();
if(!next){
if(manual&&current)current.status=previousStatus||"playing";
save();if(page==="requests"||page==="player")render();toast("次に再生できる動画はありません。");return;
}
save();await playQueueItem(next);
}
function updateVideoPlayerState(status){
if(!status||typeof status!=="object")return;
playerState={...playerState,...status};
if((status.state==="closed"||status.state==="error")&&currentQueueItem()?.status==="playing"){currentQueueItem().status="queued";save();}
state.player.status=playerState.state;
state.player.currentTime=Number(playerState.currentTime)||0;
state.player.duration=Number(playerState.duration)||0;
const label=document.getElementById("player-state-label");
const time=document.getElementById("player-time-label");
const progress=document.getElementById("player-progress");
const message=document.getElementById("player-message");
const names={closed:"未起動",loading:"読み込み中",playing:"再生中",paused:"一時停止",ended:"再生終了",error:"読み込みエラー"};
if(label)label.textContent=names[playerState.state]||"状態確認中";
if(time)time.textContent=formatVideoTime(playerState.currentTime)+" / "+formatVideoTime(playerState.duration);
if(progress)progress.value=playerState.duration?Math.min(100,playerState.currentTime/playerState.duration*100):0;
if(message)message.textContent=playerState.message||"";
if(status.state==="ended"&&status.endedEvent&&state.player.currentId&&state.player.endedFor!==state.player.currentId){
const finished=currentQueueItem();
if(finished){finished.status="completed";state.player.endedFor=state.player.currentId;state.logs.unshift("動画の再生終了："+finished.title);save();}
if(state.player.autoNext){void playNextQueueItem(false);}
else if(page==="requests"||page==="player"){render();toast("動画が終了しました。次の動画は手動で開始できます。");}
}
}
function savePollSettings(){
const question=document.getElementById("poll-question")?.value.trim()||state.poll.question;
const wait=Number(document.getElementById("poll-wait")?.value??state.poll.wait);
const result=Number(document.getElementById("poll-result")?.value??state.poll.result);
const continueLabel=document.getElementById("poll-continue")?.value.trim()||state.poll.continue;
const nextLabel=document.getElementById("poll-next")?.value.trim()||state.poll.next;
const tie=document.querySelector('[data-toggle="poll-tie"]')?.checked??state.poll.tie;
const zero=document.querySelector('[data-toggle="poll-zero"]')?.checked??state.poll.zero;
state.poll={question,wait,result,continue:continueLabel,next:nextLabel,tie,zero};
save();
}
function setPollRuntime(status,message,result){
pollRuntime={...pollRuntime,status,message,result:result||pollRuntime.result,active:pollRuntime.active};
const label=document.getElementById("poll-status-label");
const detail=document.getElementById("poll-status-message");
const results=document.getElementById("poll-results");
if(label)label.textContent=({idle:"停止中",voting:"投票中",results:"結果表示中",repeating:"再投票準備中",next:"次動画へ進みました",error:"エラー",stopping:"停止処理中"}[status]||"処理中");
if(detail)detail.textContent=message||"";
if(results&&result)results.textContent=result.map(item=>String(item.name)+"："+Number(item.rate).toFixed(1)+"%").join(" / ");
const start=document.querySelector("[data-poll-start]");
const stop=document.querySelector("[data-poll-stop]");
if(start)start.disabled=pollRuntime.active;
if(stop)stop.disabled=!pollRuntime.active;
}
function waitForPoll(ms,token){
if(token!==pollRunToken)return Promise.resolve(false);
return new Promise(resolve=>{
pollWaitResolve=resolve;
pollWaitTimer=setTimeout(()=>{
pollWaitTimer=null;pollWaitResolve=null;
resolve(token===pollRunToken);
},ms);
});
}
function cancelPollWait(){
if(pollWaitTimer)clearTimeout(pollWaitTimer);
pollWaitTimer=null;
const resolve=pollWaitResolve;
pollWaitResolve=null;
if(resolve)resolve(false);
}
async function finishActiveEnquete(programId){
if(!pollEnqueteOpen)return {ok:true};
if(pollFinishPromise)return pollFinishPromise;
pollFinishPromise=(async()=>{
try{
const result=await window.kananeoApp.niconico.finishEnquete({programId});
if(result?.ok)pollEnqueteOpen=false;
return result||{ok:false,message:"アンケート終了APIから応答がありません。"};
}catch{return {ok:false,message:"アンケート終了APIに接続できませんでした。"};}
})();
const result=await pollFinishPromise;
pollFinishPromise=null;
return result;
}
async function stopAutomaticPoll(){
if(!pollRuntime.active)return;
const programId=pollCurrentProgramId;
pollRunToken++;
pollRuntime.active=false;
cancelPollWait();
setPollRuntime("stopping","アンケートを終了しています。");
const finishResult=await finishActiveEnquete(programId);
pollCurrentProgramId="";
if(!finishResult?.ok){
setPollRuntime("error",finishResult?.message||"アンケートを終了できませんでした。");
toast(finishResult?.message||"アンケートを終了できませんでした。");
return;
}
setPollRuntime("idle","自動アンケートを停止しました。");
toast("自動アンケートを停止しました。");
}
async function startAutomaticPoll(){
if(pollRuntime.active){toast("自動アンケートは既に実行中です。");return;}
if(pollEnqueteOpen){
const cleanup=await finishActiveEnquete(pollCurrentProgramId||state.lastProgramId||commentConnection.programId);
if(!cleanup?.ok){toast(cleanup?.message||"前回のアンケートを終了できません。");return;}
}
savePollSettings();
const programId=state.lastProgramId||commentConnection.programId;
if(!programId){toast("先に「放送・枠管理」で放送IDを確認してください。");return;}
const input={programId,question:state.poll.question,choices:[state.poll.continue,state.poll.next],waitSeconds:Number(state.poll.wait),resultSeconds:Number(state.poll.result)};
const token=++pollRunToken;
pollRuntime={active:true,status:"starting",message:"アンケートを準備しています。",result:[]};
pollCurrentProgramId=programId;
setPollRuntime("starting","アンケートを準備しています。",[]);
try{
for(let round=1;round<=100;round++){
if(token!==pollRunToken)break;
setPollRuntime("starting","アンケートを開始しています（"+round+"回目）。",pollRuntime.result);
const started=await window.kananeoApp.niconico.startEnquete(input);
if(token!==pollRunToken){
if(started?.ok){pollEnqueteOpen=true;await finishActiveEnquete(programId);}
break;
}
if(!started?.ok)throw new Error(started?.message||"アンケートを開始できませんでした。");
pollEnqueteOpen=true;
setPollRuntime("voting",round+"回目の投票中です。残り"+input.waitSeconds+"秒。",pollRuntime.result);
const waited=await waitForPoll(input.waitSeconds*1000,token);
if(!waited){await finishActiveEnquete(programId);break;}
setPollRuntime("results","投票結果を取得しています。",pollRuntime.result);
const fetched=await window.kananeoApp.niconico.showEnqueteResult({programId});
if(token!==pollRunToken){await finishActiveEnquete(programId);break;}
if(!fetched?.ok)throw new Error(fetched?.message||"投票結果を取得できませんでした。");
const decision=await window.kananeoApp.niconico.decideEnqueteResult({
items:fetched.items,
choices:input.choices,
rules:{tie:state.poll.tie,zero:state.poll.zero}
});
if(decision?.decision==="invalid")throw new Error(decision.reason||"投票結果を判定できませんでした。");
const display=fetched.items.map(item=>String(item.name)+"："+Number(item.rate).toFixed(1)+"%").join(" / ");
setPollRuntime("results",round+"回目の結果："+display+"。"+(decision.decision==="repeat"?"継続が最多のため再投票します。":"次動画が最多のため次へ進みます。"),fetched.items);
if(input.resultSeconds>0){
const resultWait=await waitForPoll(input.resultSeconds*1000,token);
if(!resultWait){await finishActiveEnquete(programId);break;}
}
const finishResult=await finishActiveEnquete(programId);
if(!finishResult?.ok)throw new Error(finishResult?.message||"アンケートを終了できませんでした。");
if(token!==pollRunToken)break;
if(decision.decision==="next"){
const current=currentQueueItem();if(current&&current.status==="playing")current.status="completed";save();
pollRuntime.active=false;pollCurrentProgramId="";
setPollRuntime("next","「"+input.choices[1]+"」が最多でした。次の候補をニコ生へ引用再生します。",fetched.items);
await playNextQuoteItem({skipConfirmation:true});
return;
}
setPollRuntime("repeating",round+"回目のアンケートを終了しました。再投票を準備しています。",fetched.items);
}
if(token===pollRunToken&&pollRuntime.active){
pollRuntime.active=false;pollCurrentProgramId="";
setPollRuntime("idle","再投票の上限100回に到達したため停止しました。",pollRuntime.result);
toast("安全上の上限100回に到達しました。");
}else if(!pollRuntime.active){
const cleanup=await finishActiveEnquete(programId);
pollCurrentProgramId="";
if(!cleanup?.ok)setPollRuntime("error",cleanup?.message||"アンケートを終了できませんでした。",pollRuntime.result);
else setPollRuntime("idle","自動アンケートを停止しました。",pollRuntime.result);
}
}catch(error){
await finishActiveEnquete(programId);
pollRuntime.active=false;pollCurrentProgramId="";
setPollRuntime("error",error?.message||"自動アンケートでエラーが発生しました。",pollRuntime.result);
toast(error?.message||"自動アンケートでエラーが発生しました。");
}
}
function currentFilteredComments(){
const q=(document.getElementById("comments-search")?.value||"").trim().toLocaleLowerCase();
const filter=document.getElementById("comments-filter")?.value||"all";
return receivedComments.filter(c=>{
if(filter!=="all"&&c.type!==filter)return false;
if(!q)return true;
return [c.content,c.userName,c.userId].some(v=>String(v||"").toLocaleLowerCase().includes(q));
});
}
function renderComments(){
const list=document.getElementById("comments-list");
const count=document.getElementById("comment-count");
if(count)count.textContent=String(currentFilteredComments().length);
if(!list)return;
const visible=currentFilteredComments();
if(!visible.length){list.innerHTML='<div class="empty">該当するコメントはありません。</div>';return;}
list.innerHTML=visible.map(c=>{
const d=new Date(c.timestamp);
const time=Number.isNaN(d.getTime())?"--:--:--":d.toLocaleTimeString("ja-JP",{hour12:false});
const kind=({comment:"コメント",operatorComment:"放送者",gift:"ギフト",emotion:"エモーション",notification:"通知"}[c.type]||"イベント");
const history=c.isHistory?'<span class="chip">過去</span>':"";
return '<div class="comment-entry"><div class="comment-meta"><b>'+esc(c.userName||kind)+'</b><span>'+esc(time)+'</span><span class="chip purple">'+kind+'</span>'+history+'</div><div class="comment-body">'+esc(c.content||"")+'</div><div class="comment-user-id">'+esc(c.userId||"")+'</div></div>';
}).join("");
list.scrollTop=list.scrollHeight;
}
function requestReplyReason(code){
return ({NG_USER:"受付対象外",NG_WORD:"受付対象外",DUPLICATE:"既に登録済み",DUPLICATE_PENDING:"受付処理中",QUEUE_FULL:"キュー上限",USER_LIMIT:"ユーザー別上限"})[code]||"受付条件に一致しません";
}
function queueCommentRequestReply(comment,template,videoId,reason){
if(!state.requestSettings?.replyEnabled||comment?.isHistory)return;
const programId=commentConnection.programId||state.lastProgramId||"";
if(commentConnection.state!=="connected"||!programId)return;
const commentNo=/^\d+$/.test(String(comment.commentNo||""))?String(comment.commentNo):"";
const dedupeId=commentNo||String(comment.id||"");
const dedupeKey=dedupeId+"|"+videoId+"|"+String(reason||"accepted");
if(repliedRequestComments.has(dedupeKey))return;
if(requestReplyQueue.length>=20)return;
const replacements={video_id:String(videoId||""),comment_no:commentNo,reason:String(reason||"")};
let text=String(template||"").trim().replace(/\{(video_id|comment_no|reason)\}/g,(_match,key)=>replacements[key]||"");
text=text.replace(/[\r\n]+/g," ").trim();
text=Array.from(text).slice(0,80).join("");
if(!text)return;
repliedRequestComments.add(dedupeKey);
if(repliedRequestComments.size>500)repliedRequestComments.delete(repliedRequestComments.values().next().value);
requestReplyQueue.push({programId,text,videoId,code:reason||"ACCEPTED"});
void processRequestReplyQueue();
}
async function processRequestReplyQueue(){
if(requestReplyBusy)return;
requestReplyBusy=true;
try{
while(requestReplyQueue.length){
const item=requestReplyQueue.shift();
if(!state.requestSettings?.replyEnabled||commentConnection.state!=="connected"||commentConnection.programId!==item.programId)continue;
const waitMs=Math.max(0,5000-(Date.now()-lastRequestReplySentAt));
if(waitMs)await new Promise(resolve=>setTimeout(resolve,waitMs));
if(!state.requestSettings?.replyEnabled||commentConnection.state!=="connected"||commentConnection.programId!==item.programId)continue;
let result;
try{result=await window.kananeoApp.niconico.postBroadcasterComment({programId:item.programId,text:item.text});}
catch{result={ok:false,code:"SEND_FAILED",message:"運営コメントの自動返信に失敗しました。"};}
lastRequestReplySentAt=Date.now();
if(result?.ok){
state.logs.unshift("リクエスト受付結果を運営コメントで返信："+item.videoId);save();
}else{
state.logs.unshift("運営コメント自動返信失敗："+String(result?.code||"SEND_FAILED"));save();
if(Date.now()-lastRequestReplyErrorToastAt>30000){
lastRequestReplyErrorToastAt=Date.now();
toast(result?.message||"運営コメントを送信できませんでした。");
}
if(["AUTH_REQUIRED","BROADCASTER_PERMISSION_REQUIRED","PROGRAM_NOT_ON_AIR"].includes(result?.code))requestReplyQueue.length=0;
}
}
}finally{
requestReplyBusy=false;
if(requestReplyQueue.length)void processRequestReplyQueue();
}
}
async function maybeAddCommentRequest(comment){
if(!state.requestSettings?.acceptComments||comment?.type!=="comment"||comment.isHistory)return;
const content=String(comment.content||"");
const userId=String(comment.userId||"");
if(!content)return;
const candidate=await window.kananeoApp.niconico.extractRequestCandidate(content);
if(!candidate)return;
const idMatch=candidate.match(/(?:sm|nm|so)\d{1,12}/i);
if(!idMatch)return;
const pendingId=idMatch[0].toLowerCase();
if(pendingCommentRequestIds.has(pendingId))return;
pendingCommentRequestIds.add(pendingId);
try{
const validation=await window.kananeoApp.niconico.validateVideo(candidate);
if(!validation?.ok)return;
const policy=await window.kananeoApp.niconico.evaluateCommentRequest({
comment:{userId,content},
videoId:validation.videoId,
requests:state.requests,
stocks:state.stocks,
ngUsers:state.ngUsers,
ngWords:state.ngWords,
pendingVideoIds:[],
settings:state.requestSettings
});
if(!policy?.accepted){
const reason=requestReplyReason(policy?.code);
queueCommentRequestReply(comment,state.requestSettings.replyRejected,validation.videoId,reason);
if(policy?.code==="QUEUE_FULL")toast(policy.message);
return;
}
const item={id:"req-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:validation.videoId,url:validation.url,videoId:validation.videoId,status:"queued",lengthMs:0,addedAt:new Date().toISOString(),source:"comment",requestUserId:userId,requestedBy:String(comment.userName||"")};
state.requests.push(item);state.logs.unshift("コメントから動画リクエスト："+item.videoId);save();
if(page==="requests")render();
toast("コメントからリクエストを受け付けました："+item.videoId);
queueCommentRequestReply(comment,state.requestSettings.replyAccepted,validation.videoId,"");
}catch(error){
state.logs.unshift("コメントリクエスト判定エラー："+String(error?.message||"不明なエラー").slice(0,120));save();
}finally{pendingCommentRequestIds.delete(pendingId);}
}
function receiveComment(comment){
if(!comment||typeof comment!=="object")return;
receivedComments.push(comment);
void maybeAddCommentRequest(comment);
if(receivedComments.length>MAX_DISPLAY_COMMENTS)receivedComments.splice(0,receivedComments.length-MAX_DISPLAY_COMMENTS);
renderComments();
}
function updateCommentConnection(status){
if(!status||typeof status!=="object")return;
commentConnection={...commentConnection,...status};
const label=document.getElementById("comment-state-label");
const message=document.getElementById("comment-state-message");
const program=document.getElementById("comment-program-label");
if(label)label.textContent=({disconnected:"未接続",connecting:"接続中",connected:"接続済み",recovering:"再接続中",error:"接続エラー"}[commentConnection.state]||"接続状態不明");
if(message)message.textContent=commentConnection.message||"";
if(program)program.textContent=commentConnection.programId||"放送未選択";
const recording=document.getElementById("comment-recording-label");
if(recording)recording.textContent=commentConnection.recordingEnabled?"自動保存：ON":"自動保存：OFF";
const start=document.querySelector("[data-comment-start]");
const stop=document.querySelector("[data-comment-stop]");
const active=["connecting","connected","recovering"].includes(commentConnection.state);
if(start)start.disabled=active;
if(stop)stop.disabled=commentConnection.state==="disconnected";
const side=document.querySelector(".side-status span b");
if(side&&active)side.textContent="コメント接続中";
if(side&&!active)side.textContent=nicoStatus.authenticated?"ニコ生ログイン確認済み":"ニコ生 未接続";
}
async function startComments(){
const id=document.getElementById("comments-program-id")?.value.trim()||"";
if(!id){toast("放送IDまたは番組URLを入力してください。");return;}
state.lastProgramId=id;save();
updateCommentConnection({state:"connecting",message:"コメント接続を開始しています。",programId:id});
try{
const result=await window.kananeoApp.niconico.startComments(id,{fetchBacklog:document.getElementById("comments-backlog")?.checked!==false,saveComments:document.getElementById("comments-save")?.checked!==false});
if(!result?.ok){
updateCommentConnection({state:"error",message:result?.message||"コメント接続に失敗しました。",programId:id});
toast(result?.message||"コメント接続に失敗しました。");
}else{
toast(result.message||"コメント受信を開始しました。");
}
}catch{
updateCommentConnection({state:"error",message:"コメント接続に失敗しました。ログインとネットワークを確認してください。",programId:id});
toast("コメント接続に失敗しました。");
}
}
async function stopComments(){
try{
const result=await window.kananeoApp.niconico.stopComments();
updateCommentConnection({state:"disconnected",message:result?.message||"コメント受信を停止しました。",programId:""});
toast(result?.message||"コメント受信を停止しました。");
}catch{toast("切断処理に失敗しました。");}
}
async function copyVisibleComments(){
const rows=currentFilteredComments();
if(!rows.length){toast("コピーするコメントがありません。");return;}
const text=rows.map(c=>{
const time=new Date(c.timestamp);
const stamp=Number.isNaN(time.getTime())?"":time.toLocaleString("ja-JP");
return '['+stamp+'] '+(c.userName||"匿名")+': '+(c.content||"");
}).join("\\n");
const result=await window.kananeoApp.niconico.copyText(text);
toast(result?.ok?"コメントをコピーしました。":"コピーできませんでした。");
}
function exportCommentsCsv(){
const rows=currentFilteredComments();
if(!rows.length){toast("保存するコメントがありません。");return;}
const csvCell=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
const lines=[["日時","種別","ユーザー名","ユーザーID","コメント","過去コメント"].map(csvCell).join(",")];
for(const c of rows)lines.push([c.timestamp,c.type,c.userName,c.userId,c.content,c.isHistory?"はい":"いいえ"].map(csvCell).join(","));
const blob=new Blob(["\\uFEFF"+lines.join("\\r\\n")],{type:"text/csv;charset=utf-8"});
const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="nicolive-comments-"+(commentConnection.programId||"session")+".csv";a.click();URL.revokeObjectURL(url);
toast("CSVファイルを保存しました。");
}
function applyNicoStatus(status){
nicoStatus=status||{authenticated:false,label:"状態を確認できません"};
const node=document.getElementById("auth-status");
if(node){node.replaceChildren();const strong=document.createElement("b");strong.textContent=nicoStatus.authenticated?"ログインCookieを確認しました":"ニコニコにログインしていません";const br=document.createElement("br");const detail=document.createElement("span");detail.textContent=nicoStatus.authenticated?"このアプリ専用のログインセッションが見つかりました。":"公式ログイン画面でログイン後、状態を再確認してください。";node.append(strong,br,detail);}
const side=document.querySelector(".side-status span b");if(side)side.textContent=nicoStatus.authenticated?"ニコ生ログイン確認済み":"ニコ生 未接続";
}
async function checkProgram(){
const input=document.getElementById("live-id")?.value||"";
const node=document.getElementById("program-result");if(!node)return;
node.textContent="番組ページを確認しています…";
const button=document.querySelector("[data-nico-check]");if(button)button.disabled=true;
try{const r=await window.kananeoApp.niconico.checkProgram(input);node.replaceChildren();const title=document.createElement("b");title.textContent=r.ok?(r.title||r.programId):"確認できませんでした";const detail=document.createElement("div");detail.textContent=r.message||"";node.append(title,detail);if(r.ok){state.lastProgramId=r.programId;state.lastProgramTitle=r.title||r.programId;state.lastProgramStatus=r.programStatus||"";state.lastProgramEndAt=Number(r.endTime)||0;save();state.logs.unshift("番組ページを確認："+r.programId);save();void refreshDashboardStatistics(true);void refreshQuotePlayback({silent:true});}}
catch{node.textContent="確認中にエラーが発生しました。";}
finally{if(button)button.disabled=false;}
}
function go(p){page=p;render();if(p==="dashboard")void refreshDashboardStatistics(true);if(p==="player")void refreshQuotePlayback();}
document.getElementById("nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page)});
document.addEventListener("click",e=>{
const goBtn=e.target.closest("[data-go]");if(goBtn){go(goBtn.dataset.go);return}
const b=e.target.closest("button");if(!b)return;
if(b.hasAttribute("data-nico-login")){window.kananeoApp.niconico.openLogin().then(()=>toast("ニコニコ公式ログイン画面を開きました"));return;}
if(b.hasAttribute("data-nico-refresh")){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus);return;}
if(b.hasAttribute("data-nico-logout")){if(confirm("このアプリ専用のニコニコセッションを削除しますか？")){clearQuoteAutoTimer("ログアウトのため引用再生の自動次動画を停止しました。");state.playback.quoteAutoNext=false;save();window.kananeoApp.niconico.logout().then(r=>{toast(r.message);return window.kananeoApp.niconico.getSessionStatus()}).then(applyNicoStatus);}return;}
if(b.hasAttribute("data-nico-check")){void checkProgram();return;}
if(b.hasAttribute("data-dashboard-refresh")){void refreshDashboardStatistics(false);return;}
if(b.hasAttribute("data-extension-check")){void refreshExtensionOptions();return;}
if(b.hasAttribute("data-play")){const item=state.requests.find(x=>x.id===b.dataset.play);if(item)void playQueueItem(item,"request");return;}
if(b.hasAttribute("data-preview-stock")){const item=state.stocks.find(x=>x.id===b.dataset.previewStock);if(item)void playQueueItem(item,"stock");return;}
if(b.hasAttribute("data-quote-request")){const item=state.requests.find(x=>x.id===b.dataset.quoteRequest);if(item)void playQuotedQueueItem(item,"request");return;}
if(b.hasAttribute("data-quote-stock")){const item=state.stocks.find(x=>x.id===b.dataset.quoteStock);if(item)void playQuotedQueueItem(item,"stock");return;}
if(b.hasAttribute("data-quote-next")){void playNextQuoteItem();return;}
if(b.hasAttribute("data-quote-refresh")){void refreshQuotePlayback();return;}
if(b.hasAttribute("data-quote-stop")){void stopQuotedPlayback();return;}
if(b.hasAttribute("data-save-playback")){const selectedStyle=Number(document.getElementById("play-style").value);state.playback.playStyle=[0,1,2].includes(selectedStyle)?selectedStyle:1;state.playback.randomStock=document.getElementById("random-stock").checked;const autoNextToggle=document.querySelector('[data-toggle="quote-auto-next"]');state.playback.quoteAutoNext=state.playback.playStyle===0?false:!!autoNextToggle?.checked;if(state.playback.playStyle===0&&autoNextToggle)autoNextToggle.checked=false;const gap=Number(document.getElementById("quote-gap").value);state.playback.nextIntervalSeconds=Number.isInteger(gap)?Math.max(0,Math.min(300,gap)):10;const mainVolume=Number(document.getElementById("quote-main-volume").value);const subVolume=Number(document.getElementById("quote-sub-volume").value);state.playback.mainVolume=Number.isFinite(mainVolume)?Math.max(0,Math.min(1,mainVolume)):1;state.playback.subVolume=Number.isFinite(subVolume)?Math.max(0,Math.min(1,subVolume)):0;save();if(quotePlayback.active){if(state.playback.quoteAutoNext){const active=currentQueueItem();const started=Number(state.player.quoteStartedAt);if(started>0)scheduleQuoteAutoNext(active||{videoId:quotePlayback.videoId,lengthMs:state.player.quoteDurationMs},started);else quoteAutoMessage="引用再生の開始時刻が分からないため、次の動画から自動予約します。";}else clearQuoteAutoTimer("引用再生の自動次動画はOFFです。");}else updateQuoteScheduleUi();toast("引用再生・スケジューラー設定を保存しました。");}
if(b.hasAttribute("data-player-next")){void playNextQueueItem(true);return;}
if(b.hasAttribute("data-player-focus")){window.kananeoApp.niconico.focusVideo().then(r=>toast(r?.message||"プレイヤーを開けませんでした。"));return;}
if(b.hasAttribute("data-player-close")){window.kananeoApp.niconico.closeVideo().then(r=>{playerState={state:"closed",message:r?.message||"プレイヤーを閉じました。"};updateVideoPlayerState(playerState);toast(r?.message||"プレイヤーを閉じました。");});return;}
if(b.hasAttribute("data-poll-start")){void startAutomaticPoll();return;}
if(b.hasAttribute("data-poll-stop")){void stopAutomaticPoll();return;}
if(b.hasAttribute("data-comment-start")){void startComments();return;}
if(b.hasAttribute("data-comment-stop")){void stopComments();return;}
if(b.hasAttribute("data-comment-copy")){void copyVisibleComments();return;}
if(b.hasAttribute("data-comment-open-folder")){window.kananeoApp.niconico.openCommentFolder().then(r=>toast(r?.message||"保存先フォルダを開けませんでした。"));return;}
if(b.hasAttribute("data-comment-csv")){exportCommentsCsv();return;}
if(b.hasAttribute("data-comment-clear")){receivedComments=[];renderComments();toast("コメント表示をクリアしました。");return;}
if(b.hasAttribute("data-save-poll")){savePollSettings();toast("アンケート設定を保存しました");}
if(b.hasAttribute("data-save-auto")){state.automation.autoNext=document.querySelector('[data-toggle="auto-next"]').checked;state.automation.keepPosition=document.querySelector('[data-toggle="keep-position"]').checked;state.automation.autoExtend=document.querySelector('[data-toggle="auto-extend"]').checked;state.automation.adjustVideo=document.querySelector('[data-toggle="adjust-video"]').checked;state.automation.extend=+document.getElementById("extend").value||30;save();toast("自動化設定を保存しました");}
if(b.hasAttribute("data-save-paths")){state.external={obs:document.getElementById("obs").value,nair:document.getElementById("nair").value,xsplit:document.getElementById("xsplit").value};save();toast("外部ツールのパスを保存しました");}
if(b.hasAttribute("data-up")){let i=+b.dataset.up;if(i>0)[state.requests[i-1],state.requests[i]]=[state.requests[i],state.requests[i-1]];save();render()}
if(b.hasAttribute("data-down")){let i=+b.dataset.down;if(i<state.requests.length-1)[state.requests[i+1],state.requests[i]]=[state.requests[i],state.requests[i+1]];save();render()}
if(b.hasAttribute("data-stock-up")){let i=+b.dataset.stockUp;if(i>0)[state.stocks[i-1],state.stocks[i]]=[state.stocks[i],state.stocks[i-1]];save();render();}
if(b.hasAttribute("data-stock-down")){let i=+b.dataset.stockDown;if(i<state.stocks.length-1)[state.stocks[i+1],state.stocks[i]]=[state.stocks[i],state.stocks[i+1]];save();render();}
if(b.hasAttribute("data-stock-remove")){state.stocks=state.stocks.filter(x=>x.id!==b.dataset.stockRemove);save();render();}
if(b.hasAttribute("data-stock-clear")){if(quotePlayback.queueType==="stock"&&quotePlayback.active){toast("引用再生を停止してからストックを消去してください。");return;}state.stocks=[];save();render();}
if(b.hasAttribute("data-remove")){const removed=state.requests.find(x=>x.id===b.dataset.remove);state.requests=state.requests.filter(x=>x.id!==b.dataset.remove);if(removed&&removed.id===state.player.currentId){state.player.currentId="";state.player.status="closed";void window.kananeoApp.niconico.closeVideo();}save();render()}
if(b.hasAttribute("data-clear")){if(state.player.currentId)void window.kananeoApp.niconico.closeVideo();state.requests=[];state.player.currentId="";state.player.status="closed";save();render()}
if(b.hasAttribute("data-ngw")){state.ngWords.splice(+b.dataset.ngw,1);save();render()}
if(b.hasAttribute("data-ngu")){state.ngUsers.splice(+b.dataset.ngu,1);save();render()}
if(b.hasAttribute("data-track")){state.playlist.splice(+b.dataset.track,1);save();render()}
if(b.hasAttribute("data-export")){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));a.download="kananeo-settings.json";a.click();URL.revokeObjectURL(a.href)}
if(b.hasAttribute("data-clear-logs")){state.logs=[];save();render()}
if(b.hasAttribute("data-placeholder"))toast("現在の段階ではこの操作は未実装です。");
});
document.addEventListener("input",e=>{if(e.target.id==="comments-search")renderComments();});
document.addEventListener("change",e=>{if(e.target.matches('[data-toggle="quote-auto-next"]')){if(state.playback.playStyle===0&&e.target.checked){e.target.checked=false;state.playback.quoteAutoNext=false;save();toast("手動モードでは自動次動画を使えません。自動順次または自動ランダムに変更してください。");return;}state.playback.quoteAutoNext=e.target.checked;save();if(e.target.checked&&quotePlayback.active){const active=currentQueueItem();const started=Number(state.player.quoteStartedAt);if(started>0)scheduleQuoteAutoNext(active||{videoId:quotePlayback.videoId,lengthMs:state.player.quoteDurationMs},started);else{quoteAutoMessage="引用再生の開始時刻が不明です。次の動画から自動予約します。";updateQuoteScheduleUi();}}else clearQuoteAutoTimer("引用再生の自動次動画はOFFです。");toast(e.target.checked?"引用再生の自動次動画をONにしました。":"引用再生の自動次動画をOFFにしました。");}if(e.target.id==="comments-filter")renderComments();if(e.target.id==="player-auto-next"){state.player.autoNext=e.target.checked;save();toast(e.target.checked?"自動で次の動画へ切り替えます。":"自動次動画切替をOFFにしました。");}if(e.target.id==="request-from-comments"){state.requestSettings.acceptComments=e.target.checked;save();toast(e.target.checked?"コメントからのリクエスト受付をONにしました。":"コメントからのリクエスト受付をOFFにしました。");}if(e.target.id==="request-max-per-user"){state.requestSettings.maxPerUser=Math.min(50,Math.max(1,Number(e.target.value)||5));save();toast("ユーザー別リクエスト上限を保存しました。");}if(e.target.id==="request-reply-enabled"){state.requestSettings.replyEnabled=e.target.checked;save();toast(e.target.checked?"受付結果の自動返信をONにしました。":"受付結果の自動返信をOFFにしました。");}if(e.target.id==="request-reply-accepted"){state.requestSettings.replyAccepted=String(e.target.value||"").slice(0,80);save();}if(e.target.id==="request-reply-rejected"){state.requestSettings.replyRejected=String(e.target.value||"").slice(0,80);save();}});
document.addEventListener("submit",async e=>{
e.preventDefault();
if(e.target.id==="request-form"){
const title=document.getElementById("req-title").value.trim();
const input=document.getElementById("req-url").value.trim();
if(!input){toast("動画URLまたは動画IDを入力してください。");return;}
if(state.requests.length>=MAX_QUEUE_ITEMS){toast("再生キューは最大1,000件です。");return;}
try{
const validation=await window.kananeoApp.niconico.validateVideo(input);
if(!validation?.ok){toast(validation?.message||"対応していない動画URLです。");return;}
if([...state.requests,...state.stocks].some(existing=>existing.videoId===validation.videoId)){toast("同じ動画は既にリクエストまたはストックに登録されています。");return;}
const durationSeconds=Math.max(0,Number(document.getElementById("req-duration").value)||0);
const item={id:"req-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:title||validation.videoId,url:validation.url,videoId:validation.videoId,lengthMs:durationSeconds*1000,status:"queued",addedAt:new Date().toISOString()};
state.requests.push(item);state.logs.unshift("動画をキューに追加："+item.title);save();render();toast("動画をキューに追加しました。");
}catch{toast("動画URLを確認できませんでした。通信状態を確認してください。");}
}
if(e.target.id==="stock-form"){
const title=document.getElementById("stock-title").value.trim();
const input=document.getElementById("stock-url").value.trim();
const durationSeconds=Math.max(0,Number(document.getElementById("stock-duration").value)||0);
if(!input){toast("ストックに追加する動画IDまたはURLを入力してください。");return;}
if(state.stocks.length>=MAX_QUEUE_ITEMS){toast("ストックは最大1,000件です。");return;}
try{
const validation=await window.kananeoApp.niconico.validateVideo(input);
if(!validation?.ok){toast(validation?.message||"対応していない動画URLです。");return;}
if([...state.requests,...state.stocks].some(x=>x.videoId===validation.videoId)){toast("同じ動画は既にリクエストまたはストックに登録されています。");return;}
const item={id:"stock-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:title||validation.videoId,url:validation.url,videoId:validation.videoId,lengthMs:durationSeconds*1000,status:"queued",isPlayed:false,addedAt:new Date().toISOString()};
state.stocks.push(item);state.logs.unshift("ストックに追加："+item.title);save();render();toast("ストックに追加しました。");
}catch{toast("動画URLを確認できませんでした。通信状態を確認してください。");}
}
if(e.target.id==="ng-word-form"){state.ngWords.push(document.getElementById("ng-word").value.trim());save();render()}
if(e.target.id==="ng-user-form"){state.ngUsers.push(document.getElementById("ng-user").value.trim());save();render()}
if(e.target.id==="track-form"){state.playlist.push(document.getElementById("track").value.trim());save();render()}
});
if(window.kananeoApp?.niconico){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus).catch(()=>{});window.kananeoApp.niconico.onSessionChanged(applyNicoStatus);
    window.kananeoApp.niconico.onComment(receiveComment);
    window.kananeoApp.niconico.onCommentState(updateCommentConnection);window.kananeoApp.niconico.onVideoState(updateVideoPlayerState);}
render();
if(state.lastProgramId){void refreshDashboardStatistics(true);void refreshQuotePlayback({silent:true});}
setInterval(()=>{updateQuoteScheduleUi();if(page==="dashboard"){updateDashboardStatsUi();if(!dashboardStats.loading&&state.lastProgramId&&Date.now()-(Date.parse(dashboardStats.updatedAt)||0)>30000)void refreshDashboardStatistics(true);}},1000);
})();