(() => {
const names={dashboard:"ダッシュボード",broadcast:"放送・枠管理",comments:"コメントビューア",requests:"動画リクエスト",poll:"自動アンケート",player:"プレイヤー・BGM",automation:"自動枠取り・延長",external:"OBS・外部ツール",voice:"音声・自動応答",users:"ユーザー・NG管理",logs:"履歴・バックアップ",settings:"設定"};
const key="kananeo-beta2";
let commentConnection={state:"disconnected",message:"コメントサーバー未接続",programId:"",recordingEnabled:false};
let receivedComments=[];
const pendingCommentRequestIds=new Set();
let playerState={state:"closed",currentTime:0,duration:0,message:"プレイヤー未起動"};
const MAX_DISPLAY_COMMENTS=1000;
let nicoStatus={authenticated:false,label:"状態を確認中"};
const initial={requests:[],ngWords:[],ngUsers:[],playlist:[],poll:{wait:15,result:10,continue:"もう一度",next:"次の動画へ",tie:true,zero:true},automation:{autoNext:false,autoExtend:false,keepPosition:true,adjustVideo:true,extend:30},player:{currentId:"",autoNext:true,status:"closed",currentTime:0,duration:0,endedFor:""},requestSettings:{acceptComments:false},external:{obs:"",nair:"",xsplit:""},logs:["β2 UIプロトタイプを起動しました"]};
let state=load(),page="dashboard";
function load(){
try{
const stored=JSON.parse(localStorage.getItem(key)||"{}");
const loaded={...initial,...stored};
loaded.player={...initial.player,...(stored.player||{})};
loaded.requests=(Array.isArray(stored.requests)?stored.requests:[]).map((item,index)=>({...item,id:typeof item?.id==="string"?item.id:"legacy-"+index,status:item?.status||"queued"}));
return loaded;
}catch{return structuredClone(initial)}
}
function save(){localStorage.setItem(key,JSON.stringify(state))}
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
'<div class="section"><div><h2>現在の配信状況</h2><p>放送接続後にリアルタイム情報を表示</p></div></div>'+
`<div class="stats">${[["視聴者数","—"],["コメント数","—"],["リクエスト待ち",state.requests.length],["放送残り時間","—"]].map(x=>`<div class="card"><label>${x[0]}</label><strong>${x[1]}</strong><small>接続待ち</small></div>`).join("")}</div>`+
'<div class="columns">'+panel("クイック操作","よく使う機能",'<div class="quick">'+[["♫","動画リクエスト","requests"],["◈","自動アンケート","poll"],["⟳","次枠・自動延長","automation"],["▣","OBS・外部ツール","external"]].map(x=>`<button data-go="${x[2]}"><span>${x[0]}</span><b>${x[1]}</b><small>機能を開く</small></button>`).join("")+'</div>')+
panel("システムログ","ローカルに記録した直近の操作",state.logs.slice(0,5).map(x=>`<div class="row"><i></i><div><b>${esc(x)}</b><small>ローカル記録</small></div></div>`).join(""))+'</div>'+
'<footer>kananeo nico live stream <span>0.1.0-beta.6 · Beta preview</span></footer>';
}else if(page==="requests"){
const waiting=state.requests.filter(x=>!["completed","skipped"].includes(x.status)).length;
html=hero("REQUEST QUEUE","動画リクエスト","ニコニコ動画のURL・動画IDを登録し、重複を防いで再生順を管理します。")+
panel("動画を追加","対応形式：sm / nm / so の動画ID、ニコニコ動画 watch URL",'<form id="request-form" class="grid2">'+field("動画タイトル（任意）","req-title","","未入力なら動画IDを表示") + field("動画URL / ID","req-url","","sm12345678 または動画URL")+'<button class="btn primary">キューに追加</button></form><div class="muted">現在はニコニコ動画のwatchページに対応しています。YouTube等の外部動画には未対応です。</div><label class="switchrow"><span><b>コメントからリクエスト自動受付</b><small>「リクエスト sm123…」の通常コメントのみ受付。過去コメント・NGユーザー・NGワードは対象外です。</small></span><input type="checkbox" id="request-from-comments" '+(state.requestSettings.acceptComments?"checked":"")+'></label></label>')+
panel("再生キュー",waiting+" 件が未再生",state.requests.length?`<table class="table"><thead><tr><th>#</th><th>状態</th><th>タイトル</th><th>動画ID</th><th>操作</th></tr></thead><tbody>${state.requests.map((x,i)=>`<tr><td>${i+1}</td><td>${x.status==="playing"?"再生中":x.status==="completed"?"再生済み":x.status==="skipped"?"スキップ":"待機中"}</td><td>${esc(x.title)}</td><td>${esc(x.videoId||x.url)}</td><td><button class="btn primary" data-play="${esc(x.id)}">▶ 再生</button> <button class="btn" data-up="${i}" ${i===0?"disabled":""}>↑</button> <button class="btn" data-down="${i}" ${i===state.requests.length-1?"disabled":""}>↓</button> <button class="btn" data-remove="${esc(x.id)}">削除</button></td></tr>`).join("")}</tbody></table><div class="actions"><button class="btn" data-player-next>次の動画へ</button><button class="btn" data-clear>キューを全消去</button></div>`:'<div class="empty">キューは空です。上のフォームから動画を追加できます。</div>');
}else if(page==="poll"){
html=hero("AUTOMATIC POLL","自動アンケート","投票結果APIの選択肢名・投票率を読み取り、結果に応じて自動進行する設計です。")+
'<div class="grid2">'+panel("投票時間","初期値15秒・設定変更可能",field("投票待ち時間（秒）","poll-wait",state.poll.wait)+field("結果表示時間（秒）","poll-result",state.poll.result)+'<button class="btn primary" data-save-poll>設定を保存</button>')+
panel("判定ルール","継続・次動画・同票・無投票",toggle("poll-tie","同票なら再投票","現在の動画を維持して再度投票",state.poll.tie)+toggle("poll-zero","無投票なら再投票","投票がない場合も再度投票",state.poll.zero)+field("継続の選択肢","poll-continue",state.poll.continue)+field("次動画の選択肢","poll-next",state.poll.next))+'</div>'+
'<div class="banner"><i class="led"></i><div><b>現在は設定保存のみ対応</b><small>ニコ生へのアンケート作成・結果取得・延長操作はまだ行いません。</small></div></div>';
}else if(page==="automation"){
html=hero("AUTOMATION","自動枠取り・延長","次枠取得・無料延長と、動画の再生時間に合わせた配信運用を管理します。")+
'<div class="grid2">'+panel("次枠管理","番組情報と再生状態を引き継ぐ",toggle("auto-next","放送終了時に次枠を自動取得","次枠を準備して再開",state.automation.autoNext)+toggle("keep-position","再生位置を引き継ぐ","次枠でも現在位置を維持",state.automation.keepPosition))+
panel("自動延長","動画の残り時間と枠の残り時間を同期",toggle("auto-extend","自動延長を有効にする","延長可能条件を確認後に実行",state.automation.autoExtend)+toggle("adjust-video","動画の長さに合わせて延長時間を調整","動画終了後の黒画面・ロスタイムを抑える",state.automation.adjustVideo)+field("基本追加時間（秒）","extend",state.automation.extend)+'<button class="btn primary" data-save-auto>設定を保存</button>')+'</div>';
}else if(page==="external"){
html=hero("EXTERNAL TOOLS","OBS・外部配信ツール","OBS Studio / N Air / XSplitの起動パスを登録します。外部操作は未実装です。")+
'<div class="grid3">'+panel("OBS Studio","実行ファイルのパス",field("OBS実行ファイル","obs",state.external.obs,"obs64.exe"))+panel("N Air","実行ファイルのパス",field("N Air実行ファイル","nair",state.external.nair,"N Air.exe"))+panel("XSplit","実行ファイルのパス",field("XSplit実行ファイル","xsplit",state.external.xsplit,"XSplit.exe"))+'</div><button class="btn primary" data-save-paths>パスを保存</button>';
}else if(page==="users"){
html=hero("MODERATION","ユーザー・NG管理","NGワード・NGユーザーをローカル保存します。")+
'<div class="grid2">'+panel("NGワード","非表示対象の文字列",'<form id="ng-word-form" class="actions"><input id="ng-word" class="input" placeholder="NGワード" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngWords.map((x,i)=>`<span class="tag">${esc(x)} <button data-ngw="${i}">×</button></span>`).join("")+'</div>')+
panel("NGユーザー","ユーザーID単位で制限",'<form id="ng-user-form" class="actions"><input id="ng-user" class="input" placeholder="ユーザーID" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngUsers.map((x,i)=>`<span class="tag">${esc(x)} <button data-ngu="${i}">×</button></span>`).join("")+'</div>')+'</div>';
}else if(page==="player"){
const current=state.requests.find(x=>x.id===state.player.currentId);
const playerLabel=({closed:"未起動",loading:"読み込み中",playing:"再生中",paused:"一時停止",ended:"再生終了",error:"読み込みエラー"}[playerState.state]||"状態確認中");
html=hero("PLAYER & BGM","プレイヤー・BGM","公式ニコニコ動画プレイヤーを別ウィンドウで開き、再生キューと連携します。")+
panel("動画プレイヤー",current?esc(current.title):"再生中の動画はありません",'<div class="row"><b>プレイヤー状態</b><span id="player-state-label">'+playerLabel+'</span></div><div class="row"><b>再生位置</b><span id="player-time-label">'+formatVideoTime(playerState.currentTime)+' / '+formatVideoTime(playerState.duration)+'</span></div><progress id="player-progress" max="100" value="'+(playerState.duration?Math.min(100,playerState.currentTime/playerState.duration*100):0)+'"></progress><div class="muted" id="player-message">'+esc(playerState.message||"")+'</div><label class="switchrow"><span><b>動画終了後に自動で次へ</b><small>動画の終了を検知できた場合、次の未再生動画を開きます。</small></span><input type="checkbox" id="player-auto-next" '+(state.player.autoNext?"checked":"")+'></label><div class="actions"><button class="btn primary" data-player-focus>プレイヤーを前面に表示</button><button class="btn" data-player-next>次の動画へ</button><button class="btn" data-player-close>プレイヤーを閉じる</button></div>')+
panel("BGMプレイリスト","曲名の登録・削除（音源再生は未実装）",'<form id="track-form" class="actions"><input id="track" class="input" placeholder="曲名・音源ファイル名" required><button class="btn primary">追加</button></form>'+ (state.playlist.length?state.playlist.map((x,i)=>`<div class="row"><b>${esc(x)}</b><button class="btn" data-track="${i}">削除</button></div>`).join(""):'<div class="empty">プレイリストは空です。</div>'))+
'<div class="banner"><i class="led"></i><div><b>公式Webプレイヤーを利用します</b><small>再生・一時停止は公式プレイヤー側で操作してください。アプリは再生状態を監視し、終了検知時に次の動画へ切り替えます。動画ページの仕様により終了を検知できない場合があります。</small></div></div>';
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
panel("バージョン情報","kananeo nico live stream",'<div class="row"><b>Version</b><span>0.1.0-beta.5</span></div><div class="row"><b>Runtime</b><span>Electron 45.2.3</span></div><div class="row"><b>Status</b><span>Beta 6 / video queue & player</span></div>');
}
document.getElementById("content").innerHTML=html;
}
function formatVideoTime(value){
const seconds=Math.max(0,Math.floor(Number(value)||0));
const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;
return h?String(h)+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"):String(m)+":"+String(sec).padStart(2,"0");
}
function currentQueueItem(){return state.requests.find(x=>x.id===state.player.currentId)||null;}
function getNextQueueItem(){
const index=state.requests.findIndex(x=>x.id===state.player.currentId);
for(let i=index>=0?index+1:0;i<state.requests.length;i++){
const item=state.requests[i];
if(item.status!=="completed"&&item.status!=="skipped")return item;
}
return null;
}
async function playQueueItem(item){
if(!item)return;
try{
const result=await window.kananeoApp.niconico.openVideo(item.url);
if(!result?.ok){toast(result?.message||"動画を開けませんでした。");return;}
state.requests.forEach(x=>{if(x.id!==item.id&&x.status==="playing")x.status="queued";});
item.status="playing";
state.player.currentId=item.id;state.player.status="loading";state.player.currentTime=0;state.player.duration=0;state.player.endedFor="";
state.logs.unshift("動画を再生："+item.title);save();playerState={state:"loading",currentTime:0,duration:0,message:result.message||"動画ページを開きました。"};
if(page==="requests"||page==="player")render();
toast(result.message||"動画ページを開きました。");
}catch{toast("プレイヤーを起動できませんでした。");}
}
async function playNextQueueItem(manual=false){
const current=currentQueueItem();
const previousStatus=current?.status;
if(manual&&current&&current.status==="playing")current.status="skipped";
const next=getNextQueueItem();
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
async function maybeAddCommentRequest(comment){
if(!state.requestSettings?.acceptComments||comment?.type!=="comment"||comment.isHistory)return;
const content=String(comment.content||"");
if(!content||state.ngUsers.includes(String(comment.userId||"")))return;
if(state.ngWords.some(word=>String(word||"").length>0&&content.includes(word)))return;
const candidate=await window.kananeoApp.niconico.extractRequestCandidate(content);
if(!candidate)return;
const idMatch=candidate.match(/(?:sm|nm|so)\d{1,12}/i);
if(!idMatch)return;
const pendingId=idMatch[0].toLowerCase();
if(pendingCommentRequestIds.has(pendingId)||state.requests.some(item=>(item.videoId||"").toLowerCase()===pendingId))return;
if(state.requests.length>=200){toast("リクエストキューが上限200件に達しています。");return;}
pendingCommentRequestIds.add(pendingId);
try{
const validation=await window.kananeoApp.niconico.validateVideo(candidate);
if(!validation?.ok)return;
if(state.requests.some(item=>(item.videoId||"").toLowerCase()===validation.videoId))return;
const item={id:"req-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:validation.videoId,url:validation.url,videoId:validation.videoId,status:"queued",addedAt:new Date().toISOString(),source:"comment",requestedBy:String(comment.userName||"")};
state.requests.push(item);state.logs.unshift("コメントから動画リクエスト："+item.videoId);save();
if(page==="requests")render();
toast("コメントからリクエストを受け付けました："+item.videoId);
}catch{}finally{pendingCommentRequestIds.delete(pendingId);}
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
try{const r=await window.kananeoApp.niconico.checkProgram(input);node.replaceChildren();const title=document.createElement("b");title.textContent=r.ok?(r.title||r.programId):"確認できませんでした";const detail=document.createElement("div");detail.textContent=r.message||"";node.append(title,detail);if(r.ok){state.lastProgramId=r.programId;save();state.logs.unshift("番組ページを確認："+r.programId);save();}}
catch{node.textContent="確認中にエラーが発生しました。";}
finally{if(button)button.disabled=false;}
}
function go(p){page=p;render()}
document.getElementById("nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)go(b.dataset.page)});
document.addEventListener("click",e=>{
const goBtn=e.target.closest("[data-go]");if(goBtn){go(goBtn.dataset.go);return}
const b=e.target.closest("button");if(!b)return;
if(b.hasAttribute("data-nico-login")){window.kananeoApp.niconico.openLogin().then(()=>toast("ニコニコ公式ログイン画面を開きました"));return;}
if(b.hasAttribute("data-nico-refresh")){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus);return;}
if(b.hasAttribute("data-nico-logout")){if(confirm("このアプリ専用のニコニコセッションを削除しますか？"))window.kananeoApp.niconico.logout().then(r=>{toast(r.message);return window.kananeoApp.niconico.getSessionStatus()}).then(applyNicoStatus);return;}
if(b.hasAttribute("data-nico-check")){void checkProgram();return;}
if(b.hasAttribute("data-play")){const item=state.requests.find(x=>x.id===b.dataset.play);if(item)void playQueueItem(item);return;}
if(b.hasAttribute("data-player-next")){void playNextQueueItem(true);return;}
if(b.hasAttribute("data-player-focus")){window.kananeoApp.niconico.focusVideo().then(r=>toast(r?.message||"プレイヤーを開けませんでした。"));return;}
if(b.hasAttribute("data-player-close")){window.kananeoApp.niconico.closeVideo().then(r=>{playerState={state:"closed",message:r?.message||"プレイヤーを閉じました。"};updateVideoPlayerState(playerState);toast(r?.message||"プレイヤーを閉じました。");});return;}
if(b.hasAttribute("data-comment-start")){void startComments();return;}
if(b.hasAttribute("data-comment-stop")){void stopComments();return;}
if(b.hasAttribute("data-comment-copy")){void copyVisibleComments();return;}
if(b.hasAttribute("data-comment-open-folder")){window.kananeoApp.niconico.openCommentFolder().then(r=>toast(r?.message||"保存先フォルダを開けませんでした。"));return;}
if(b.hasAttribute("data-comment-csv")){exportCommentsCsv();return;}
if(b.hasAttribute("data-comment-clear")){receivedComments=[];renderComments();toast("コメント表示をクリアしました。");return;}
if(b.hasAttribute("data-save-poll")){state.poll.wait=+document.getElementById("poll-wait").value||15;state.poll.result=+document.getElementById("poll-result").value||0;state.poll.continue=document.getElementById("poll-continue").value;state.poll.next=document.getElementById("poll-next").value;state.poll.tie=document.querySelector('[data-toggle="poll-tie"]').checked;state.poll.zero=document.querySelector('[data-toggle="poll-zero"]').checked;save();toast("アンケート設定を保存しました");}
if(b.hasAttribute("data-save-auto")){state.automation.autoNext=document.querySelector('[data-toggle="auto-next"]').checked;state.automation.keepPosition=document.querySelector('[data-toggle="keep-position"]').checked;state.automation.autoExtend=document.querySelector('[data-toggle="auto-extend"]').checked;state.automation.adjustVideo=document.querySelector('[data-toggle="adjust-video"]').checked;state.automation.extend=+document.getElementById("extend").value||30;save();toast("自動化設定を保存しました");}
if(b.hasAttribute("data-save-paths")){state.external={obs:document.getElementById("obs").value,nair:document.getElementById("nair").value,xsplit:document.getElementById("xsplit").value};save();toast("外部ツールのパスを保存しました");}
if(b.hasAttribute("data-up")){let i=+b.dataset.up;if(i>0)[state.requests[i-1],state.requests[i]]=[state.requests[i],state.requests[i-1]];save();render()}
if(b.hasAttribute("data-down")){let i=+b.dataset.down;if(i<state.requests.length-1)[state.requests[i+1],state.requests[i]]=[state.requests[i],state.requests[i+1]];save();render()}
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
document.addEventListener("change",e=>{if(e.target.id==="comments-filter")renderComments();if(e.target.id==="player-auto-next"){state.player.autoNext=e.target.checked;save();toast(e.target.checked?"自動で次の動画へ切り替えます。":"自動次動画切替をOFFにしました。");}if(e.target.id==="request-from-comments"){state.requestSettings.acceptComments=e.target.checked;save();toast(e.target.checked?"コメントからのリクエスト受付をONにしました。":"コメントからのリクエスト受付をOFFにしました。");}});
document.addEventListener("submit",async e=>{
e.preventDefault();
if(e.target.id==="request-form"){
const title=document.getElementById("req-title").value.trim();
const input=document.getElementById("req-url").value.trim();
if(!input){toast("動画URLまたは動画IDを入力してください。");return;}
try{
const validation=await window.kananeoApp.niconico.validateVideo(input);
if(!validation?.ok){toast(validation?.message||"対応していない動画URLです。");return;}
for(const existing of state.requests){
const old=await window.kananeoApp.niconico.validateVideo(existing.url);
if(old?.ok&&old.url===validation.url){toast("同じ動画は既にキューに登録されています。");return;}
}
const item={id:"req-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:title||validation.videoId,url:validation.url,videoId:validation.videoId,status:"queued",addedAt:new Date().toISOString()};
state.requests.push(item);state.logs.unshift("動画をキューに追加："+item.title);save();render();toast("動画をキューに追加しました。");
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
})();