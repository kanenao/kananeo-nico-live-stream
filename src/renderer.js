(() => {
const names={dashboard:"ダッシュボード",broadcast:"放送・枠管理",comments:"コメントビューア",requests:"動画リクエスト",poll:"自動アンケート",player:"プレイヤー・BGM",automation:"自動枠取り・延長",external:"OBS・外部ツール",voice:"音声・自動応答",users:"ユーザー・NG管理",logs:"履歴・バックアップ",settings:"設定"};
const key="kananeo-beta2";
let nicoStatus={authenticated:false,label:"状態を確認中"};
const initial={requests:[],ngWords:[],ngUsers:[],playlist:[],poll:{wait:15,result:10,continue:"もう一度",next:"次の動画へ",tie:true,zero:true},automation:{autoNext:false,autoExtend:false,keepPosition:true,adjustVideo:true,extend:30},external:{obs:"",nair:"",xsplit:""},logs:["β2 UIプロトタイプを起動しました"]};
let state=load(),page="dashboard";
function load(){try{return {...initial,...JSON.parse(localStorage.getItem(key)||"{}")}}catch{return structuredClone(initial)}}
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
'<div class="banner"><i class="led"></i><div><b>ニコニコ生放送に接続していません</b><small>現在はUI・ローカル設定の試作段階です。通信機能は次の段階で実装します。</small></div><button data-go="broadcast">接続設定 →</button></div>'+
'<div class="section"><div><h2>現在の配信状況</h2><p>放送接続後にリアルタイム情報を表示</p></div></div>'+
`<div class="stats">${[["視聴者数","—"],["コメント数","—"],["リクエスト待ち",state.requests.length],["放送残り時間","—"]].map(x=>`<div class="card"><label>${x[0]}</label><strong>${x[1]}</strong><small>接続待ち</small></div>`).join("")}</div>`+
'<div class="columns">'+panel("クイック操作","よく使う機能",'<div class="quick">'+[["♫","動画リクエスト","requests"],["◈","自動アンケート","poll"],["⟳","次枠・自動延長","automation"],["▣","OBS・外部ツール","external"]].map(x=>`<button data-go="${x[2]}"><span>${x[0]}</span><b>${x[1]}</b><small>機能を開く</small></button>`).join("")+'</div>')+
panel("システムログ","ローカルに記録した直近の操作",state.logs.slice(0,5).map(x=>`<div class="row"><i></i><div><b>${esc(x)}</b><small>ローカル記録</small></div></div>`).join(""))+'</div>'+
'<footer>kananeo nico live stream <span>0.1.0-beta.3 · Beta preview</span></footer>';
}else if(page==="requests"){
html=hero("REQUEST QUEUE","動画リクエスト","動画タイトルとURLをキューに登録し、再生順を管理します。")+
panel("動画を追加","ローカルキューへの登録",'<form id="request-form" class="grid2">'+field("動画タイトル","req-title","","タイトル") + field("動画URL / ID","req-url","","URLまたは動画ID")+'<button class="btn primary">キューに追加</button></form>')+
panel("再生待ちキュー",state.requests.length+" 件",state.requests.length?`<table class="table"><thead><tr><th>#</th><th>タイトル</th><th>URL</th><th>操作</th></tr></thead><tbody>${state.requests.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.title)}</td><td>${esc(x.url)}</td><td><button class="btn" data-up="${i}">↑</button> <button class="btn" data-down="${i}">↓</button> <button class="btn" data-remove="${i}">削除</button></td></tr>`).join("")}</tbody></table><div class="actions"><button class="btn" data-clear>全消去</button></div>`:'<div class="empty">キューは空です。上のフォームから動画を追加できます。</div>');
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
html=hero("PLAYER & BGM","プレイヤー・BGM","動画プレイヤーとBGMプレイリストを分けて管理します。")+
panel("BGMプレイリスト","曲名の登録・削除",'<form id="track-form" class="actions"><input id="track" class="input" placeholder="曲名・音源ファイル名" required><button class="btn primary">追加</button></form>'+ (state.playlist.length?state.playlist.map((x,i)=>`<div class="row"><b>${esc(x)}</b><button class="btn" data-track="${i}">削除</button></div>`).join(""):'<div class="empty">プレイリストは空です。</div>'))+
'<div class="banner"><i class="led"></i><div><b>実際の音声・動画再生は未実装</b><small>再生エンジンは後続の開発段階で追加します。</small></div></div>';
}else if(page==="comments"){
html=hero("COMMENT VIEWER","コメントビューア","リアルタイムコメント、来場者数、検索・コピー・保存をまとめます。")+
panel("コメント一覧","放送に接続するとコメントを受信します。",'<div class="empty">コメントサーバー未接続。現在はコメント受信・運営コメント送信は未実装です。</div>');
}else if(page==="broadcast"){
const authTitle=nicoStatus.authenticated?"ログインCookieを確認しました":"ニコニコにログインしていません";
const authText=nicoStatus.authenticated?"このアプリ専用のセッションにログインCookieがあります。Cookie値は表示しません。":"下のボタンからニコニコ公式ログインを開いてください。パスワードはアプリに入力しません。";
html=hero("LIVE SESSION","放送・枠管理","ニコニコ公式ログイン、放送IDによる番組ページ確認を行います。コメント受信は次の段階です。")+
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
panel("バージョン情報","kananeo nico live stream",'<div class="row"><b>Version</b><span>0.1.0-beta.3</span></div><div class="row"><b>Runtime</b><span>Electron 45.2.3</span></div><div class="row"><b>Status</b><span>UI prototype / no live connection</span></div>');
}
document.getElementById("content").innerHTML=html;
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
if(b.hasAttribute("data-save-poll")){state.poll.wait=+document.getElementById("poll-wait").value||15;state.poll.result=+document.getElementById("poll-result").value||0;state.poll.continue=document.getElementById("poll-continue").value;state.poll.next=document.getElementById("poll-next").value;state.poll.tie=document.querySelector('[data-toggle="poll-tie"]').checked;state.poll.zero=document.querySelector('[data-toggle="poll-zero"]').checked;save();toast("アンケート設定を保存しました");}
if(b.hasAttribute("data-save-auto")){state.automation.autoNext=document.querySelector('[data-toggle="auto-next"]').checked;state.automation.keepPosition=document.querySelector('[data-toggle="keep-position"]').checked;state.automation.autoExtend=document.querySelector('[data-toggle="auto-extend"]').checked;state.automation.adjustVideo=document.querySelector('[data-toggle="adjust-video"]').checked;state.automation.extend=+document.getElementById("extend").value||30;save();toast("自動化設定を保存しました");}
if(b.hasAttribute("data-save-paths")){state.external={obs:document.getElementById("obs").value,nair:document.getElementById("nair").value,xsplit:document.getElementById("xsplit").value};save();toast("外部ツールのパスを保存しました");}
if(b.hasAttribute("data-up")){let i=+b.dataset.up;if(i>0)[state.requests[i-1],state.requests[i]]=[state.requests[i],state.requests[i-1]];save();render()}
if(b.hasAttribute("data-down")){let i=+b.dataset.down;if(i<state.requests.length-1)[state.requests[i+1],state.requests[i]]=[state.requests[i],state.requests[i+1]];save();render()}
if(b.hasAttribute("data-remove")){state.requests.splice(+b.dataset.remove,1);save();render()}
if(b.hasAttribute("data-clear")){state.requests=[];save();render()}
if(b.hasAttribute("data-ngw")){state.ngWords.splice(+b.dataset.ngw,1);save();render()}
if(b.hasAttribute("data-ngu")){state.ngUsers.splice(+b.dataset.ngu,1);save();render()}
if(b.hasAttribute("data-track")){state.playlist.splice(+b.dataset.track,1);save();render()}
if(b.hasAttribute("data-export")){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));a.download="kananeo-settings.json";a.click();URL.revokeObjectURL(a.href)}
if(b.hasAttribute("data-clear-logs")){state.logs=[];save();render()}
if(b.hasAttribute("data-placeholder"))toast("β3：公式ログインセッションと番組ページ確認を追加しました。コメント受信は次段階です。");
});
document.addEventListener("submit",e=>{
e.preventDefault();
if(e.target.id==="request-form"){let title=document.getElementById("req-title").value.trim(),url=document.getElementById("req-url").value.trim();if(title&&url){state.requests.push({title,url});state.logs.unshift("動画をキューに追加："+title);save();render();toast("動画を追加しました")}}
if(e.target.id==="ng-word-form"){state.ngWords.push(document.getElementById("ng-word").value.trim());save();render()}
if(e.target.id==="ng-user-form"){state.ngUsers.push(document.getElementById("ng-user").value.trim());save();render()}
if(e.target.id==="track-form"){state.playlist.push(document.getElementById("track").value.trim());save();render()}
});
if(window.kananeoApp?.niconico){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus).catch(()=>{});window.kananeoApp.niconico.onSessionChanged(applyNicoStatus);}
render();
})();