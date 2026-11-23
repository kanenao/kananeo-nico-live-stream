"use strict";
// A read-only presentation of the broadcast tools; mutations are performed by
// the existing guarded renderer actions and niconico validation IPC.
(function(){
 function esc(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 }
 function videoTime(ms){
  const n=Number(ms);
  if(!Number.isFinite(n)||n<0)return "—";
  const s=Math.floor(n/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return h?String(h)+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"):String(m)+":"+String(sec).padStart(2,"0");
 }
 function pendingRequests(requests){
  return (Array.isArray(requests)?requests:[]).filter(item=>item&&
   !["completed","skipped","rejected","playing"].includes(item.status));
 }
 function quoteClock(quote={}){
  const active=quote.active===true,verified=quote.verified===true,progress=quote.progress;
  const title=active?String(quote.title||quote.videoId||"引用動画を確認中"):"引用再生していません";
  if(!active)return {title,state:"停止中",time:"— / —",remaining:"—",percent:0,
   hint:"動画を引用再生すると、確認できた範囲で時間を表示します。"};
  if(!verified)return {title,state:"引用再生の確認待ち",time:"— / —",remaining:"—",percent:0,
   hint:"APIからの受付後、実際の引用状態を確認しています。"};
  if(!progress?.ok)return {title,state:"引用再生中・時刻未確認",time:"— / —",remaining:"—",percent:0,
   hint:"開始時刻と動画の長さを確認できません。推測した再生時間は表示しません。"};
  const elapsed=Number(progress.elapsedMs),duration=Number(progress.durationMs),remaining=Number(progress.remainingMs);
  if(![elapsed,duration,remaining].every(Number.isFinite)||duration<=0||elapsed<0||remaining<0)
   return {title,state:"引用再生中・時刻未確認",time:"— / —",remaining:"—",percent:0,
    hint:"動画時間の情報が不正なため、再生時間は表示できません。"};
  const percent=Math.max(0,Math.min(100,Number(progress.percent)||0));
  return {title,state:"引用再生中（時間は推定）",
   time:videoTime(elapsed)+" / "+videoTime(duration),
   remaining:videoTime(remaining),percent,
   hint:"アプリが確認した引用開始時刻からの推定値です。ニコ生から実際の再生位置を取得した値ではありません。"};
 }
 function pollLabel(model={}){
  if(model.waitingForRequests)return "リクエスト待機中";
  return ({idle:"停止中",voting:"投票中",results:"結果表示中",repeating:"再投票の準備中",
   skipped:"条件不足で投票を省略",next:"次動画へ進みました",error:"エラー",stopping:"停止処理中",
   starting:"投票開始処理中"}[model.pollStatus]||"確認中");
 }
 function libraryPreview(items=[],loading=false,error=""){
  const list=(Array.isArray(items)?items:[]).filter(x=>x&&/^(?:sm|nm|so)\d{1,12}$/i.test(String(x.videoId||""))).slice(0,3);
  if(!list.length)return '<div class="broadcast-tool-empty">'+esc(loading?"ライブラリを読み込み中です…":
   error?"ライブラリを確認できませんでした。動画ライブラリで再読み込みしてください。":
   "まだ登録された動画はありません。動画ライブラリから追加できます。")+'</div>';
  return '<ul class="broadcast-tool-video-list">'+list.map(x=>'<li>'+
   '<div class="broadcast-tool-video-copy"><b>'+esc(x.title||x.videoId)+'</b><small>'+esc(x.videoId)+
   (Number(x.lengthMs)>0?" ・ "+esc(videoTime(x.lengthMs)):"")+'</small></div>'+
   '<div class="broadcast-tool-video-actions"><button type="button" class="btn" data-library-play="'+esc(x.videoId)+'">プレビュー</button>'+
   '<button type="button" class="btn primary" data-broadcast-library-request="'+esc(x.videoId)+'">リクエストへ追加</button></div></li>').join("")+'</ul>';
 }
 function requestPreview(items=[]){
  const pending=pendingRequests(items);
  if(!pending.length)return '<div class="broadcast-tool-empty">未再生リクエストはありません。</div>';
  return '<ul class="broadcast-tool-video-list">'+pending.slice(0,3).map(x=>'<li>'+
   '<div class="broadcast-tool-video-copy"><b>'+esc(x.title||x.videoId||"無題の動画")+'</b><small>'+esc(x.videoId||"動画ID不明")+
   (Number(x.lengthMs)>0?" ・ "+esc(videoTime(x.lengthMs)):"")+'</small></div>'+
   '<div class="broadcast-tool-video-actions"><button type="button" class="btn" data-play="'+esc(x.id)+'">プレビュー</button>'+
   '<button type="button" class="btn primary" data-quote-request="'+esc(x.id)+'">ニコ生で引用</button></div></li>').join("")+'</ul>';
 }
 function render(model={}){
  const pollBusy=model.pollActive===true||model.pollStartPending===true;
  const active=model.pollActive===true;
  const clock=quoteClock(model.quote);
  const pending=pendingRequests(model.requests);
  const lib=Array.isArray(model.library)?model.library:[];
  const availableStock=(Array.isArray(model.stocks)?model.stocks:[]).some(x=>x&&!["completed","skipped","rejected","playing"].includes(x.status));
  return '<section class="broadcast-quick-tools" aria-label="放送中の動画・アンケート管理">'+
   '<header class="broadcast-tools-heading"><div><span class="broadcast-tools-eyebrow">BROADCAST TOOLS</span><h2>配信中の操作・動画管理</h2><p>アンケート、引用再生時間、リクエストと保存済み動画をここでまとめて確認できます。</p></div>'+
   '<button class="btn" type="button" data-go="player">プレイヤーの詳細設定</button></header>'+
   '<div class="broadcast-tools-top"><section class="broadcast-tool-card" aria-label="自動アンケート">'+
   '<div class="broadcast-tool-card-head"><h3>自動アンケート</h3><span class="broadcast-tool-state" id="broadcast-poll-state">'+esc(pollLabel(model))+'</span></div>'+
   '<p id="broadcast-poll-message" class="broadcast-tool-description">'+esc(model.pollMessage||"引用再生の開始に連動して投票を管理します。")+'</p>'+
   '<label class="broadcast-tool-switch" for="poll-auto-on-quote"><span>引用再生時に自動実行<small>次のリクエストがなければ投票を休止します。</small></span>'+
   '<input type="checkbox" id="poll-auto-on-quote" '+(model.pollEnabled?'checked':"")+'></label>'+
   '<div class="broadcast-tool-actions"><button class="btn primary" type="button" data-poll-start '+(pollBusy?'disabled':"")+'>投票を開始</button>'+
   '<button class="btn" type="button" data-poll-stop '+(!active?'disabled':"")+'>この回を停止</button>'+
   '<button class="btn" type="button" data-go="poll">アンケート詳細</button></div></section>'+
   '<section class="broadcast-tool-card" aria-label="引用再生時間">'+
   '<div class="broadcast-tool-card-head"><h3>ニコ生への引用再生時間</h3><span class="broadcast-tool-state" id="broadcast-quote-state">'+esc(clock.state)+'</span></div>'+
   '<p class="broadcast-tool-quote-title" id="broadcast-quote-title">'+esc(clock.title)+'</p>'+
   '<div class="broadcast-quote-clock"><strong id="broadcast-quote-time">'+esc(clock.time)+'</strong><span>残り <b id="broadcast-quote-remaining">'+esc(clock.remaining)+'</b></span></div>'+
   '<progress id="broadcast-quote-progress" max="100" value="'+clock.percent+'"></progress>'+
   '<p class="broadcast-tool-note" id="broadcast-quote-hint">'+esc(clock.hint)+'</p>'+
   '<div class="broadcast-tool-actions"><button class="btn" type="button" data-quote-refresh>引用状態を再確認</button><button class="btn" type="button" data-go="player">時間・再生設定</button></div></section></div>'+
   '<section class="broadcast-tool-card broadcast-tool-requests" aria-label="動画リクエスト・ライブラリ">'+
   '<div class="broadcast-tool-card-head"><div><h3>動画リクエスト・ライブラリ</h3><p>先にリクエストを再生し、保存動画は必要なものだけキューへ追加できます。</p></div>'+
   '<span class="broadcast-tool-state">未再生 '+pending.length+' 件 ・ 保存 <span id="broadcast-library-count">'+lib.length+'</span> 件</span></div>'+
   '<div class="broadcast-tool-queue-grid"><div><div class="broadcast-tool-subhead"><h4>リクエストキュー</h4><button class="btn" type="button" data-go="requests">すべて見る</button></div>'+
   requestPreview(model.requests)+
   '<div class="broadcast-tool-actions"><button class="btn primary" type="button" data-quote-next '+(pending.length||availableStock?'':"disabled")+'>次の候補をニコ生で引用</button>'+
   '<button class="btn" type="button" data-go="stocks">ストックを開く</button></div></div>'+
   '<div><div class="broadcast-tool-subhead"><h4>保存済み動画</h4><button class="btn" type="button" data-go="library">ライブラリ管理</button></div>'+
   '<div id="broadcast-library-preview">'+libraryPreview(lib,model.libraryLoading,model.libraryError)+'</div></div></div>'+
   '<form class="broadcast-tool-add" id="request-form"><h4>リクエストをすぐに追加</h4>'+
   '<div class="broadcast-tool-add-row"><label>動画ID / URL<input class="input" id="req-url" maxlength="512" placeholder="sm12345678 または動画URL" required></label>'+
   '<label>タイトル（任意）<input class="input" id="req-title" maxlength="200" placeholder="未入力なら動画ID"></label>'+
   '<label>動画尺・秒（任意）<input class="input" id="req-duration" type="number" min="0" max="86400" placeholder="例：240"></label>'+
   '<button class="btn primary" type="submit">キューに追加</button></div></form>'+
   '<p class="broadcast-tool-note">「プレビュー」は放送に流れません。「ニコ生で引用」は確認後に視聴者へ再生します。保存済み動画を追加しても自動的には引用再生しません。</p>'+
   '</section></section>';
 }
 function prepareLibraryRequest(item,validation,requests=[],stocks=[],id=""){
  const videoId=String(validation?.videoId||"").toLowerCase();
  if(!item||!validation?.ok||!/^(?:sm|nm|so)\d{1,12}$/.test(videoId)||
    String(item.videoId||"").toLowerCase()!==videoId||!validation?.url)
   return {ok:false,message:"動画の検証に失敗しました。"};
  if(!Array.isArray(requests)||!Array.isArray(stocks)||requests.length>=1000)
   return {ok:false,message:"リクエストの登録上限に達しました。"};
  if([...requests,...stocks].some(x=>String(x?.videoId||"").toLowerCase()===videoId))
   return {ok:false,message:"この動画は既にリクエストまたはストックに登録されています。"};
  const lengthMs=Number(item.lengthMs);
  return {ok:true,item:{id:String(id),title:String(item.title||videoId).slice(0,200),
   url:String(validation.url),videoId,lengthMs:Number.isFinite(lengthMs)&&lengthMs>0?Math.min(86400000,lengthMs):0,
   status:"queued",addedAt:new Date().toISOString()}};
 }
 const api=Object.freeze({render,quoteClock,pollLabel,pendingRequests,requestPreview,libraryPreview,prepareLibraryRequest});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(typeof window!=="undefined")window.KananeoBroadcastQuickTools=api;
})();
