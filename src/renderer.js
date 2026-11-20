(() => {
const names={audit:"監査ログ",remote:"リモート操作",dashboard:"ダッシュボード",broadcast:"放送・枠管理",comments:"コメントビューア",requests:"動画リクエスト",stocks:"ストック",library:"動画ライブラリ",poll:"自動アンケート",player:"プレイヤー・BGM",automation:"自動枠取り・延長",external:"OBS・外部ツール",voice:"音声・自動応答",users:"ユーザー・NG管理",logs:"履歴・バックアップ",changelog:"バージョン更新履歴",settings:"設定"};
const key="kananeo-beta2";
const COMMENT_VIEW_STORAGE_KEY=key+"-comment-view";
const BROADCAST_COMMENT_COLUMNS=[{key:"number",label:"番号"},{key:"time",label:"時刻"},{key:"user",label:"投稿者"},{key:"userId",label:"ユーザーID"},{key:"content",label:"コメント本文"},{key:"type",label:"種別"}];
const BROADCAST_COMMENT_COLORS=[{key:"comment",label:"通常コメント"},{key:"operatorComment",label:"放送者コメント"},{key:"gift",label:"ギフト"},{key:"emotion",label:"エモーション"},{key:"notification",label:"通知"}];
function loadBroadcastCommentViewSettings(){
 try{return window.KananeoCommentViewSettings.normalizeCommentViewSettings(JSON.parse(localStorage.getItem(COMMENT_VIEW_STORAGE_KEY)||"{}"));}
 catch{return window.KananeoCommentViewSettings.normalizeCommentViewSettings({});}
}
let broadcastCommentViewSettings=loadBroadcastCommentViewSettings();
let broadcastCommentViewDraft=window.KananeoCommentViewSettings.normalizeCommentViewSettings(broadcastCommentViewSettings);
let commentConnection={state:"disconnected",message:"コメントサーバー未接続",programId:"",recordingEnabled:false};
let receivedComments=[];
let videoLibraryData={version:1,items:[],history:[],updatedAt:""};
let videoLibraryLoading=false;
let videoLibraryError="";
let librarySearch="";
let librarySort="newest";
let librarySource="";
let libraryEditId="";
let librarySourceEntries=[];
let librarySourceTitle="";
let librarySourceQuery="";
let librarySourceType="";
let librarySourceLimited=false;
let librarySourceLoading=false;
let librarySourceSelected=new Set();
let userProfileSearch="";
const pendingCommentRequestIds=new Set();
const requestReplyQueue=[];
const repliedRequestComments=new Set();
let requestReplyBusy=false;
let lastRequestReplySentAt=0;
let automatedBroadcasterCommentTail=Promise.resolve();
let lastRequestReplyErrorToastAt=0;
let playerState={state:"closed",currentTime:0,duration:0,message:"プレイヤー未起動"};
let speechQueue=[];
let speechBusy=false;
let speechCurrentItem=null;
let speechDroppedCount=0;
let speechGeneration=0;
const MAX_DISPLAY_COMMENTS=1000;
const MAX_QUEUE_ITEMS=1000;
let nicoStatus={authenticated:false,label:"状態を確認中"};
let broadcastManageVerification=null;
let liveVideoState={open:false,status:"closed",programId:"",message:"放送画面は未表示です。"};
let ownMonitorStatus={running:false,phase:"starting",message:"起動時から自分の放送を監視しています。",activePrograms:[]};
let lastLiveVideoBoundsKey="";
let broadcastCommentSearch="";
let broadcastCommentType="all";
let broadcastCommentUserId="";
let broadcastReadThroughIndex=-1;
let broadcastContextMenuComment=null;
let dashboardStats={loading:false,watchCount:null,commentCount:null,updatedAt:"",error:""};
let extensionOptionsState={loading:false,methods:[],updatedAt:"",error:""};
let updateCheckState={loading:false,result:null,error:""};
let releaseHistoryState={loading:false,page:0,items:[],hasMore:true,error:"",warning:"",offline:false,query:"",type:"all",fetchedAt:""};
let autoUpdateState={supported:false,channel:"alpha",phase:"idle",message:"自動更新を確認中です。",percent:0,version:"",errorCode:"",checkedAt:""};
let bgmTracks=[];
let bgmLoading=false;
let bgmError="";
let bgmCurrentId="";
let bgmAudio=null;
let remoteControlUi={loading:false,lastRefreshAt:0,status:{running:false,mode:"localhost",protocol:"http",host:"127.0.0.1",port:0,url:"",devices:[],storageHealthy:true,storageMessage:""},lanOptions:{addresses:[],certificateName:"",privateKeyName:""},pairingCode:"",pairingExpiresAt:null,error:""};
let quotePlayback={active:false,verified:false,programId:"",videoId:"",queueType:"",itemId:"",item:null,message:"ニコ生への引用再生は停止中です。"};
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
let pollDeadlineTimer=null;
let pollVideoId="";
let pollTimingSummary="";
let pollVerifiedRound=false;
let autoPollAttemptKey="";
let autoPollPendingTimer=null;
// An empty request queue suspends auto-poll for this exact quotation only.
// A subsequent accepted request can re-arm it without restarting the video.
let autoPollWaitingForRequestKey="";
let quoteMetadataPending=null;
let quoteMetadataAttempt={key:"",at:0};
let quoteMetadataMessage="";
let autoLiveQuotePending="";
let pollStartPending=false;
let autoLiveQuoteMessage="自分の放送開始と待機中のリクエストを確認しています。";
function setAutoLiveQuoteMessage(message){
 autoLiveQuoteMessage=String(message||"").slice(0,240);
 const node=document.getElementById("request-auto-status");
 if(node)node.textContent="自動再生の状態："+autoLiveQuoteMessage;
}
const initial={requests:[],stocks:[],playback:{playStyle:1,randomStock:false,stockAutoPlay:false,mainVolume:1,subVolume:0,bgmVolume:0.7,bgmRepeat:false,quoteAutoNext:false,autoPlayOnOwnLive:false,lastAutoPlayProgramId:"",nextIntervalSeconds:10},ngWords:[],ngUsers:[],userProfiles:[],voice:{enabled:false,includeName:false,speakOperator:false,rate:1,pitch:1,volume:1,voiceURI:"",maxQueue:100,mutedUserIds:[]},playlist:[],poll:{question:"この動画を続けますか？",wait:15,result:10,continue:"もう一度",next:"次の動画へ",tie:true,zero:true,autoOnQuote:false,announceResults:true},automation:{autoNext:false,autoCreate:false,autoStartProgram:false,autoExtend:false,keepPosition:true,adjustVideo:true,extend:30},player:{currentId:"",currentQueueType:"request",autoNext:true,status:"closed",currentTime:0,duration:0,endedFor:""},requestSettings:{acceptComments:false,maxPerUser:5,replyEnabled:false,replyAccepted:"リクエスト受付：{video_id}",replyRejected:"リクエスト不可：{reason}"},external:{obs:"",nair:"",xsplit:""},streamMonitor:{enabled:false,intervalSeconds:60,autoComments:false,autoVideo:false,notifyOnLive:false,ownAccount:true,targets:[],history:[]},liveVideoZoom:{zoomMode:"auto",zoomPercent:70},logs:["β2 UIプロトタイプを起動しました"]};
let remoteAuditEntries=[],remoteAuditFilters={query:"",type:"all",from:"",to:""},remoteAuditNotificationEnabled=true;
let state=load(),page="dashboard";
let streamMonitorRuntime={busy:false,nextCheckAt:0,lastCheckAt:"",message:"監視は停止中です。",checked:0,generation:0};
let registeredMonitorStatus={enabled:false,message:"登録ユーザーの監視は停止中です。",lastCheckAt:""};
let autoNextRuntime={enabled:false,busy:false,armedProgramId:"",phase:"disabled",message:"自動次枠監視は停止中です。"};
function load(){
try{
const stored=JSON.parse(localStorage.getItem(key)||"{}");
const loaded={...initial,...stored};
loaded.player={...initial.player,...(stored.player||{})};
// A new application session cannot verify that an earlier quotation is still the same playback.
// Preserve the playlist but discard previously recorded timing to avoid unsafe automatic skips.
loaded.player.quoteStartedAt=0;
loaded.player.quoteDurationMs=0;
loaded.player.quoteVideoId="";
loaded.player.quoteProgramId="";
loaded.player.quoteExpectedEndAt=0;
loaded.player.quotePollAutoSuspended=false;
loaded.streamMonitor={...window.KananeoStreamMonitor.normalizeStreamMonitorSettings(stored.streamMonitor),ownAccount:true,history:window.KananeoStreamMonitorHistory.normalizeHistory(stored.streamMonitor?.history)};
loaded.liveVideoZoom={zoomMode:stored?.liveVideoZoom?.zoomMode==="manual"?"manual":"auto",zoomPercent:Number.isFinite(Number(stored?.liveVideoZoom?.zoomPercent))?Math.max(35,Math.min(125,Math.round(Number(stored.liveVideoZoom.zoomPercent)))):70};
loaded.playback={...initial.playback,...(stored.playback||{})};
loaded.automation={...initial.automation,...(stored.automation||{})};
loaded.poll={...initial.poll,...(stored.poll||{})};
loaded.requestSettings={...initial.requestSettings,...(stored.requestSettings||{})};
loaded.voice=window.KananeoCommentSpeech.normalizeCommentSpeechSettings({...initial.voice,...(stored.voice||{})});
loaded.userProfiles=window.KananeoUserProfiles.normalizeUserProfiles(stored.userProfiles);
loaded.requests=(Array.isArray(stored.requests)?stored.requests:[]).map((item,index)=>({...item,id:typeof item?.id==="string"?item.id:"legacy-"+index,status:item?.status==="playing"?"queued":item?.status||"queued"}));
loaded.stocks=(Array.isArray(stored.stocks)?stored.stocks:[]).map((item,index)=>({...item,id:typeof item?.id==="string"?item.id:"stock-legacy-"+index,status:item?.status==="playing"?"queued":item?.status||"queued"}));
return loaded;
}catch{return structuredClone(initial)}
}
function save(){localStorage.setItem(key,JSON.stringify(state))}
function parseStreamMonitorTargets(value){
 const rows=String(value||"").split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
 const ids=[];
 for(const row of rows){
  let id="";
  if(/^lv\d+$/i.test(row))id=row.toLowerCase();
  else{try{const url=new URL(row);if(url.protocol==="https:"&&["live.nicovideo.jp","live2.nicovideo.jp"].includes(url.hostname.toLowerCase())){const match=url.pathname.match(/^\/watch\/(lv\d+)\/?$/i);if(match)id=match[1].toLowerCase();}}catch{}}
  if(id&&!ids.includes(id))ids.push(id);
 }
 return ids.slice(0,50);
}
function addStreamMonitorHistory(type,programId,message){state.streamMonitor.history=window.KananeoStreamMonitorHistory.appendHistory(state.streamMonitor.history,{type,programId,message,at:new Date().toISOString()});save();}
function renderStreamMonitorUi(){
 const host=document.getElementById("stream-monitor-status");if(!host)return;
 const config=state.streamMonitor,rows=config.targets||[];
 const active=rows.filter(x=>x.status==="onAir").length;
 host.innerHTML='<div class="grid2"><div class="row"><b>自分の放送</b><strong>'+(ownMonitorStatus.running?"常時監視中":"接続確認中")+'</strong></div><div class="row"><b>追加監視</b><strong>'+(config.enabled?"稼働中":"停止中")+'</strong></div><div class="row"><b>登録放送</b><strong>'+rows.length+'件</strong></div><div class="row"><b>放送中</b><strong>'+active+'件</strong></div><div class="row"><b>最終確認</b><strong>'+(streamMonitorRuntime.lastCheckAt?esc(new Date(streamMonitorRuntime.lastCheckAt).toLocaleTimeString("ja-JP")):"未確認")+'</strong></div><div class="row"><b>登録ユーザー</b><strong>'+((config.userIds||[]).length)+'人</strong></div><div class="row"><b>直近の確認成功</b><strong>'+Number(registeredMonitorStatus.checkedUsers||0)+'人</strong></div><div class="row"><b>取得失敗</b><strong>'+Number(registeredMonitorStatus.failedUsers||0)+'人</strong></div></div><div class="muted">自分の放送：'+esc(ownMonitorStatus.message||"接続確認中")+'</div><div class="muted">'+esc(streamMonitorRuntime.message)+'</div><div class="muted">ユーザー監視：'+esc(registeredMonitorStatus.message||"未確認")+'</div><div class="stream-monitor-list">'+(rows.map(x=>'<div class="row"><div><b>'+esc(x.programId)+'</b><small>'+esc(x.title||"番組名未取得")+' / '+esc(window.KananeoStreamMonitor.statusLabel(x.status))+(x.lastError?" / "+esc(x.lastError):"")+'</small></div><span>'+esc(x.lastCheckedAt?new Date(x.lastCheckedAt).toLocaleTimeString("ja-JP"):"—")+'</span></div>').join("")||'<div class="empty">監視する放送IDを登録してください。</div>')+'</div><h3>監視履歴（最新20件）</h3><div class="stream-monitor-list">'+(state.streamMonitor.history.slice(0,20).map(item=>'<div class="row"><div><b>'+esc(item.programId||"監視システム")+'</b><small>'+esc(item.message)+'</small></div><span>'+esc(new Date(item.at).toLocaleString("ja-JP"))+'</span></div>').join("")||'<div class="empty">履歴はまだありません。</div>')+'</div>';
 const start=document.querySelector("[data-stream-monitor-start]"),stop=document.querySelector("[data-stream-monitor-stop]"),check=document.querySelector("[data-stream-monitor-check]");
 if(start)start.disabled=config.enabled||(!rows.length&&!config.ownAccount&&!(config.userIds||[]).length);if(stop)stop.disabled=!config.enabled;if(check)check.disabled=streamMonitorRuntime.busy||(!rows.length&&!config.ownAccount&&!(config.userIds||[]).length);
}

async function maybeAutoPlayOnOwnLive(info){
 const id=String(info?.programId||"").toLowerCase();
 if(!state.playback.autoPlayOnOwnLive||!/^lv\d{1,20}$/.test(id)||
    !["ON_AIR","ONAIR"].includes(String(info.programStatus||"").toUpperCase()))return;
 if(state.playback.lastAutoPlayProgramId===id||autoLiveQuotePending)return;
 if(quotePlayback.active&&quotePlayback.programId===id){
  setAutoLiveQuoteMessage("この番組では既に動画を引用再生中です。");return;
 }
 autoLiveQuotePending=id;
 try{
  const verification=await window.kananeoApp.niconico.checkProgram(id);
  if(!verification?.ok){
   setAutoLiveQuoteMessage("放送状態の確認に失敗："+String(verification?.message||"通信エラー"));return;
  }
  if(!["ON_AIR","ONAIR"].includes(String(verification.programStatus||"").toUpperCase())){
   setAutoLiveQuoteMessage("放送開始を確認中："+String(verification.programStatus||"状態不明"));return;
  }
  // Reconfirm account ownership before a real stream mutation.
  const own=await window.kananeoApp.niconico.getOwnBroadcast();
  if(!own?.ok||String(own.userId||"")!==String(info.userId||"")||
     !own.programs?.some(x=>String(x.programId||"").toLowerCase()===id&&
       ["ON_AIR","ONAIR"].includes(String(x.programStatus||"").toUpperCase()))){
   setAutoLiveQuoteMessage("自分の放送とログインアカウントの一致を確認できません。再ログイン・放送状態を確認してください。");return;
  }
  if(!state.playback.autoPlayOnOwnLive||(quotePlayback.active&&quotePlayback.programId===id))return;
  const current=await window.kananeoApp.niconico.getCurrentQuotation({programId:id});
  if(!current?.ok){
   setAutoLiveQuoteMessage("引用再生状態の確認に失敗："+String(current?.message||"通信エラー"));return;
  }
  if(current.exists){setAutoLiveQuoteMessage("ニコ生側で既に引用再生中です。上書きしません。");return;}
  // Old broadcast state must not suppress the new live's queued requests.
  if(quotePlayback.programId&&quotePlayback.programId!==id){
   const staleItem=[...state.requests,...state.stocks].find(x=>x.id===quotePlayback.itemId);
   if(staleItem?.status==="playing")staleItem.status="queued";
   clearQuoteAutoTimer("前枠の引用再生予約を解除しました。");
   cancelPendingAutoPoll();
   quotePlayback={active:false,verified:false,programId:"",videoId:"",queueType:"",itemId:"",message:"新しい番組へ切り替えました。"};
   state.player.quoteStartedAt=0;state.player.quoteDurationMs=0;
   state.player.quoteVideoId="";state.player.quoteProgramId="";state.player.quoteExpectedEndAt=0;
  }
  const endTime=Number(verification.endTime);
  state.lastProgramId=id;
  state.lastProgramTitle=verification.title||id;
  state.lastProgramStatus=verification.programStatus||"ON_AIR";
  state.lastProgramEndAt=Number.isFinite(endTime)&&endTime>0?endTime:0;
  save();
  const remainingMs=state.lastProgramEndAt>0?state.lastProgramEndAt*1000-Date.now():null;
  const selected=await window.kananeoApp.niconico.selectPlaybackCandidate({
   requests:state.requests.map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
   stocks:(state.playback.stockAutoPlay?state.stocks:[]).map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
   playStyle:state.playback.playStyle,randomStock:state.playback.randomStock,remainingMs
  });
  if(!selected){
   setAutoLiveQuoteMessage("再生候補がありません。動画時間、引用制限、放送の残り時間を確認してください。");
   return;
  }
  if(!state.playback.autoPlayOnOwnLive||state.playback.lastAutoPlayProgramId===id||
     (quotePlayback.active&&quotePlayback.programId===id))return;
  state.playback.lastAutoPlayProgramId=id;
  save(); // A possibly accepted mutation must never be retried blindly.
  setAutoLiveQuoteMessage("番組 "+id+" で動画リクエストの引用再生を要求しています。");
  const played=await playNextQuoteItem({
   triggeredByAuto:true,skipConfirmation:true,programId:id,autoLive:true,
   endTime:state.lastProgramEndAt,selectedCandidate:selected
  });
  setAutoLiveQuoteMessage(played?"自動引用再生を開始しました。":"自動引用再生の要求に失敗しました。ログを確認して手動操作で再確認してください。");
  toast(played?"新しい自分の放送で動画リクエストの自動再生を開始しました。":
   "自動再生を開始できませんでした。手動操作で状態を確認してください。");
 }catch(error){
  setAutoLiveQuoteMessage("自動再生の確認に失敗："+String(error?.message||"通信エラー"));
  toast("放送開始後の自動再生を確認できませんでした。手動で確認してください。");
 }finally{if(autoLiveQuotePending===id)autoLiveQuotePending="";}
}
function applyOwnMonitorStatus(status){
 if(!status||typeof status!=="object")return;
 ownMonitorStatus=status;
 for(const item of status.activePrograms||[])void maybeAutoPlayOnOwnLive(item);
 if(page==="broadcast")renderStreamMonitorUi();
}
async function handleOwnBroadcastLive(info){
 const programId=String(info?.programId||"").toLowerCase();
 if(!/^lv\d{1,20}$/.test(programId))return;
 let target=state.streamMonitor.targets.find(item=>item.programId===programId);
 if(!target&&state.streamMonitor.targets.length<50){
  target={programId,title:String(info.title||programId).slice(0,200),status:"onAir",lastCheckedAt:new Date().toISOString(),lastError:""};
  state.streamMonitor.targets.unshift(target);
 }
 if(target){target.status="onAir";target.title=String(info.title||programId).slice(0,200);}
 if(state.streamMonitor.lastOwnNotifiedProgramId===programId){save();if(page==="broadcast")renderStreamMonitorUi();return;}
 state.streamMonitor.lastOwnNotifiedProgramId=programId;
 addStreamMonitorHistory("live",programId,"自分の放送開始を自動検知しました。");
 save();void adoptCreatedBroadcast(programId);
 void maybeAutoPlayOnOwnLive(info);
 if(state.streamMonitor.autoComments){
  const active=["connecting","connected","recovering"].includes(commentConnection.state);
  if(!active)void startComments(programId);
  else if(commentConnection.programId.toLowerCase()!==programId)addStreamMonitorHistory("info",programId,"別番組のコメント受信中のため切替を保留しました。");
 }
 if(state.streamMonitor.autoVideo&&!liveVideoState.open){
  const result=await window.kananeoApp.niconico.openLiveVideo(programId);
  if(result?.ok){liveVideoState={open:true,status:"loading",programId,message:"自分の放送画面を表示しています。"};page="broadcast";render();}
 }
 if(page==="broadcast")renderStreamMonitorUi();
}
function saveStreamMonitorSettings(){
 const textarea=document.getElementById("stream-monitor-targets");
 const ids=parseStreamMonitorTargets(textarea?.value||"");
 const userIds=window.KananeoStreamMonitor.normalizeMonitorUserIds(document.getElementById("stream-monitor-users")?.value||"");
 const ownAccount=true; // 自分の放送はアプリ起動時に必ず監視します。
 if(!ids.length&&!ownAccount&&!userIds.length){toast("監視するユーザーID・放送ID、または自分の放送を登録してください。");return;}
 const previous=new Map((state.streamMonitor.targets||[]).map(x=>[x.programId,x]));
 state.streamMonitor={...state.streamMonitor,userIds,targets:ids.map(programId=>previous.get(programId)||{programId,status:"unknown",title:"",lastCheckedAt:"",lastError:""})};
 const interval=Number(document.getElementById("stream-monitor-interval")?.value||60);
 state.streamMonitor.intervalSeconds=Math.max(30,Math.min(300,Number.isFinite(interval)?interval:60));
 state.streamMonitor.autoComments=document.getElementById("stream-monitor-auto-comments")?.checked===true;
 state.streamMonitor.autoVideo=document.getElementById("stream-monitor-auto-video")?.checked===true;
 state.streamMonitor.notifyOnLive=document.getElementById("stream-monitor-notify-live")?.checked===true;
 state.streamMonitor.ownAccount=ownAccount;
 save();streamMonitorRuntime.generation++;streamMonitorRuntime.nextCheckAt=0;streamMonitorRuntime.message="監視設定を更新しました。次の確認に反映します。";void syncRegisteredUserMonitor();renderStreamMonitorUi();toast(ids.length+"番組・"+userIds.length+"ユーザーの監視設定を保存しました。");
}
async function runStreamMonitorCheck(force=false){
 const config=state.streamMonitor;
 if(!config.enabled&&!force)return;
 if(streamMonitorRuntime.busy)return;
 if(!config.targets?.length){streamMonitorRuntime.message=(config.userIds||[]).length?"登録ユーザーの監視はアプリ本体で実行中です。":"監視対象が登録されていません。";streamMonitorRuntime.nextCheckAt=Date.now()+(config.intervalSeconds||60)*1000;renderStreamMonitorUi();return;}
 if(!force&&Date.now()<streamMonitorRuntime.nextCheckAt)return;
 streamMonitorRuntime.busy=true;
 const generation=++streamMonitorRuntime.generation;
 const isCurrent=()=>window.KananeoStreamMonitor.isStreamMonitorGenerationCurrent(generation,streamMonitorRuntime.generation);
 streamMonitorRuntime.message="登録した放送ページを確認しています…";
 renderStreamMonitorUi();
 streamMonitorRuntime.nextCheckAt=Date.now()+(config.intervalSeconds||60)*1000;
 const detected=[];
 try{
  // 自分の放送はElectron本体側で別途監視します。
  if(!isCurrent())return;
  const batch=await window.KananeoStreamMonitor.checkStreamMonitorTargets(
   config.targets,
   target=>window.kananeoApp.niconico.checkProgram(target.programId),
   (target,result)=>{
    const updated=window.KananeoStreamMonitor.applyProgramCheck(target,result,new Date().toISOString());
    const index=state.streamMonitor.targets.findIndex(x=>x.programId===target.programId);
    if(index>=0)state.streamMonitor.targets[index]=updated.target;
    if(updated.becameLive){detected.push(target.programId);addStreamMonitorHistory("live",target.programId,"放送開始を検知しました。");}
    else if(!result?.ok){addStreamMonitorHistory("error",target.programId,result?.message||"番組確認に失敗しました。");}
    renderStreamMonitorUi();
   },
   {concurrency:2,isCurrent}
  );
  if(batch.cancelled||!isCurrent())return;
  const next=Date.now()+(config.intervalSeconds||60)*1000;
  streamMonitorRuntime.nextCheckAt=next;
  streamMonitorRuntime.lastCheckAt=new Date().toISOString();
  streamMonitorRuntime.checked=batch.checked;
  streamMonitorRuntime.message=batch.checked+"件を確認しました。次回確認："+new Date(next).toLocaleTimeString("ja-JP");
  save();
  for(const id of detected){
   if(!isCurrent())break;
   toast("放送開始を検知しました："+id);
   if(state.streamMonitor.autoComments){
    const active=["connecting","connected","recovering"].includes(commentConnection.state);
    if(active&&commentConnection.programId.toLowerCase()!==id){streamMonitorRuntime.message=id+" は放送中ですが、別の番組のコメントを受信中のため自動接続を保留しました。";}
    else if(!active&&isCurrent()){streamMonitorRuntime.message=id+" の放送開始を検知。コメント取得を開始しています。";await startComments(id);}
   }
  }
 }catch(error){
  if(isCurrent()){
   streamMonitorRuntime.message="放送監視でエラーが発生しました："+String(error?.message||"処理に失敗しました。").slice(0,140);
   streamMonitorRuntime.nextCheckAt=Date.now()+30000;
   toast(streamMonitorRuntime.message);
  }
 }finally{
  streamMonitorRuntime.busy=false;
  renderStreamMonitorUi();
 }
}
async function adoptCreatedBroadcast(id){
 if(!/^lv\d{1,20}$/.test(String(id||"")))return;
 const result=await window.kananeoApp.niconico.checkProgram(id);
 if(!result?.ok){toast(result?.message||"番組を確認できません。");return;}
 state.lastProgramId=result.programId;state.lastProgramTitle=result.title||id;state.lastProgramStatus=result.programStatus||"";state.lastProgramEndAt=Number(result.endTime)||0;
 broadcastManageVerification=window.KananeoBroadcastManagement.createBroadcastVerification(result);
 save();if(page==="broadcast")render();
 void refreshDashboardStatistics(true);
}
async function refreshOwnBroadcast(showMessage=false){
 const res=await window.kananeoApp.niconico.getOwnBroadcast();
 if(!res?.ok){if(showMessage)toast(res?.message||"自分の放送を取得できませんでした。");return;}
 const mine=(res.programs||[]).find(x=>["ON_AIR","ONAIR","TEST","RESERVED","SCHEDULED","WAITING"].includes(x.programStatus));
 if(!mine){if(showMessage)toast("放送中・予約中の番組がありません。");return;}
 await adoptCreatedBroadcast(mine.programId);
 if(showMessage)toast("自分の番組を取得しました："+mine.programId);
}

async function maybeStartNewProgram(programId){
 if(!state.automation.autoStartProgram||!/^lv\d{1,20}$/.test(String(programId||"")))return;
 if(state.automation.lastAutoStartAttemptId===programId)return;
 state.automation.lastAutoStartAttemptId=programId;save();
 const result=await window.kananeoApp.niconico.controlProgram(programId,"start");
 toast(result?.message||"新規番組の自動開始に失敗しました。");
 if(result?.ok)void adoptCreatedBroadcast(programId);
}
function showAutoNextStatus(){
 const node=document.getElementById("auto-next-status");
 if(node)node.textContent=state.automation.autoNext?autoNextRuntime.message:"自動次枠監視はOFFです。";
 const button=document.querySelector("[data-auto-next-check]");
 if(button)button.disabled=!state.automation.autoNext||autoNextRuntime.busy;
}
function applyAutoNextStatus(status){
 if(!status||typeof status!=="object")return;
 const old=state.automation.lastAutoNextProgramId||"";
 autoNextRuntime={...autoNextRuntime,...status};
 if(status.lastTriggeredId&&old!==status.lastTriggeredId){
  state.automation.lastAutoNextProgramId=status.lastTriggeredId;
  state.logs.unshift("終了検知・次枠作成画面を自動起動："+status.lastTriggeredId);
  save();
  toast(status.nextProgramId?"次枠を自動作成しました："+status.nextProgramId:"放送終了を検知しました。公式の次枠作成画面で確定してください。");
 }
 if(status.nextProgramId&&state.automation.lastAutoCreatedProgramId!==status.nextProgramId){
  state.automation.lastAutoCreatedProgramId=status.nextProgramId;
  save();
  void adoptCreatedBroadcast(status.nextProgramId).then(()=>maybeStartNewProgram(status.nextProgramId));
 }
 showAutoNextStatus();
}
async function syncAutoNextSettings(){
 const api=window.kananeoApp?.niconico?.configureAutoNext;
 if(typeof api!=="function")return;
 try{
  const response=await api({enabled:!!state.automation.autoNext,autoCreate:!!state.automation.autoCreate,
    lastTriggeredId:state.automation.lastAutoNextProgramId||""});
  if(!response?.ok)throw Error(response?.message||"次枠監視を設定できませんでした。");
  applyAutoNextStatus(response.status);
 }catch(error){autoNextRuntime.message=String(error?.message||"次枠設定エラー");showAutoNextStatus();}
}
async function checkAutoNextFrame(){
 const api=window.kananeoApp?.niconico?.checkAutoNext;
 if(typeof api!=="function")return;
 try{const result=await api();if(result?.phase)applyAutoNextStatus(result);}
 catch(error){toast(error?.message||"次枠の終了状態を確認できませんでした。");}
}
function applyRegisteredMonitorStatus(status){
 if(!status||typeof status!=="object")return;
 registeredMonitorStatus=status;
 if(page==="broadcast")renderStreamMonitorUi();
}
async function syncRegisteredUserMonitor(){
 if(!window.kananeoApp?.niconico?.configureRegisteredUserMonitor)return;
 try{
  const config=state.streamMonitor;
  const result=await window.kananeoApp.niconico.configureRegisteredUserMonitor({
   enabled:config.enabled,userIds:config.userIds||[],intervalSeconds:config.intervalSeconds,notifyOnLive:config.notifyOnLive===true
  });
  if(result?.status)applyRegisteredMonitorStatus(result.status);
 }catch(error){registeredMonitorStatus.message="登録ユーザーの監視設定に失敗："+String(error?.message||"通信エラー");}
}
async function onRegisteredUserLive(info){
 if(!state.streamMonitor.enabled||!info||!state.streamMonitor.userIds?.includes(String(info.userId||"")))return;
 const id=String(info.programId||"").toLowerCase();
 if(!/^lv\d{1,20}$/.test(id))return;
 if(!state.streamMonitor.targets.some(x=>x.programId===id)){
  if(state.streamMonitor.targets.length>=50){addStreamMonitorHistory("error",id,"監視対象が50件に達したため番組を追加できませんでした。");return;}
  state.streamMonitor.targets.unshift({programId:id,title:info.title||id,status:"onAir",lastCheckedAt:new Date().toISOString(),lastError:""});
 }
 addStreamMonitorHistory("live",id,"登録ユーザー "+info.userId+" の放送開始を検知しました。");
 save();toast("登録配信者の放送を検知："+id);
 if(state.streamMonitor.autoVideo&&!liveVideoState.open){
  page="broadcast";render();
  const result=await window.kananeoApp.niconico.openLiveVideo(id);
  if(result?.ok){
   liveVideoState={open:true,status:"loading",programId:id,message:"登録ユーザーの放送映像を表示しています。"};
   state.lastProgramId=id;state.lastProgramTitle=info.title||id;save();render();
  }
 }
 if(state.streamMonitor.autoComments){
  const active=["connecting","connected","recovering"].includes(commentConnection.state);
  if(!active)void startComments(id);
  else if(commentConnection.programId.toLowerCase()!==id)addStreamMonitorHistory("info",id,"別番組のコメント受信中につき自動切替を保留しました。");
 }
 if(page==="broadcast")renderStreamMonitorUi();
}
function startStreamMonitor(){
 if(!state.streamMonitor.targets?.length&&!state.streamMonitor.userIds?.length){toast("自分の放送監視は常時稼働中です。追加のユーザーや番組を登録してください。");return;}
 state.streamMonitor.enabled=true;addStreamMonitorHistory("started","","放送監視を開始しました。");save();void syncRegisteredUserMonitor();streamMonitorRuntime.nextCheckAt=0;streamMonitorRuntime.message="監視を開始しました。";renderStreamMonitorUi();void runStreamMonitorCheck(true);toast("放送監視を開始しました。アプリ起動中に定期確認します。");
}
function stopStreamMonitor(){
 state.streamMonitor.enabled=false;streamMonitorRuntime.generation++;addStreamMonitorHistory("stopped","","放送監視を停止しました。");save();void syncRegisteredUserMonitor();streamMonitorRuntime.nextCheckAt=0;streamMonitorRuntime.message="監視を停止しました。";renderStreamMonitorUi();toast("放送監視を停止しました。");
}
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
function findUserProfile(userId){
return window.KananeoUserProfiles?.findUserProfile(state.userProfiles,userId)||null;
}
function getUserDisplayName(comment,fallback="匿名"){
const profile=findUserProfile(comment?.userId);
return profile?.nickname||String(comment?.userName||fallback||"匿名");
}
function getRequesterDisplayName(item){
return getUserDisplayName({userId:item?.requestUserId,userName:item?.requestedBy},item?.requestUserId||"");
}
function getFilteredUserProfiles(){
const query=String(userProfileSearch||"").trim().toLocaleLowerCase("ja-JP");
return state.userProfiles.map((profile,index)=>({profile,index})).filter(({profile})=>{
if(!query)return true;
return [profile.userId,profile.nickname,profile.memo].join(" ").toLocaleLowerCase("ja-JP").includes(query);
});
}
function renderUserProfileRows(){
const body=document.getElementById("user-profile-rows");
const count=document.getElementById("user-profile-count");
if(!body)return;
const rows=getFilteredUserProfiles();
if(count)count.textContent=rows.length+" / "+state.userProfiles.length+" 人";
body.innerHTML=rows.length?rows.map(({profile,index})=>'<tr><td><b>'+esc(profile.nickname||"（表示名なし）")+'</b><div class="muted">'+esc(profile.userId)+'</div></td><td>'+esc(profile.memo||"—")+'</td><td>'+new Date(profile.updatedAt).toLocaleDateString("ja-JP")+'</td><td><button class="btn" data-user-profile-edit="'+index+'">編集</button> <button class="btn" data-user-profile-remove="'+index+'">削除</button></td></tr>').join(""):'<tr><td colspan="4"><div class="empty">'+(state.userProfiles.length?"検索条件に一致するユーザーはいません。":"コテハン登録はまだありません。")+'</div></td></tr>';
}
function toast(s){const t=document.getElementById("toast");t.textContent=s;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function hero(k,t,d,b=""){return `<div class="hero"><div><div class="eyebrow">${k}</div><h1>${t}</h1><p class="desc">${d}</p></div>${b}</div>`}
function panel(t,d,body){return `<article class="panel"><h2>${t}</h2><p>${d}</p>${body}</article>`}
function field(label,id,value="",placeholder=""){return `<div class="field"><label>${label}</label><input class="input" id="${id}" value="${esc(value)}" placeholder="${placeholder}"></div>`}
function toggle(id,title,desc,on){return `<div class="switchrow"><div><b>${title}</b><small>${desc}</small></div><input type="checkbox" data-toggle="${id}" ${on?"checked":""}></div>`}
function remotePermissionLabel(permission){
 return ({"status:read":"状態閲覧","comments:read":"コメント閲覧","player:control":"プレビュー操作","bgm:control":"BGM操作"}[permission]||permission);
}
function formatRemoteTimestamp(value){
 if(!value)return "未接続";
 const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("ja-JP");
}
async function refreshRemoteAudit(){const [result,notificationResult]=await Promise.all([window.kananeoApp.remote.getAudit(),window.kananeoApp.remote.getNotificationSettings()]);if(!result?.ok){toast("監査ログを取得できませんでした。");return;}remoteAuditEntries=Array.isArray(result.entries)?result.entries:[];if(notificationResult?.ok)remoteAuditNotificationEnabled=notificationResult.settings?.enabled!==false;const toggle=document.getElementById("remote-audit-notification-enabled");if(toggle)toggle.checked=remoteAuditNotificationEnabled;renderRemoteAuditRows();}
function renderRemoteAuditRows(){
 const host=document.getElementById("remote-audit-rows");if(!host)return;
 const q=remoteAuditFilters.query.toLowerCase(),from=Date.parse(remoteAuditFilters.from||""),to=Date.parse((remoteAuditFilters.to||"")+"T23:59:59.999");
 const rows=remoteAuditEntries.filter(x=>{const at=Date.parse(x.at);return (!q||[x.at,x.type,x.path,x.ip,x.command,x.method].join(" ").toLowerCase().includes(q))&&(remoteAuditFilters.type==="all"||x.type===remoteAuditFilters.type)&&(!Number.isFinite(from)||at>=from)&&(!Number.isFinite(to)||at<=to);});
 const count=document.getElementById("remote-audit-count");if(count)count.textContent=rows.length+"件";
 const summary=window.KananeoRemoteAuditSummary.summarizeRemoteAudit(remoteAuditEntries);
 const summaryHtml='<div class="grid2"><div class="row"><b>記録件数</b><strong>'+summary.total+'件</strong></div><div class="row"><b>警告イベント</b><strong>'+summary.warnings+'件</strong></div><div class="row"><b>異常アクセス検知</b><strong>'+summary.anomalies+'件</strong></div><div class="row"><b>接続元IP数</b><strong>'+summary.uniqueSources+'件</strong></div></div>';
 const anomalyCount=summary.anomalies;
 const warning=anomalyCount?'<div class="notice warning" role="status">不審なアクセスの集中を'+anomalyCount+'件検知しました。接続元IPと発生時刻を確認し、心当たりのない端末はリモート端末一覧から失効してください。</div>':'';
 host.innerHTML=summaryHtml+warning+(rows.length?'<div class="table-wrap"><table class="table"><thead><tr><th>日時</th><th>イベント</th><th>重要度</th><th>接続元</th><th>API</th><th>操作</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(formatRemoteTimestamp(x.at))+'</td><td>'+esc(x.type==="security_anomaly"?"異常アクセス検知":x.type)+'</td><td>'+esc(x.severity)+'</td><td>'+esc(x.ip||"—")+'</td><td>'+esc((x.method||"")+" "+(x.path||""))+'</td><td>'+esc(x.command||"—")+'</td></tr>').join("")+'</tbody></table></div>':'<div class="empty">条件に一致する監査ログはありません。</div>');
}
function renderRemoteDeviceRows(){
 const host=document.getElementById("remote-device-rows");
 const count=document.getElementById("remote-device-count");
 if(!host)return;
 const devices=remoteControlUi.status.devices||[];
 if(count)count.textContent=devices.length+"台";
 host.innerHTML=devices.length?devices.map(device=>{
  const permissions=(device.permissions||[]).map(remotePermissionLabel).join("・")||"権限なし";
  const status=device.revokedAt?"失効済み":"有効";
  return '<article class="remote-device-row"><div class="remote-device-main"><b>'+esc(device.name)+'</b><small>'+esc(status)+' / 登録 '+esc(formatRemoteTimestamp(device.createdAt))+' / 最終接続 '+esc(formatRemoteTimestamp(device.lastSeenAt))+'</small><small>権限：'+esc(permissions)+'</small><small class="muted">'+esc(device.id)+'</small></div><button class="btn danger" type="button" data-remote-revoke="'+esc(device.id)+'" '+(device.revokedAt?"disabled":"")+'>端末を失効</button></article>';
 }).join(""):'<div class="empty">登録端末はありません。</div>';
}
function updateRemoteControlUi(){
 const status=remoteControlUi.status||{},serverLabel=document.getElementById("remote-server-state"),url=document.getElementById("remote-server-url");
 const start=document.querySelector("[data-remote-start]"),stop=document.querySelector("[data-remote-stop]"),open=document.querySelector("[data-remote-open-controller]");
 const copyUrl=document.querySelector("[data-remote-copy-url]"),storage=document.getElementById("remote-storage-message"),pairing=document.getElementById("remote-pairing-code");
 const copyCode=document.querySelector("[data-remote-copy-code]"),expiry=document.getElementById("remote-pairing-expiry"),error=document.getElementById("remote-control-error");
 const startLan=document.querySelector("[data-remote-start-lan]"),certificateLabel=document.getElementById("remote-tls-certificate-label"),keyLabel=document.getElementById("remote-tls-key-label");
 if(serverLabel)serverLabel.textContent=remoteControlUi.loading?"状態確認中…":status.running?(status.mode==="lan"?"LAN HTTPS 起動中":"localhost 起動中"):"停止中";
 if(url)url.textContent=status.url||"サーバーを起動するとURLを表示します。";
 if(start)start.disabled=remoteControlUi.loading||!!status.running;if(stop)stop.disabled=remoteControlUi.loading||!status.running;
 if(open)open.disabled=!status.running;if(copyUrl)copyUrl.disabled=!status.url;
 const pairButton=document.querySelector("[data-remote-pair-create]");if(pairButton)pairButton.disabled=remoteControlUi.loading||!status.running;
 if(startLan)startLan.disabled=remoteControlUi.loading||!!status.running||!remoteControlUi.lanOptions.addresses.length||!remoteControlUi.lanOptions.certificateName||!remoteControlUi.lanOptions.privateKeyName;
 if(certificateLabel)certificateLabel.textContent=remoteControlUi.lanOptions.certificateName||"未選択";
 if(keyLabel)keyLabel.textContent=remoteControlUi.lanOptions.privateKeyName||"未選択";
 if(storage)storage.textContent=status.storageHealthy===false?(status.storageMessage||"保存データを読み取れません。"):"端末情報はこのPC内にハッシュ形式で保存します。";
 if(pairing)pairing.textContent=remoteControlUi.pairingCode||"未発行";if(copyCode)copyCode.disabled=!remoteControlUi.pairingCode;
 if(expiry)expiry.textContent=remoteControlUi.pairingExpiresAt?"有効期限："+formatRemoteTimestamp(remoteControlUi.pairingExpiresAt):"ペアリングコードは5分間有効です。";
 if(error)error.textContent=remoteControlUi.error||"";renderRemoteDeviceRows();
}
async function refreshRemoteControlUi(silent=false){
 if(remoteControlUi.loading)return;
 remoteControlUi.loading=true;updateRemoteControlUi();
 try{
  const result=await window.kananeoApp.remote.getStatus();
  if(!result?.ok)throw new Error(result?.message||"リモート操作の状態を取得できませんでした。");
  remoteControlUi.status=result;remoteControlUi.error="";
  if(remoteControlUi.pairingExpiresAt&&(!result.pairingExpiresAt||Number(result.pairingExpiresAt)<=Date.now())){remoteControlUi.pairingCode="";remoteControlUi.pairingExpiresAt=null;}
 }catch(error){
  remoteControlUi.error=error?.message||"状態を取得できませんでした。";
  if(!silent)toast(remoteControlUi.error);
 }finally{remoteControlUi.loading=false;remoteControlUi.lastRefreshAt=Date.now();if(page==="remote")updateRemoteControlUi();}
}
async function refreshRemoteLanOptions(){
 try{
  const result=await window.kananeoApp.remote.getLanOptions();if(!result?.ok)throw new Error(result?.message||"LAN情報を取得できませんでした。");
  remoteControlUi.lanOptions={addresses:Array.isArray(result.addresses)?result.addresses:[],certificateName:result.certificateName||"",privateKeyName:result.privateKeyName||""};
  const select=document.getElementById("remote-lan-address");
  if(select){const previous=select.value;select.innerHTML=remoteControlUi.lanOptions.addresses.map(item=>'<option value="'+esc(item.address)+'">'+esc(item.address+" / "+item.interfaceName)+'</option>').join("")||'<option value="">利用可能なLAN IPv4がありません</option>';if(remoteControlUi.lanOptions.addresses.some(item=>item.address===previous))select.value=previous;}
  if(page==="remote")updateRemoteControlUi();
 }catch(error){remoteControlUi.error=error?.message||"LAN情報を取得できませんでした。";if(page==="remote")updateRemoteControlUi();}
}
async function chooseRemoteTlsFile(kind){
 const result=await window.kananeoApp.remote.selectTlsFile(kind);
 if(!result?.ok){if(result?.code!=="CANCELLED")toast(result?.message||"TLSファイルを選択できませんでした。");return;}
 await refreshRemoteLanOptions();toast((kind==="certificate"?"証明書":"秘密鍵")+"を選択しました。");
}
async function startRemoteControlFromUi(mode="localhost"){
 const port=Number(document.getElementById("remote-port")?.value||18240),input={port,mode};
 if(mode==="lan"){
  if(!document.getElementById("remote-lan-enable")?.checked){toast("LAN接続を有効にするチェックを入れてください。");return;}
  const bindAddress=document.getElementById("remote-lan-address")?.value||"";
  if(!bindAddress||!remoteControlUi.lanOptions.certificateName||!remoteControlUi.lanOptions.privateKeyName){toast("LANアドレス・TLS証明書・秘密鍵をすべて選択してください。");return;}
  if(!confirm("LAN内の他端末からHTTPS接続できるようになります。選択したネットワークと証明書を確認しましたか？"))return;
  input.bindAddress=bindAddress;input.enableLan=true;
 }
 remoteControlUi.loading=true;remoteControlUi.error="";updateRemoteControlUi();
 try{const result=await window.kananeoApp.remote.start(input);if(!result?.ok)throw new Error(result?.message||"サーバーを起動できませんでした。");remoteControlUi.status=result.status;remoteControlUi.error="";toast(mode==="lan"?"HTTPS LANリモート操作サーバーを起動しました。":"localhostリモート操作サーバーを起動しました。");}
 catch(error){remoteControlUi.error=error?.message||"サーバーを起動できませんでした。";}
 finally{remoteControlUi.loading=false;updateRemoteControlUi();}
}
async function stopRemoteControlFromUi(){
 remoteControlUi.loading=true;updateRemoteControlUi();
 try{
  const result=await window.kananeoApp.remote.stop();
  if(!result?.ok)throw new Error(result?.message||"サーバーを停止できませんでした。");
  remoteControlUi.status=result.status;remoteControlUi.pairingCode="";remoteControlUi.pairingExpiresAt=null;remoteControlUi.error="";
  toast("リモート操作サーバーを停止しました。");
 }catch(error){remoteControlUi.error=error?.message||"サーバーを停止できませんでした。";}
 finally{remoteControlUi.loading=false;updateRemoteControlUi();}
}
async function createRemotePairingFromUi(){
 const permissions=["status:read"];
 document.querySelectorAll("[data-remote-permission]:checked").forEach(input=>permissions.push(input.dataset.remotePermission));
 const result=await window.kananeoApp.remote.createPairing({permissions});
 if(!result?.ok){toast(result?.message||"ペアリングコードを発行できませんでした。");return;}
 remoteControlUi.pairingCode=result.code;
 remoteControlUi.pairingExpiresAt=result.expiresAt;
 remoteControlUi.error="";
 await refreshRemoteControlUi(true);
 updateRemoteControlUi();
 toast("ワンタイムペアリングコードを発行しました。");
}
async function revokeRemoteDeviceFromUi(deviceId){
 const device=(remoteControlUi.status.devices||[]).find(item=>item.id===deviceId);
 if(!device||device.revokedAt)return;
 if(!confirm("「"+device.name+"」の接続権限を失効しますか？\n\n失効後は、この端末のトークンを再利用できません。"))return;
 const result=await window.kananeoApp.remote.revokeDevice(deviceId);
 if(!result?.ok){toast(result?.message||"端末を失効できませんでした。");return;}
 remoteControlUi.pairingCode="";remoteControlUi.pairingExpiresAt=null;
 await refreshRemoteControlUi(true);
 toast("端末を失効しました。");
}

function renderReleaseHistoryRows(){
 const list=document.getElementById("release-history-list");
 if(!list)return;
 const status=document.getElementById("release-history-status");
 const more=document.querySelector("[data-release-history-more]");
 const query=releaseHistoryState.query.trim().toLocaleLowerCase("ja-JP");
 const items=releaseHistoryState.items.filter(item=>{
  const kind=/-alpha\./.test(item.version)?"alpha":/-(?:beta|rc)\./.test(item.version)?"beta":"stable";
  if(releaseHistoryState.type!=="all"&&releaseHistoryState.type!==kind)return false;
  if(!query)return true;
  return [item.version,item.title,...(item.notes||[]),...(item.details||[])].join(" ").toLocaleLowerCase("ja-JP").includes(query);
 });
 const scope=releaseHistoryState.offline?"アプリ同梱の履歴（公開状況は未確認）":"GitHub Releasesの公開履歴";
 if(status)status.textContent=releaseHistoryState.loading?"変更履歴を取得しています…":
  releaseHistoryState.error||((releaseHistoryState.warning?releaseHistoryState.warning+" ":"")+
   scope+"：読み込み済み "+releaseHistoryState.items.length+" バージョン"+
   (releaseHistoryState.hasMore?"（続きがあります）":""));
 list.innerHTML=items.map(item=>{
  const type=/-alpha\./.test(item.version)?"α開発版":/-(?:beta|rc)\./.test(item.version)?"βテスト版":"製品版";
  const localOnly=item.localOnly===true;
  const date=item.publishedAt?new Date(item.publishedAt).toLocaleString("ja-JP"):"公開日時未確認";
  const details=Array.isArray(item.details)?item.details:[];
  const notes=Array.isArray(item.notes)?item.notes:[];
  const renderNotes=rows=>'<ul class="release-notes">'+rows.map(note=>'<li>'+esc(note)+'</li>').join("")+'</ul>';
  const detailsHtml=details.length?'<div class="release-history-source">アプリ同梱の詳細更新履歴</div>'+renderNotes(details):"";
  const notesHtml=notes.length?'<div class="release-history-source">GitHub Releasesの変更概要</div>'+renderNotes(notes):"";
  const noDetails=!details.length&&!notes.length?
   '<div class="muted">この版の詳しい変更内容は記録されていません。公開済みの情報をご確認ください。</div>':"";
  const installer=localOnly?"配布情報未確認":item.setupAvailable?"Setupあり":"Setup未確認";
  const link=localOnly
   ?'<button class="btn" data-update-open-releases>GitHub公開一覧</button>'
   :'<button class="btn" data-release-history-open="'+esc(item.tag)+'">GitHubで詳細</button>';
  const installed=item.version===String(window.kananeoApp.version||"");
  return '<article class="release-history-item">'+
   '<div class="release-history-heading"><div><b>'+esc(item.version)+
   (installed?' <span class="tag">使用中</span>':"")+
   '</b><small>'+esc(type)+" / "+esc(date)+" / "+installer+
   (localOnly?" / 公開未確認":"")+'</small></div>'+link+'</div>'+
   detailsHtml+notesHtml+noDetails+'</article>';
 }).join("")||'<div class="empty">'+(releaseHistoryState.loading?"履歴を読み込み中です…":releaseHistoryState.items.length?"検索条件に一致するバージョンはありません。":"公開済みのバージョンを取得できませんでした。")+'</div>';
 if(more){more.hidden=!releaseHistoryState.hasMore;more.disabled=releaseHistoryState.loading;}
 const refresh=document.querySelector("[data-release-history-refresh]");
 if(refresh)refresh.disabled=releaseHistoryState.loading;
}
async function fetchReleaseHistory(reset=false){
 if(releaseHistoryState.loading)return;
 if(reset){releaseHistoryState.page=0;releaseHistoryState.items=[];releaseHistoryState.hasMore=true;releaseHistoryState.offline=false;releaseHistoryState.warning="";}
 if(!releaseHistoryState.hasMore){renderReleaseHistoryRows();return;}
 const pageNumber=releaseHistoryState.page+1;
 releaseHistoryState.loading=true;releaseHistoryState.error="";
 renderReleaseHistoryRows();
 try{
  const response=await window.kananeoApp.updates.history(pageNumber,reset);
  if(!response?.ok)throw Error(response?.message||"バージョン更新履歴を取得できませんでした。");
  const existing=new Set(releaseHistoryState.items.map(item=>item.tag));
  for(const item of response.items||[])if(item?.tag&&!existing.has(item.tag)){releaseHistoryState.items.push(item);existing.add(item.tag);}
  releaseHistoryState.page=pageNumber;
  releaseHistoryState.hasMore=response.hasMore===true&&pageNumber<20;
  releaseHistoryState.fetchedAt=response.fetchedAt||"";
  releaseHistoryState.offline=response.offline===true;
  releaseHistoryState.warning=String(response.warning||"").slice(0,200);
 }catch(error){
  releaseHistoryState.error=String(error?.message||"更新履歴の取得に失敗しました。").slice(0,180);
 }finally{releaseHistoryState.loading=false;renderReleaseHistoryRows();}
}

function render(){
document.getElementById("crumb").textContent=names[page];
document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
let html="";
if(page==="dashboard"){
html=hero("STREAM CONTROL CENTER","配信コントロールセンター","配信に必要な操作を、ひとつの画面からまとめて管理します。",'<button class="btn primary" data-go="broadcast">放送管理を開く</button>')+
'<div class="banner"><i class="led"></i><div><b>ニコニコ生放送に接続していません</b><small>公式ログイン、NDGRコメント受信、引用再生、運営コメント自動返信に対応しました。番組作成・次枠・延長操作は未実装です。</small></div><button data-go="broadcast">接続設定 →</button></div>'+
'<div class="section"><div><h2>現在の配信状況</h2><p id="dashboard-program-label">'+(state.lastProgramId?(state.lastProgramTitle||state.lastProgramId)+" / "+programStatusLabel(state.lastProgramStatus):"放送ID未設定")+'</p></div><button class="btn" data-dashboard-refresh '+(dashboardStats.loading?"disabled":"")+'>統計を更新</button></div>'+
'<div class="stats"><div class="card"><label>来場者数</label><strong id="dashboard-viewers">'+(dashboardStats.watchCount==null?"—":Number(dashboardStats.watchCount).toLocaleString("ja-JP"))+'</strong><small>累計来場者数</small></div><div class="card"><label>コメント数</label><strong id="dashboard-comments">'+(dashboardStats.commentCount==null?"—":Number(dashboardStats.commentCount).toLocaleString("ja-JP"))+'</strong><small>累計コメント数</small></div><div class="card"><label>リクエスト待ち</label><strong id="dashboard-requests">'+state.requests.filter(x=>!["completed","skipped"].includes(x.status)).length+'</strong><small>未再生キュー</small></div><div class="card"><label>放送残り時間</label><strong id="dashboard-remaining">'+formatRemainingTime()+'</strong><small id="dashboard-updated">'+(dashboardStats.updatedAt?"更新："+new Date(dashboardStats.updatedAt).toLocaleTimeString("ja-JP"):"統計未取得")+'</small></div></div>'+
'<div class="muted" id="dashboard-stats-error">'+esc(dashboardStats.error||"")+'</div>'+
'<div class="columns">'+panel("クイック操作","よく使う機能",'<div class="quick">'+[["♫","動画リクエスト","requests"],["◈","自動アンケート","poll"],["⟳","次枠・自動延長","automation"],["▣","OBS・外部ツール","external"]].map(x=>`<button data-go="${x[2]}"><span>${x[0]}</span><b>${x[1]}</b><small>機能を開く</small></button>`).join("")+'</div>')+
panel("システムログ","ローカルに記録した直近の操作",state.logs.slice(0,5).map(x=>`<div class="row"><i></i><div><b>${esc(x)}</b><small>ローカル記録</small></div></div>`).join(""))+'</div>'+
'<footer>kananeo nico live stream <span>'+esc(window.kananeoApp.version)+' · Alpha preview</span></footer>';
}else if(page==="requests"){
const waiting=state.requests.filter(x=>!["completed","skipped","rejected"].includes(x.status)).length;
const requestRows=state.requests.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(x.status==="playing"?"再生中":x.status==="completed"?"再生済み":x.status==="skipped"?"スキップ":x.status==="rejected"?"引用不可":"待機中")+'</td><td>'+esc(x.title)+(x.requestUserId?'<div class="muted">リクエスト者：'+esc(getRequesterDisplayName(x))+'</div>':"")+'</td><td>'+esc(x.videoId||x.url)+'</td><td><button class="btn" data-play="'+esc(x.id)+'">プレビュー</button> <button class="btn primary" data-quote-request="'+esc(x.id)+'">ニコ生へ送る</button> <button class="btn" data-up="'+i+'" '+(i===0?"disabled":"")+'>&uarr;</button> <button class="btn" data-down="'+i+'" '+(i===state.requests.length-1?"disabled":"")+'>&darr;</button> <button class="btn" data-remove="'+esc(x.id)+'">削除</button></td></tr>').join("");
html=hero("VIEWER REQUESTS","動画リクエスト","視聴者から受け付けた動画を管理します。プレビューとニコ生への引用再生は別操作です。")+
panel("放送開始時の動画リクエスト自動再生","自分の番組がON_AIRになったら先頭のリクエストを一度だけ引用再生します。",'<label class="switchrow"><span><b>番組開始時に動画を自動再生</b><small>初期OFF。自分の放送のみ。リクエスト優先、ストックはストック自動再生ON時だけ利用。番組ごとに一回だけ試行します。</small></span><input type="checkbox" id="request-auto-on-live" '+(state.playback.autoPlayOnOwnLive?"checked":"")+'></label><div class="muted">配信開始の検知後に放送状態と引用状態を確認します。すでに別の動画を引用再生中の場合は変更しません。</div><div class="muted" id="request-auto-status">自動再生の状態：'+esc(autoLiveQuoteMessage)+'</div>')+
panel("動画リクエストを追加","動画ID・watch URLと、分かる場合は動画時間も登録します。",'<form id="request-form" class="grid3">'+field("動画タイトル（任意）","req-title","","未入力なら動画IDを表示")+field("動画URL / ID","req-url","","sm12345678 または動画URL")+field("動画時間（秒・任意）","req-duration","","例：240")+'<button class="btn primary">キューに追加</button></form><label class="switchrow"><span><b>コメントからリクエスト自動受付</b><small>明示コマンドのみ受付。NGユーザー・NGワード・重複・上限を順に確認します。</small></span><input type="checkbox" id="request-from-comments" '+(state.requestSettings.acceptComments?"checked":"")+'></label><div class="field"><label>1ユーザーあたりの未再生リクエスト上限（1〜50）</label><input class="input" id="request-max-per-user" type="number" min="1" max="50" value="'+(state.requestSettings.maxPerUser||5)+'"></div><label class="switchrow"><span><b>受付結果を運営コメントで自動返信</b><small>初期設定OFF。配信主権限が必要で、送信間隔は最低5秒に制限します。</small></span><input type="checkbox" id="request-reply-enabled" '+(state.requestSettings.replyEnabled?"checked":"")+'></label><div class="field"><label>受付時の返信（80文字以内）</label><textarea class="input" id="request-reply-accepted" rows="2" maxlength="80">'+esc(state.requestSettings.replyAccepted||initial.requestSettings.replyAccepted)+'</textarea></div><div class="field"><label>却下時の返信（80文字以内）</label><textarea class="input" id="request-reply-rejected" rows="2" maxlength="80">'+esc(state.requestSettings.replyRejected||initial.requestSettings.replyRejected)+'</textarea></div><div class="muted">使用できる置換：{video_id}、{comment_no}、{reason}。受付返信はキュー登録後、却下返信はNG・重複・上限などの判定後に送信します。一般コメントとしてではなく、ニコ生の運営コメントとして投稿されます。</div><div class="muted">「プレビュー」では一覧から削除しません。ニコ生の引用再生が確認された動画だけリクエスト／ストックから自動削除し、再生履歴に残します。</div>')+
panel("リクエストキュー",waiting+" 件が未再生",state.requests.length?'<table class="table"><thead><tr><th>#</th><th>状態</th><th>タイトル</th><th>動画ID</th><th>操作</th></tr></thead><tbody>'+requestRows+'</tbody></table><div class="actions"><button class="btn" data-player-next>次の動画をプレビュー</button><button class="btn primary" data-quote-next>次の動画をニコ生へ引用再生</button><button class="btn" data-clear>リクエストを全消去</button><button class="btn" data-go="stocks">ストックを管理</button></div>':'<div class="empty">リクエストキューは空です。</div>');
}else if(page==="stocks"){
const waiting=state.stocks.filter(x=>!["completed","skipped","rejected"].includes(x.status)).length;
const stockRows=state.stocks.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+(x.status==="playing"?"再生中":x.status==="completed"?"再生済み":x.status==="skipped"?"スキップ":x.status==="rejected"?"引用不可":"待機中")+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.videoId||x.url)+'</td><td><button class="btn" data-preview-stock="'+esc(x.id)+'">プレビュー</button> <button class="btn primary" data-quote-stock="'+esc(x.id)+'">ニコ生へ送る</button> <button class="btn" data-stock-up="'+i+'" '+(i===0?"disabled":"")+'>&uarr;</button> <button class="btn" data-stock-down="'+i+'" '+(i===state.stocks.length-1?"disabled":"")+'>&darr;</button> <button class="btn" data-stock-remove="'+esc(x.id)+'">削除</button></td></tr>').join("");
html=hero("STOCK LIBRARY","ストック","運営が事前に用意した動画をリクエストとは別に管理します。リクエストが空になった場合の次候補として使います。")+
panel("ストックを追加","動画ID・watch URLと動画時間を登録します。マイリスト一括取込は次段階で対応します。",'<form id="stock-form" class="grid3">'+field("動画タイトル（任意）","stock-title","","未入力なら動画IDを表示")+field("動画URL / ID","stock-url","","sm12345678 または動画URL")+field("動画時間（秒・任意）","stock-duration","","例：240")+'<button class="btn primary">ストックに追加</button></form>')+
panel("ストックの自動再生","リクエストがなくなったらストックへ自動で進みます。",'<label class="switchrow"><span><b>ストックの自動再生</b><small>リクエストを優先し、次にストックから自動再生します。動画時間を登録してください。</small></span><input type="checkbox" id="stock-auto-play" '+(state.playback.stockAutoPlay?"checked":"")+'></label><div class="muted">ONにすると引用再生の自動切替も有効になります。ストックが空のときは自動で次動画へ進みません。</div>')+
panel("ストックキュー",waiting+" 件が未再生",state.stocks.length?'<table class="table"><thead><tr><th>#</th><th>状態</th><th>タイトル</th><th>動画ID</th><th>操作</th></tr></thead><tbody>'+stockRows+'</tbody></table><div class="actions"><button class="btn primary" data-quote-next>次の候補をニコ生へ引用再生</button><button class="btn" data-stock-clear>ストックを全消去</button></div>':'<div class="empty">ストックは空です。</div>');
}else if(page==="library"){
const historyRows=videoLibraryData.history.slice(0,20).map(item=>'<tr><td>'+esc(item.title)+'</td><td>'+esc(item.videoId)+'</td><td>'+new Date(item.playedAt).toLocaleString("ja-JP")+'</td><td>'+((item.playbackType==="quotation")?"引用再生":"プレビュー")+'</td></tr>').join("");
html=hero("VIDEO LIBRARY","動画ライブラリ","動画をまとめて保存・検索し、再生履歴を管理します。マイリスト・あとで見る・シリーズからの取り込みに対応します。",'<button class="btn" data-library-refresh>ライブラリを更新</button>')+
'<div class="stats"><div class="card"><label>登録動画</label><strong id="library-total">'+videoLibraryData.items.length.toLocaleString("ja-JP")+'</strong><small>最大20,000件</small></div><div class="card"><label>再生履歴</label><strong>'+videoLibraryData.history.length.toLocaleString("ja-JP")+'</strong><small>最大10,000件</small></div><div class="card"><label>総再生回数</label><strong>'+videoLibraryData.items.reduce((sum,item)=>sum+(Number(item.playCount)||0),0).toLocaleString("ja-JP")+'</strong><small>登録済み動画の合計</small></div><div class="card"><label>保存状態</label><strong>'+(videoLibraryLoading?"取得中…":videoLibraryError?"確認必要":"保存済み")+'</strong><small>'+esc(videoLibraryError||"PC内のユーザーデータフォルダーに保存")+'</small></div></div>'+
panel("動画を登録","ニコニコ動画ID・URLから動画を1件ずつ追加します。",'<form id="library-add-form" class="grid3">'+field("動画ID / URL","library-video-id","","sm12345678 または動画URL")+field("動画タイトル（任意）","library-title","","タイトルを入力")+field("動画時間（秒・任意）","library-duration","","例：180")+'<button class="btn primary">ライブラリへ追加</button></form>')+
panel("一括取り込み","あとで見る・マイリスト・シリーズの動画を、ログイン済みの専用セッションから読み込みます。",'<form id="library-import-form"><div class="grid2"><div class="field"><label>取り込み元</label><select class="input" id="library-import-type"><option value="watch-later">あとで見る</option><option value="mylist">マイリスト</option><option value="series">シリーズ</option><option value="text">動画ID / URLの貼り付け</option><option value="json">JSONバックアップ</option></select></div><div class="field"><label>マイリスト / シリーズURL・ID（あとで見るでは不要）</label><input class="input" id="library-import-id" placeholder="例：https://www.nicovideo.jp/mylist/123456"></div></div><div class="field"><label>動画ID・URL一覧 / JSONデータ（テキスト・JSON取り込み時）</label><textarea class="input" id="library-import-text" rows="4" placeholder="sm12345678&#10;https://www.nicovideo.jp/watch/nm123456"></textarea></div><div class="actions"><button class="btn primary" type="submit">動画を一括取り込み</button><button class="btn" type="button" data-library-browse>一覧を表示して選択</button><button class="btn" type="button" data-library-export>ライブラリをJSON保存</button></div><div class="muted">取り込みは最大1,000件。重複動画は統合されます。ニコニコの非公開APIを利用するため、仕様変更や権限によって取得できない場合があります。</div></form>')+
panel("一覧から選択して取り込む","マイリスト・シリーズ・あとで見るの動画を先に一覧表示し、必要な動画だけ選択して保存します。",'<div id="library-source-preview" class="empty">取り込み元を選んで「一覧を表示して選択」を押してください。</div>')+panel("動画ライブラリ","登録した動画を検索してプレビューできます。削除しても再生履歴は残ります。",'<div class="grid2"><div class="field"><label>タイトル・動画ID・タグ・メモで検索</label><input class="input" id="library-search" value="'+esc(librarySearch)+'" placeholder="動画を検索"></div><div class="field"><label>並び順</label><select class="input" id="library-sort"><option value="newest" '+(librarySort==='newest'?'selected':'')+'>登録が新しい順</option><option value="oldest" '+(librarySort==='oldest'?'selected':'')+'>登録が古い順</option><option value="played" '+(librarySort==='played'?'selected':'')+'>再生回数が多い順</option></select></div></div><div class="section"><p id="library-count">'+videoLibraryData.items.length+' 件</p><button class="btn" data-library-export>JSONを書き出す</button></div><div class="muted" id="library-empty">'+(videoLibraryLoading?"読み込み中です…":videoLibraryData.items.length?"":"動画ライブラリは空です。上から動画を追加するか、一括取り込みしてください。")+'</div><div style="overflow-x:auto"><table class="table"><thead><tr><th>動画</th><th>時間</th><th>再生数</th><th>登録日</th><th>操作</th></tr></thead><tbody id="library-items-body"></tbody></table></div>')+
panel("最近の再生履歴","プレビュー再生とニコ生への引用再生を新しい順に表示します。",'<div class="actions"><button class="btn" data-library-clear-history '+(!videoLibraryData.history.length?"disabled":"")+'>再生履歴を消去</button></div><div style="overflow-x:auto"><table class="table"><thead><tr><th>タイトル</th><th>動画ID</th><th>再生日時</th><th>再生方式</th></tr></thead><tbody>'+(historyRows||'<tr><td colspan="4"><div class="empty">再生履歴はまだありません。</div></td></tr>')+'</tbody></table></div>');
}else if(page==="poll"){
const pollActive=pollRuntime.active;
const pollResults=(pollRuntime.result||[]).map(item=>esc(item.name)+"："+Number(item.rate).toFixed(1)+"%").join(" / ");
html=hero("AUTOMATIC POLL","自動アンケート","投票を作成し、設定時間後に結果を取得。継続票が最多なら再投票、次動画票が最多ならリクエスト優先でニコ生へ引用再生します。")+
'<div class="grid2">'+panel("アンケート内容","選択肢は2つです。表示名は投票結果と完全一致させます。",field("質問","poll-question",state.poll.question)+field("継続の選択肢","poll-continue",state.poll.continue)+field("次動画の選択肢","poll-next",state.poll.next))+
panel("投票時間・判定ルール","投票時間は3〜300秒、結果表示は0〜120秒",field("投票待ち時間（秒）","poll-wait",state.poll.wait)+field("結果表示時間（秒）","poll-result",state.poll.result)+'<div class="muted">再投票の待機時間は結果から自動計算：継続票最多10〜60秒／同票10秒／無投票5秒。次回開始までの秒数を運営コメントでお知らせします。未再生リクエスト0件ならアンケートを省略します。</div>'+'<button class="btn" data-save-poll>設定を保存</button>')+'</div>'+
panel("自動アンケート実行","放送主権限のあるログインで、配信中の放送IDを指定してください。",'<label class="switchrow"><span><b>引用再生開始時に自動アンケートを実行</b><small>初期OFF。次のリクエストが0件なら投票を休止し、新しいリクエストを受け付けると同じ動画で自動再開します。次動画でもON設定を維持します。</small></span><input type="checkbox" id="poll-auto-on-quote" '+(state.poll.autoOnQuote?"checked":"")+'></label><label class="switchrow"><span><b>アンケート結果・再投票予告・リクエストなしを運営コメントで通知</b><small>投票結果と次の投票までの秒数を通知し、未再生リクエストが0件なら投票せず運営コメントでお知らせします。初期ON。放送主権限が必要です。</small></span><input type="checkbox" id="poll-announce-results" '+(state.poll.announceResults!==false?"checked":"")+'></label><div class="banner"><i class="led"></i><div><b id="poll-status-label">'+esc(pollRuntime.status==="idle"?"停止中":pollRuntime.status==="voting"?"投票中":pollRuntime.status==="results"?"結果表示中":pollRuntime.status==="repeating"?"再投票準備中":pollRuntime.status==="skipped"?(autoPollWaitingForRequestKey?"リクエスト待機中":"アンケート省略中"):pollRuntime.status==="next"?"次動画へ進みました":pollRuntime.status==="error"?"エラー":"処理中")+'</b><small id="poll-status-message">'+esc(pollRuntime.message)+'</small></div></div><div id="poll-results" class="empty">'+(pollResults||"投票結果はまだありません。")+'</div><div id="poll-timing-summary" class="muted">'+esc(pollTimingSummary||"短い動画では自動アンケートを省略します。")+'</div><div class="field"><label>動画の長さ（秒）を手動で補完（自動取得できない場合）</label><input class="input" id="poll-manual-duration" type="number" min="1" max="86400" placeholder="例：240"></div><div class="actions"><button class="btn" data-poll-duration-fetch>動画時間を自動取得</button><button class="btn" data-poll-duration-set>動画時間を登録</button></div><div class="muted">アプリ外から再生された動画は開始時刻を確認できない場合があります。そのときはアプリから引用再生を開始し直してください。</div><div class="actions"><button class="btn primary" data-poll-start '+(pollActive?"disabled":"")+'>自動アンケート開始</button><button class="btn" data-poll-stop '+(!pollActive?"disabled":"")+'>この回の投票を停止</button></div><div class="muted">リクエスト待機中は、新しいリクエストの受付後に現在の動画で自動投票を再開します（動画の残り時間が十分な場合）。完全に止めるには上の自動アンケート設定をOFFにしてください。</div><div class="muted">結果がAPIから取得できない場合は自動スキップしません。動画の尺が短ければ投票を省略し、再投票は最大100回で停止します。</div>');
}else if(page==="automation"){
html=hero("AUTOMATION","自動枠取り・延長","次枠取得・無料延長と、動画の再生時間に合わせた配信運用を管理します。")+
'<div class="grid2">'+panel("次枠管理","番組情報と再生状態を引き継ぐ",toggle("auto-next","放送終了時に次枠取得を実行","アプリ本体で終了を監視し次枠取得を開始します。",state.automation.autoNext)+toggle("auto-create-next","前枠を引き継いで次枠を自動作成","タイトル・説明・タグ・公開設定を再利用して番組を自動作成（初期OFF）。作成された放送の本番開始は別操作です。",state.automation.autoCreate)+'<div class="muted" id="auto-next-status">'+esc(state.automation.autoNext?autoNextRuntime.message:"自動次枠監視はOFFです。")+'</div><button class="btn" data-auto-next-check '+(!state.automation.autoNext?"disabled":"")+'>今すぐ終了状態を確認</button>'+toggle("keep-position","再生位置を引き継ぐ","次枠でも現在位置を維持",state.automation.keepPosition))+
panel("自動延長","動画の残り時間と枠の残り時間を同期",toggle("auto-extend","自動延長を有効にする","延長APIの仕様・条件を実機確認後に有効化します",state.automation.autoExtend)+toggle("adjust-video","動画の長さに合わせて延長時間を調整","動画終了後の黒画面・ロスタイムを抑える",state.automation.adjustVideo)+field("基本追加時間（秒）","extend",state.automation.extend)+'<button class="btn primary" data-save-auto>設定を保存</button>')+'</div>'+panel("延長可能な方法を確認","現在の放送で利用できる延長方法・分数を読み取ります。ここでは延長操作を実行しません。",'<div class="actions"><button class="btn primary" data-extension-check '+(extensionOptionsState.loading?"disabled":"")+ '>延長方法を確認</button><span class="muted" id="extension-updated">'+(extensionOptionsState.updatedAt?"更新："+new Date(extensionOptionsState.updatedAt).toLocaleTimeString("ja-JP"):"未確認")+'</span></div><div id="extension-options" class="empty">'+esc(extensionOptionsState.error||(extensionOptionsState.methods.length?extensionOptionsState.methods.map(x=>x.type+"："+x.minutes+"分").join(" / "):"放送IDを確認してから延長方法を取得してください。"))+'</div>');
}else if(page==="external"){
html=hero("EXTERNAL TOOLS","OBS・外部配信ツール","OBS Studio / N Air / XSplitの起動パスを登録します。外部操作は未実装です。")+
'<div class="grid3">'+panel("OBS Studio","実行ファイルのパス",field("OBS実行ファイル","obs",state.external.obs,"obs64.exe"))+panel("N Air","実行ファイルのパス",field("N Air実行ファイル","nair",state.external.nair,"N Air.exe"))+panel("XSplit","実行ファイルのパス",field("XSplit実行ファイル","xsplit",state.external.xsplit,"XSplit.exe"))+'</div><button class="btn primary" data-save-paths>パスを保存</button>';
}else if(page==="users"){

html=hero("MODERATION & USERS","ユーザー・NG管理","NGワード・NGユーザーに加え、ユーザーIDごとのコテハンとメモをローカル管理します。")+
'<div class="grid2">'+panel("NGワード","非表示・受付対象外の文字列",'<form id="ng-word-form" class="actions"><input id="ng-word" class="input" placeholder="NGワード" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngWords.map((x,i)=>'<span class="tag">'+esc(x)+' <button data-ngw="'+i+'">×</button></span>').join("")+'</div>')+
panel("NGユーザー","ユーザーID単位で制限",'<form id="ng-user-form" class="actions"><input id="ng-user" class="input" placeholder="ユーザーID" required><button class="btn primary">追加</button></form><div class="tags">'+state.ngUsers.map((x,i)=>'<span class="tag">'+esc(x)+' <button data-ngu="'+i+'">×</button></span>').join("")+'</div>')+'</div>'+
panel("コテハン・ユーザーメモ","登録した表示名はコメントビューアと動画リクエスト一覧に反映します。",'<form id="user-profile-form"><div class="grid3">'+field("ニコニコユーザーID","profile-user-id","","例：12345678")+field("コテハン（表示名）","profile-nickname","","コメント欄に表示する名前")+'<div class="field"><label>メモ（任意・1,000文字以内）</label><textarea class="input" id="profile-memo" maxlength="1000" rows="3" placeholder="常連・リクエスト傾向など"></textarea></div></div><div class="actions"><button class="btn primary" type="submit">登録・更新</button><button class="btn" type="button" data-user-profile-clear>入力をクリア</button></div><div class="muted">コテハンはこのPC内に保存します。ニコニコ側のプロフィールやコメント投稿名は変更しません。</div></form>')+
panel("登録ユーザー",state.userProfiles.length+" 人を登録中",'<div class="field"><label>ユーザーID・コテハン・メモで検索</label><input class="input" id="user-profile-search" value="'+esc(userProfileSearch)+'" placeholder="登録ユーザーを検索"></div><div class="muted" id="user-profile-count">'+state.userProfiles.length+" / "+state.userProfiles.length+' 人</div><div style="overflow-x:auto"><table class="table"><thead><tr><th>ユーザー</th><th>メモ</th><th>更新日</th><th>操作</th></tr></thead><tbody id="user-profile-rows"></tbody></table></div>');
}else if(page==="player"){
const current=currentQueueItem();
const playerLabel=({closed:"未起動",loading:"読み込み中",playing:"再生中",paused:"一時停止",ended:"再生終了",error:"読み込みエラー"}[playerState.state]||"状態確認中");
const quoteLabel=quotePlayback.active?(quotePlayback.verified?"引用再生中（状態確認済み）":"引用再生API受付済み（状態未確認）"):"停止中";
const bgmCurrentTrack=bgmTracks.find(track=>track.id===bgmCurrentId)||null;
const bgmRows=bgmTracks.map((track,index)=>'<div class="row bgm-track-row"><div><b>'+esc(track.name)+'</b><small>'+(index+1)+'. '+esc(track.extension.toUpperCase().slice(1))+' / '+formatBgmFileSize(track.size)+(track.id===bgmCurrentId?' / 選択中':'')+'</small></div><div class="actions"><button class="btn" data-bgm-move="up" data-bgm-id="'+esc(track.id)+'" '+(index===0?'disabled':'')+' title="上へ移動">↑</button><button class="btn" data-bgm-move="down" data-bgm-id="'+esc(track.id)+'" '+(index===bgmTracks.length-1?'disabled':'')+' title="下へ移動">↓</button><button class="btn '+(track.id===bgmCurrentId&&!bgmAudio?.paused?'primary':'')+'" data-bgm-play="'+esc(track.id)+'">'+(track.id===bgmCurrentId&&!bgmAudio?.paused?'再生中':'再生')+'</button><button class="btn" data-bgm-remove="'+esc(track.id)+'">削除</button></div></div>').join("");
const bgmVolume=clampBgmVolume(state.playback.bgmVolume);
const legacyPlaylistRows=state.playlist.map((name,index)=>'<div class="row"><b>'+esc(name)+'</b><button class="btn" type="button" data-track="'+index+'">メモを削除</button></div>').join("");
html=hero("PLAYER & BGM","プレイヤー・BGM","プレビュー再生と、配信中の番組へ動画を送る引用再生を分けて管理します。")+
panel("プレビュー用Webプレイヤー",current?esc(current.title):"プレビュー対象の動画はありません",'<div class="row"><b>プレイヤー状態</b><span id="player-state-label">'+playerLabel+'</span></div><div class="row"><b>再生位置</b><span id="player-time-label">'+formatVideoTime(playerState.currentTime)+' / '+formatVideoTime(playerState.duration)+'</span></div><progress id="player-progress" max="100" value="'+(playerState.duration?Math.min(100,playerState.currentTime/playerState.duration*100):0)+'"></progress><div class="muted" id="player-message">'+esc(playerState.message||"")+'</div><label class="switchrow"><span><b>プレビュー終了後に自動で次へ</b><small>公式Webプレイヤーの終了を検知した場合だけ次のプレビューを開きます。</small></span><input type="checkbox" id="player-auto-next" '+(state.player.autoNext?"checked":"")+'></label><div class="actions"><button class="btn" data-player-focus>プレビューを前面に表示</button><button class="btn" data-player-next>次のプレビュー</button><button class="btn" data-player-close>プレビューを閉じる</button></div>')+
panel("ニコ生への引用再生",quotePlayback.videoId?"現在の動画ID："+esc(quotePlayback.videoId):"引用再生中の動画はありません。",'<div class="banner"><i class="led"></i><div><b>'+quoteLabel+'</b><small>'+esc(quotePlayback.message)+'</small></div></div><div class="row"><b>対象放送</b><span>'+esc(quotePlayback.programId||state.lastProgramId||"放送ID未確認")+'</span></div><div class="actions"><button class="btn" data-quote-refresh>引用再生状態を確認</button><button class="btn primary" data-quote-next>次の候補をニコ生へ送る</button><button class="btn danger" data-quote-stop '+(!quotePlayback.active?"disabled":"")+'>引用再生を停止</button></div><div class="muted">「ニコ生へ送る」を押すと放送中の視聴者へ実際に動画が流れます。実行前に確認ダイアログを表示します。引用再生は放送主権限が必要です。</div>')+
panel("再生スケジューラー","リクエストを優先し、リクエストが無い場合はストックから選びます。",'<div class="grid2">'+
'<div class="field"><label>再生モード</label><select class="input" id="play-style"><option value="0" '+(state.playback.playStyle===0?"selected":"")+ '>手動（自分で次へ）</option><option value="1" '+(state.playback.playStyle===1?"selected":"")+ '>自動順次</option><option value="2" '+(state.playback.playStyle===2?"selected":"")+ '>自動ランダム</option></select><small class="muted">手動モードでは自動次動画を無効にし、ボタン操作だけで次へ進みます。</small></div>'+
'<label class="switchrow"><span><b>ストックをランダム再生</b><small>リクエストを優先した後、ストックをランダムに選びます。</small></span><input type="checkbox" id="random-stock" '+(state.playback.randomStock?"checked":"")+'></label>'+
toggle("quote-auto-next","引用再生の終了後に自動で次動画へ","登録した動画時間＋待ち時間で次の動画へ差し替えます。初期状態はOFFです。",state.playback.quoteAutoNext)+
field("次動画へ移る待ち時間（秒）","quote-gap",state.playback.nextIntervalSeconds)+
field("メイン動画音量（0〜1）","quote-main-volume",state.playback.mainVolume)+field("マイク音量（0〜1）","quote-sub-volume",state.playback.subVolume)+'</div><div class="muted" id="quote-schedule-state">'+esc(quoteAutoMessage)+'</div><button class="btn" data-save-playback>再生設定を保存</button><div class="muted">動画時間が未登録の場合や、アプリ外で開始され開始時刻が不明な引用再生は、自動切替を行いません。放送残り時間が分かる場合は、枠内に収まる候補を選びます。</div>')+
panel("ローカルBGMプレイヤー","PC内の音源ファイルを登録して、アプリから再生・停止・曲送り・音量調整できます。",'<div class="row"><div><b id="bgm-current-name">'+esc(bgmCurrentTrack?.name||"再生する曲を選択してください")+'</b><small id="bgm-current-status">'+(bgmAudio&&!bgmAudio.paused?"再生中":bgmCurrentTrack?"一時停止中":"停止中")+'</small></div><span id="bgm-clock">00:00 / 00:00</span></div><input class="input bgm-seek" type="range" min="0" max="1000" step="1" id="bgm-progress" value="0" '+(!bgmCurrentTrack?"disabled":"")+'><div class="actions"><button class="btn" type="button" data-bgm-prev '+(!bgmTracks.length?"disabled":"")+'>前の曲</button><button class="btn primary" type="button" data-bgm-toggle '+(!bgmTracks.length?"disabled":"")+'>'+(bgmAudio&&!bgmAudio.paused?"一時停止":"再生")+'</button><button class="btn" type="button" data-bgm-next '+(!bgmTracks.length?"disabled":"")+'>次の曲</button><button class="btn" type="button" data-bgm-stop '+(!bgmCurrentTrack?"disabled":"")+'>停止</button></div><div class="grid2"><div class="field"><label>音量 <span id="bgm-volume-label">'+Math.round(bgmVolume*100)+'%</span></label><input class="input" type="range" id="bgm-volume" min="0" max="1" step="0.01" value="'+bgmVolume+'"></div><label class="switchrow"><span><b>プレイリストを繰り返す</b><small>最後の曲のあと先頭へ戻ります。</small></span><input type="checkbox" id="bgm-repeat" '+(state.playback.bgmRepeat?"checked":"")+'></label></div><div class="actions"><button class="btn primary" type="button" data-bgm-add-files '+(bgmLoading?"disabled":"")+'>音源ファイルを追加</button><span class="muted" id="bgm-library-status">'+(bgmLoading?"読み込み中…":bgmError||"登録 "+bgmTracks.length+" 曲")+'</span></div><div id="bgm-track-rows">'+(bgmRows||'<div class="empty">音源はまだ登録されていません。「音源ファイルを追加」からPC内の音楽ファイルを選択してください。</div>')+'</div><div class="muted">対応形式：MP3 / WAV / M4A / AAC / OGG / OGA / FLAC / OPUS / WMA（再生可否はWindows環境に依存）。音源はこのPCのアプリ専用フォルダーへコピーします。再生音はPCから出力されるため、配信に載せる場合はOBS等でデスクトップ音声を取り込んでください。</div>')+
(legacyPlaylistRows?panel("以前の曲名メモ","β23以前に登録した曲名です。音源ファイルではないため、再生するには上のBGMプレイヤーから音源を追加してください。",legacyPlaylistRows):"")+
'<div class="banner"><i class="led"></i><div><b>音源再生について</b><small>ローカルBGMはこのPCから再生されます。ニコ生へ直接送信する機能ではありません。配信に含めるにはOBS等でデスクトップ音声を取り込んでください。</small></div></div>';
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
html=hero("LIVE SESSION","放送・枠管理","放送映像を左側に表示し、NCV風のコメント一覧を右側に並べて確認できます。")+
'<div class="grid2">'+
panel("ニコニコアカウント接続","公式ログインを専用セッションで開く",'<div class="empty" id="auth-status"><b>'+authTitle+'</b><br>'+authText+'</div><div class="actions"><button class="btn primary" data-nico-login>公式ログインを開く</button><button class="btn" data-nico-refresh>状態を再確認</button><button class="btn" data-nico-logout>このアプリからログアウト</button></div>')+
panel("番組ページを確認","放送IDまたはニコ生番組URLを入力",'<div class="field"><label>放送ID / URL</label><input class="input" id="live-id" value="'+esc(state.lastProgramId||"")+'" placeholder="lv123456789 または放送URL" maxlength="512"></div><div class="actions"><button class="btn primary" data-nico-check>番組ページを確認</button></div><div class="empty" id="program-result">確認結果はここに表示します。</div>')+
panel("番組枠の作成・終了","作成後の自動番組開始と、開始・終了ボタンを利用できます。",'<div class="field"><label>番組タイトル</label><input class="input" id="create-program-title" maxlength="200" placeholder="例：配信タイトル"></div><div class="field"><label>番組説明</label><textarea class="input" id="create-program-description" maxlength="10000" rows="3" placeholder="番組の説明"></textarea></div><div class="grid2"><div class="field"><label>番組カテゴリ</label><input class="input" id="create-program-category" maxlength="100" value="一般" placeholder="例：一般"></div><div class="field"><label>タグ（カンマ区切り、最大10件）</label><input class="input" id="create-program-tags" maxlength="1000" placeholder="例：雑談, 生放送"></div></div><label class="switchrow"><span><b>会員限定で作成</b><small>OFFは一般公開の枠になります。合言葉・非公開枠は公式作成画面で設定してください。</small></span><input type="checkbox" id="create-program-member-only"></label><div class="actions"><button class="btn primary" data-create-program-in-app>アプリから番組を作成（実験的）</button><button class="btn" data-broadcast-create>公式番組作成画面を開く</button><button class="btn" data-broadcast-own-fetch>自分の最新番組を取得</button></div><div class="muted">番組作成APIは仕様変更の可能性があります。作成に失敗した場合は公式画面を使用してください。送信前に確認し、同じ内容の重複送信を防止します。</div><div class="field"><label>管理する放送ID</label><input class="input" id="broadcast-manage-id" value="'+esc(state.lastProgramId||"")+'" placeholder="lv123456789" maxlength="512"></div><div class="actions"><button class="btn" data-broadcast-verify>放送ID・状態を確認</button><button class="btn primary" data-program-start>▶ 番組開始</button><button class="btn danger" data-program-end>■ 番組終了</button><button class="btn" data-broadcast-manage disabled>番組管理画面を開く</button></div><div class="empty" id="broadcast-manage-result">確認結果は90秒間有効です。</div><label class="switchrow"><span><b>枠作成直後に番組開始を自動実行</b><small>新しい自分の番組だけが対象です。OBSや映像送出は別途必要です（実験的）。</small></span><input id="auto-start-program" type="checkbox" '+(state.automation.autoStartProgram?"checked":"")+'></label><div class="muted">番組開始・終了はログイン中の自分の番組だけを操作します。ニコニコのAPI仕様変更で操作できない場合があります。</div>')+
'</div>'+
'<div class="broadcast-live-layout">'+
'<section class="panel broadcast-video-panel"><div class="broadcast-panel-heading"><div><h2>放送画面</h2><p>ニコ生公式の視聴ページをアプリ内に表示します。</p></div><span class="live-state-pill" id="broadcast-live-status">未表示</span></div>'+
'<div class="field"><label>視聴する放送ID / URL</label><input class="input" id="broadcast-watch-id" value="'+esc(state.lastProgramId||commentConnection.programId||"")+'" placeholder="lv123456789" maxlength="512"></div>'+
'<div class="field"><label>ニコ生ページの表示倍率</label><select class="input" id="broadcast-video-zoom"><option value="auto" '+(state.liveVideoZoom.zoomMode==="auto"?"selected":"")+'>自動調整（表示領域に収める）</option>'+[40,50,60,70,80,90,100,110,125].map(value=>'<option value="'+value+'" '+(state.liveVideoZoom.zoomMode==="manual"&&state.liveVideoZoom.zoomPercent===value?"selected":"")+'>'+value+'%</option>').join("")+'</select><small class="muted">倍率は保存され、次回起動時にも適用されます。自動調整ではウィンドウサイズに合わせて再計算します。</small></div>'+'<div id="broadcast-video-slot" class="broadcast-video-slot"><div class="broadcast-video-placeholder"><b>放送映像はまだ表示されていません</b><span>放送IDを入力して「放送画面を表示」を押してください。</span></div></div>'+
'<div class="actions"><button class="btn primary" data-live-video-open>▶ 放送画面を表示</button><button class="btn" data-live-video-close '+(!liveVideoState.open?"disabled":"")+'>画面を閉じる</button><button class="btn" data-broadcast-comment-start '+(["connecting","connected","recovering"].includes(commentConnection.state)?"disabled":"")+'>コメント受信を開始</button><button class="btn danger" data-broadcast-comment-stop '+(!["connecting","connected","recovering"].includes(commentConnection.state)?"disabled":"")+'>コメント切断</button></div>'+
'<div class="muted" id="broadcast-live-message">'+esc(liveVideoState.message||"放送映像とコメント受信は個別に開始します。")+'</div></section>'+
'<section class="panel broadcast-comments-panel"><div class="broadcast-panel-heading"><div><h2>コメント一覧</h2><p>NCV風の一覧表示・投稿者別絞り込み</p></div><span class="live-state-pill" id="broadcast-comment-status">'+esc(commentConnection.state==="connected"?"接続済み":commentConnection.state==="connecting"?"接続中":commentConnection.state==="recovering"?"再接続中":"未接続")+'</span></div>'+
'<div class="broadcast-comment-toolbar"><input class="input" id="broadcast-comment-search" value="'+esc(broadcastCommentSearch)+'" placeholder="コメント・名前・ユーザーIDで検索"><select class="input" id="broadcast-comment-type"><option value="all" '+(broadcastCommentType==="all"?"selected":"")+'>すべて</option><option value="comment" '+(broadcastCommentType==="comment"?"selected":"")+'>通常コメント</option><option value="operatorComment" '+(broadcastCommentType==="operatorComment"?"selected":"")+'>放送者</option><option value="gift" '+(broadcastCommentType==="gift"?"selected":"")+'>ギフト</option><option value="emotion" '+(broadcastCommentType==="emotion"?"selected":"")+'>エモーション</option><option value="notification" '+(broadcastCommentType==="notification"?"selected":"")+'>通知</option></select></div>'+
'<div class="broadcast-comment-actions"><span id="broadcast-comment-count">0件</span><span id="broadcast-comment-user-filter">'+(broadcastCommentUserId?"ユーザーで絞り込み中":"全ユーザー")+'</span><button class="btn" data-broadcast-comment-clear-user '+(!broadcastCommentUserId?"disabled":"")+'>絞り込み解除</button><button class="btn" data-broadcast-comments-copy>表示分をコピー</button></div>'+
'<div id="broadcast-comments-list" class="ncv-comment-list"><div class="empty">コメント受信を開始すると、ここに一覧表示します。</div></div><div id="broadcast-comment-context" class="ncv-context-menu" hidden></div>'+
'<details class="ncv-display-settings"><summary>コメント表示をカスタマイズ（文字サイズ・列・並び順・色）</summary><div id="broadcast-comment-settings-controls"></div></details><div class="muted">コメント番号をクリックすると既読位置を記録、ダブルクリックで解除できます。投稿者名をクリックすると、そのユーザーのコメントだけを表示します。</div></section>'+
'</div>'+
panel("24時間放送監視","登録した番組ページをアプリ起動中に定期確認します。放送開始時は通知し、任意でコメント取得を自動開始します。",'<div class="row"><div><b>ログイン中の自分の放送を自動監視：常時ON</b><small>起動後すぐに監視開始。セッション切れでも再ログイン後に自動復帰します（約15秒間隔）。</small></div><button class="btn" type="button" data-own-monitor-check>今すぐ確認</button></div><div class="field"><label>登録する配信者のユーザーID・プロフィールURL（1行に1件、最大30人）</label><textarea class="input" id="stream-monitor-users" rows="3" placeholder="12345678\nhttps://www.nicovideo.jp/user/12345678">'+esc((state.streamMonitor.userIds||[]).join("\n"))+'</textarea></div><div class="field"><label>追加で監視する放送ID・公式番組URL（1行に1件、最大50件）</label><textarea class="input" id="stream-monitor-targets" rows="4" placeholder="lv123456789\nlv987654321">'+esc((state.streamMonitor.targets||[]).map(x=>x.programId).join("\n"))+'</textarea></div><div class="grid2"><div class="field"><label>確認間隔</label><select class="input" id="stream-monitor-interval"><option value="30" '+(state.streamMonitor.intervalSeconds===30?"selected":"")+'>30秒</option><option value="60" '+(state.streamMonitor.intervalSeconds===60?"selected":"")+'>1分</option><option value="120" '+(state.streamMonitor.intervalSeconds===120?"selected":"")+'>2分</option><option value="300" '+(state.streamMonitor.intervalSeconds===300?"selected":"")+'>5分</option></select></div><label class="switchrow"><span><b>放送開始時にコメント取得</b><small>受信コメントをPC内へ保存します。別番組を受信中は切り替えません。</small></span><input type="checkbox" id="stream-monitor-auto-comments" '+(state.streamMonitor.autoComments?"checked":"")+'></label></div><label class="switchrow"><span><b>新規放送を検知したら放送画面も自動表示</b><small>既に別の放送画面を表示している場合は自動切替しません。初期OFF。</small></span><input type="checkbox" id="stream-monitor-auto-video" '+(state.streamMonitor.autoVideo?"checked":"")+'></label><label class="switchrow"><span><b>登録配信者が放送開始したらWindows通知</b><small>アプリを最小化していても、新しい放送を初めて検知したとき通知します。初期OFF。アプリ起動中のみ。</small></span><input type="checkbox" id="stream-monitor-notify-live" '+(state.streamMonitor.notifyOnLive?"checked":"")+'></label><div class="actions"><button class="btn" type="button" data-stream-monitor-own-fetch>自分の番組を取得</button><button class="btn" type="button" data-stream-monitor-save>監視対象を保存</button><button class="btn primary" type="button" data-stream-monitor-start '+(state.streamMonitor.enabled?"disabled":"")+'>監視開始</button><button class="btn danger" type="button" data-stream-monitor-stop '+(!state.streamMonitor.enabled?"disabled":"")+'>監視停止</button><button class="btn" type="button" data-stream-monitor-check>今すぐ確認</button></div><div id="stream-monitor-status" class="section"></div><div class="muted">アカウント放送履歴は非公開APIに依存します。監視停止・対象変更時は処理中の古い確認結果を破棄します。監視はアプリが起動している間に動作します。PCのスリープ中・アプリ終了中は確認できません。登録ユーザーの監視はElectron本体で動作します。自動連携は放送IDの追加、任意のコメント受信・映像表示です。映像ファイルの自動録画は未実装です。</div>')+
'<div class="banner"><i class="led"></i><div><b>表示について</b><small>放送映像はニコニコ公式視聴ページを専用セッションで表示します。コメント一覧はこのアプリが受信したNDGRコメントを表示します。配信ページの仕様や視聴権限により映像が表示できない場合があります。</small></div></div>';
}else if(page==="voice"){
const speechAvailable=!!(window.speechSynthesis&&typeof window.SpeechSynthesisUtterance==="function");
const mutedSpeechRows=(state.voice.mutedUserIds||[]).map(userId=>{
const profile=findUserProfile(userId);
return '<div class="row"><div><b>'+esc(profile?.nickname||userId)+'</b><small>'+esc(userId)+'</small></div><button class="btn" data-voice-unmute-user="'+esc(userId)+'">読み上げを許可</button></div>';
}).join("");

html=hero("VOICE & AUTO RESPONSE","音声・自動応答","コメント読み上げをローカル音声合成で行います。読み上げは初期状態OFFで、NGワード・過去コメントは対象外です。")+
panel("コメント読み上げ","Windows／Chromiumにインストールされた日本語音声を使用します。",'<form id="voice-settings-form"><label class="switchrow"><span><b>コメント読み上げを有効にする</b><small>通常コメントを受信した順に読み上げます。初期状態はOFFです。</small></span><input type="checkbox" id="voice-enabled" '+(state.voice.enabled?"checked":"")+'></label><label class="switchrow"><span><b>読み上げにコテハンを含める</b><small>登録済みコテハン、未登録ならニコニコ表示名を読み上げます。</small></span><input type="checkbox" id="voice-include-name" '+(state.voice.includeName?"checked":"")+'></label><label class="switchrow"><span><b>放送者コメントも読み上げる</b><small>通常コメントとは別に、放送者コメントを読み上げ対象にします。</small></span><input type="checkbox" id="voice-speak-operator" '+(state.voice.speakOperator?"checked":"")+'></label><div class="field"><label>音声</label><select class="input" id="voice-uri"><option value="">システム標準の日本語音声</option></select><small class="muted" id="voice-engine-status">'+(speechAvailable?"利用可能な音声を確認しています…":"この環境では音声合成APIを利用できません。")+'</small></div><div class="grid3"><div class="field"><label>読み上げ速度（0.5〜2）</label><input class="input" id="voice-rate" type="number" min="0.5" max="2" step="0.1" value="'+Number(state.voice.rate||1)+'"></div><div class="field"><label>声の高さ（0〜2）</label><input class="input" id="voice-pitch" type="number" min="0" max="2" step="0.1" value="'+Number(state.voice.pitch??1)+'"></div><div class="field"><label>音量（0〜1）</label><input class="input" id="voice-volume" type="number" min="0" max="1" step="0.1" value="'+Number(state.voice.volume??1)+'"></div></div><div class="actions"><button class="btn primary" type="submit">読み上げ設定を保存</button><button class="btn" type="button" data-voice-test '+(!speechAvailable?"disabled":"")+'>テスト読み上げ</button><button class="btn" type="button" data-voice-pause '+(!speechAvailable?"disabled":"")+'>一時停止</button><button class="btn" type="button" data-voice-resume '+(!speechAvailable?"disabled":"")+'>再開</button><button class="btn" type="button" data-voice-clear>停止・待ち行列クリア</button></div><div class="muted" id="voice-queue-status">待ち行列：'+speechQueue.length+' 件</div><div id="voice-queue-preview" class="queue-preview"></div></form>')+
panel("個別ユーザーの読み上げ設定","特定ユーザーのコメントを読み上げ対象から除外できます。除外すると、その人の待ち行列内コメントも削除され、読み上げ中なら停止します。コメント欄からも切り替えできます。",'<div class="row"><b>除外中のユーザー</b><span>'+state.voice.mutedUserIds.length+' 人</span></div>'+(mutedSpeechRows||'<div class="empty">個別除外ユーザーは登録されていません。</div>')+'<div class="actions"><button class="btn" type="button" data-voice-clear-muted '+(!state.voice.mutedUserIds.length?"disabled":"")+'>個別除外をすべて解除</button></div><div class="muted">この設定はこのPC内に保存され、NGユーザー設定とは独立しています。解除後に受信したコメントから読み上げを再開します。</div>');
}else if(page==="remote"){
html=hero("SECURE REMOTE CONTROL","リモート操作","ペアリングしたブラウザーから、状態確認・コメント閲覧・動画プレビュー・BGMを操作します。")+
 panel("サーバー設定","初期状態は停止です。localhost HTTPと、証明書を使うLAN HTTPSを別々に明示起動します。",'<div class="row"><b>状態</b><span id="remote-server-state">停止中</span></div><div class="grid2"><div class="field"><label>ポート（1024〜65535）</label><input class="input" id="remote-port" type="number" min="1024" max="65535" value="'+(remoteControlUi.status.port||18240)+'"></div><div class="field"><label>接続URL</label><div class="remote-url" id="remote-server-url">サーバーを起動するとURLを表示します。</div></div></div><div class="actions"><button class="btn primary" type="button" data-remote-start>localhost HTTPで起動</button><button class="btn" type="button" data-remote-copy-url disabled>接続URLをコピー</button><button class="btn" type="button" data-remote-stop '+(!remoteControlUi.status.running?"disabled":"")+'>サーバーを停止</button><button class="btn" type="button" data-remote-open-controller '+(!remoteControlUi.status.running?"disabled":"")+'>このPCのブラウザーで開く</button><button class="btn" type="button" data-remote-refresh>状態を更新</button></div><div class="muted" id="remote-storage-message"></div><div class="muted" id="remote-control-error">'+esc(remoteControlUi.error||"")+'</div>')+
 panel("LAN接続（HTTPS）","同じLAN内のスマートフォン等から接続する場合だけ使用します。選択したIPv4アドレスだけで待ち受けます。",'<label class="switchrow"><span><b>LAN接続を有効にする</b><small>チェック・専用起動ボタン・確認ダイアログが必要です。</small></span><input type="checkbox" id="remote-lan-enable"></label><div class="field"><label>待ち受けるLAN IPv4アドレス</label><select class="input" id="remote-lan-address">'+(remoteControlUi.lanOptions.addresses.map(item=>'<option value="'+esc(item.address)+'">'+esc(item.address+" / "+item.interfaceName)+'</option>').join("")||'<option value="">利用可能なLAN IPv4がありません</option>')+'</select></div><div class="grid2"><div class="field"><label>TLS証明書ファイル</label><div class="muted" id="remote-tls-certificate-label">'+esc(remoteControlUi.lanOptions.certificateName||"未選択")+'</div><button class="btn" type="button" data-remote-choose-cert>証明書を選択</button></div><div class="field"><label>TLS秘密鍵ファイル（未暗号化PEM）</label><div class="muted" id="remote-tls-key-label">'+esc(remoteControlUi.lanOptions.privateKeyName||"未選択")+'</div><button class="btn" type="button" data-remote-choose-key>秘密鍵を選択</button></div></div><div class="actions"><button class="btn primary" type="button" data-remote-start-lan '+(!remoteControlUi.lanOptions.addresses.length||!remoteControlUi.lanOptions.certificateName||!remoteControlUi.lanOptions.privateKeyName?"disabled":"")+'>HTTPSでLANサーバーを起動</button><button class="btn" type="button" data-remote-refresh-lan>ネットワーク情報を更新</button></div><div class="muted">証明書は選択したIPアドレスをSANに含み、有効期間内で、接続端末が信頼する認証局から発行されている必要があります。単なる自己署名証明書ではブラウザーに警告が出て通信に失敗する場合があります。秘密鍵のパスはメインプロセス内だけで保持し、アプリ終了後は再選択が必要です。</div>')+
panel("端末ペアリング","操作を許可する端末にだけワンタイムコードを渡してください。コードの有効期限は5分、試行は最大5回です。",'<div class="remote-permissions"><label><input type="checkbox" checked disabled> 状態閲覧（必須）</label><label><input type="checkbox" data-remote-permission="comments:read" checked> コメント閲覧</label><label><input type="checkbox" data-remote-permission="player:control"> 動画プレビュー操作</label><label><input type="checkbox" data-remote-permission="bgm:control"> BGM操作</label></div><div class="actions"><button class="btn primary" type="button" data-remote-pair-create '+(!remoteControlUi.status.running?"disabled":"")+'>ワンタイムコードを発行</button></div><div class="remote-pairing-code" id="remote-pairing-code">'+esc(remoteControlUi.pairingCode||"未発行")+'</div><div class="actions"><button class="btn" type="button" data-remote-copy-code '+(!remoteControlUi.pairingCode?"disabled":"")+'>コードをコピー</button></div><div class="muted" id="remote-pairing-expiry">ペアリングコードは5分間有効です。</div><div class="muted">コードをブラウザーコントローラーの画面に入力すると端末が登録されます。認証トークンは登録時に一度だけ返し、PC内にはハッシュのみ保存します。</div>')+
panel("登録済み端末","登録は最大20台。不要になった端末は失効してください。失効後は同じトークンで再接続できません。",'<div class="row"><b>登録端末</b><span id="remote-device-count">0台</span></div><div id="remote-device-rows" class="remote-device-list"><div class="empty">登録端末はありません。</div></div>')+
'<div class="banner"><i class="led"></i><div><b>接続範囲の制限</b><small>localhostモードは同じPC内のみ。LANモードは選択したIPv4にバインドし、有効なHTTPS証明書・秘密鍵と明示的な有効化が必要です。ルーターのポート開放やインターネットへの公開には対応しません。</small></div></div>';
 }else if(page==="audit"){
html=hero("REMOTE AUDIT","リモート監査ログ","接続拒否・認証失敗・レート制限・ペアリング・操作結果を確認し、CSVへ出力します。")+
panel("監査ログ検索","再起動後も保存履歴を復元し、直近500件を表示します。",'<div class="switchrow"><div><b>異常アクセスのWindows通知</b><small>しきい値を超えた異常アクセスをデスクトップへ通知します。</small></div><input type="checkbox" id="remote-audit-notification-enabled"></div><div class="grid2"><div class="field"><label>キーワード</label><input class="input" id="remote-audit-query" placeholder="IP・API・操作名"></div><div class="field"><label>イベント種別</label><select class="input" id="remote-audit-type"><option value="all">すべて</option>'+["peer_rejected","host_rejected","origin_rejected","cross_site_rejected","ip_rate_limited","pair_rate_limited","pair_succeeded","pair_failed","auth_failed","device_rate_limited","command_succeeded","command_failed","security_anomaly"].map(x=>'<option value="'+x+'">'+x+'</option>').join("")+'</select></div></div><div class="grid2"><div class="field"><label>開始日</label><input class="input" type="date" id="remote-audit-from"></div><div class="field"><label>終了日</label><input class="input" type="date" id="remote-audit-to"></div></div><div class="actions"><button class="btn" type="button" data-remote-audit-refresh>更新</button><button class="btn primary" type="button" data-remote-audit-export>CSV書き出し</button><button class="btn danger" type="button" data-remote-audit-clear>全消去</button><span id="remote-audit-count" class="muted">0件</span></div><div class="muted">Bearerトークン・ペアリングコード・コメント本文は監査ログに含めません。</div><div id="remote-audit-rows" class="remote-device-list"><div class="empty">読み込み中…</div></div>');
}else if(page==="logs"){
html=hero("ACTIVITY & BACKUP","履歴・バックアップ","設定データのJSON書き出し・読み込み。")+
panel("システムログ","操作履歴",state.logs.map(x=>`<div class="row"><i></i><b>${esc(x)}</b></div>`).join("")+'<div class="actions"><button class="btn primary" data-export>設定JSONを書き出す</button><button class="btn" data-clear-logs>ログを消去</button></div>');
}else if(page==="changelog"){
html=hero("VERSION HISTORY","バージョン更新履歴","各バージョンで追加・変更した機能や修正内容を掲載しています。")+
panel("公開バージョン一覧","GitHub Releasesの実際のリリースノートを新しい順に表示します。詳細情報のない版はその旨を表示します。",'<div class="grid2"><div class="field"><label>バージョン・追加機能・修正内容で検索</label><input class="input" id="release-history-search" placeholder="例：alpha.65 / 自動更新" value="'+esc(releaseHistoryState.query)+'"></div><div class="field"><label>公開区分</label><select class="input" id="release-history-type"><option value="all" '+(releaseHistoryState.type==="all"?"selected":"")+'>すべて</option><option value="alpha" '+(releaseHistoryState.type==="alpha"?"selected":"")+'>α開発版</option><option value="beta" '+(releaseHistoryState.type==="beta"?"selected":"")+'>βテスト版</option><option value="stable" '+(releaseHistoryState.type==="stable"?"selected":"")+'>製品版</option></select></div></div><div class="actions"><button class="btn" data-release-history-refresh>最新の履歴を再取得</button><button class="btn" data-update-open-releases>GitHub Releases一覧</button></div><div class="muted" id="release-history-status"></div><div class="release-history-list" id="release-history-list"></div><div class="actions"><button class="btn primary" data-release-history-more>過去のバージョンをさらに表示</button></div>');
}else{
html=hero("APPLICATION SETTINGS","設定","アプリのバージョンとローカル設定を管理します。")+
panel("自動更新・アップデート確認","Windows Setup版は利用中のα・β・製品版に合わせて更新を自動ダウンロードします。Portable版は最新のSetup版へ切り替えてください。",'<div class="row"><div><b>現在のバージョン</b><small>このアプリにインストールされているバージョン</small></div><span>'+esc(window.kananeoApp.version)+'</span></div><div class="row"><b>自動更新</b><span id="auto-update-status">確認中</span></div><div id="auto-update-details" class="muted"></div><div class="row"><b>確認状態</b><span id="update-check-status">未確認</span></div><div id="update-release-details"></div><div class="actions"><button class="btn primary" type="button" data-update-auto-check>自動更新を再確認</button><button class="btn primary" type="button" data-update-auto-apply hidden>更新を適用して再起動</button><button class="btn" type="button" data-update-diagnostic-copy>更新診断をコピー</button><button class="btn" type="button" data-update-check>公開版を確認</button><button class="btn" type="button" data-update-open-releases>GitHub Releasesを開く</button><button class="btn" type="button" data-go="changelog">バージョン更新履歴を見る</button></div>')+
panel("バージョン情報","kananeo nico live stream",'<div class="row"><b>Version</b><span>'+esc(window.kananeoApp.version)+'</span></div><div class="row"><b>Runtime</b><span>Electron 45.2.3</span></div><div class="row"><b>Status</b><span>Alpha（開発版） / localhost・LAN リモート対応</span></div>');
}
if(page==="dashboard"){
 html+='<div class="banner" id="dashboard-alpha-update" hidden><i class="led"></i><div><b id="dashboard-alpha-update-title"></b><small id="dashboard-alpha-update-detail"></small></div><button type="button" data-go="settings">更新の詳細</button></div>';
}
if(page==="dashboard"&&updateCheckState.result?.updateAvailable&&!document.getElementById("in-app-update-notice")){
const latest=updateCheckState.result.latestVersion||"新しい版";
html+='<div class="banner"><i class="led"></i><div><b>アップデートがあります：'+esc(latest)+'</b><small>新しいバージョンがGitHub Releasesで公開されています。内容を確認してください。</small></div><button type="button" data-go="settings">詳細を確認 →</button><button type="button" data-update-open-releases>配布ページ</button></div>';
}
if(page==="library"){
const sources=[...new Set(["manual",...videoLibraryData.items.map(item=>item.source).filter(Boolean)])].sort();
const options=sources.map(source=>'<option value="'+esc(source)+'" '+(librarySource===source?"selected":"")+'>'+esc(librarySourceLabel(source))+'</option>').join("");
html=html.replace('<div class="section"><p id="library-count">','<div class="field"><label>取り込み元で絞り込み</label><select class="input" id="library-source"><option value="">すべて</option>'+options+'</select></div><div class="section"><p id="library-count">');
}
document.getElementById("content").innerHTML=html;
renderInAppUpdateNotice();
if(page==="dashboard")renderDashboardAlphaUpdateStatus();
if(page==="broadcast"){renderBroadcastManageVerification();renderBroadcastCommentSettingsControls();renderBroadcastComments();updateBroadcastLivePanel();renderStreamMonitorUi();}
updateLiveVideoBounds();
if(page==="voice"){renderSpeechVoices();updateSpeechQueueUi();}
if(page==="settings"){renderUpdateCheck();renderAutoUpdateStatus();}
if(page==="changelog")renderReleaseHistoryRows();
if(page==="remote")updateRemoteControlUi();
if(page==="audit")void refreshRemoteAudit();
if(page==="library")renderLibrarySourcePreview();
if(page==="users")renderUserProfileRows();
}
async function refreshVideoLibrary(silent=false){
if(videoLibraryLoading)return;
videoLibraryLoading=true;videoLibraryError="";
if(page==="library")render();
try{
const result=await window.kananeoApp.videoLibrary.get();
if(!result?.ok)throw new Error(result?.message||"動画ライブラリを読み込めませんでした。");
videoLibraryData=result.library||{version:1,items:[],history:[],updatedAt:""};
}catch(error){videoLibraryError=error?.message||"動画ライブラリを読み込めませんでした。";if(!silent)toast(videoLibraryError);}
finally{videoLibraryLoading=false;if(page==="library"){render();renderVideoLibraryRows();}}
}
function librarySourceLabel(source){
return ({manual:"手動登録","watch-later":"あとで見る",mylist:"マイリスト",series:"シリーズ",text:"テキスト取り込み",json:"JSON取り込み"}[source]||source||"不明");
}
function getFilteredLibrarySourceEntries(){
const query=String(librarySourceQuery||"").trim().toLocaleLowerCase("ja-JP");
if(!query)return librarySourceEntries;
return librarySourceEntries.filter(item=>[item.title,item.videoId].join(" ").toLocaleLowerCase("ja-JP").includes(query));
}
function renderLibrarySourcePreview(){
const host=document.getElementById("library-source-preview");
if(!host)return;
const activeSearch=document.activeElement?.id==="library-source-search";
const caret=activeSearch?document.activeElement.selectionStart:null;
if(librarySourceLoading){host.innerHTML='<div class="empty">ニコニコから動画一覧を取得しています…</div>';return;}
if(!librarySourceEntries.length){host.innerHTML='<div class="empty">取り込み元を選んで「一覧を表示して選択」を押してください。</div>';return;}
const sourceName=librarySourceType==="watch-later"?"あとで見る":librarySourceType==="mylist"?"マイリスト":"シリーズ";
const visibleEntries=getFilteredLibrarySourceEntries();
const selectedCount=librarySourceSelected.size;
const limitNote=librarySourceLimited?'<div class="muted">一覧の続きがあります。現在は取得できた先頭'+librarySourceEntries.length.toLocaleString("ja-JP")+'件を表示しています（取得上限1,000件）。</div>':"";
const rows=visibleEntries.map(item=>{
const index=librarySourceEntries.indexOf(item)+1;
const checked=librarySourceSelected.has(item.videoId)?"checked":"";
return '<tr><td><input type="checkbox" data-library-source-check="'+esc(item.videoId)+'" '+checked+'></td><td>'+index+'</td><td><b>'+esc(item.title)+'</b><div class="muted">'+esc(item.videoId)+'</div></td><td>'+(item.lengthMs?formatVideoTime(item.lengthMs/1000):"—")+'</td></tr>';
}).join("");
host.className="";
host.innerHTML='<div class="row"><b>'+esc(librarySourceTitle||sourceName)+' / '+sourceName+'</b><span>'+visibleEntries.length.toLocaleString("ja-JP")+' / '+librarySourceEntries.length.toLocaleString("ja-JP")+' 件表示</span></div>'+limitNote+'<div class="field"><label>一覧内を検索（タイトル・動画ID）</label><input class="input" id="library-source-search" value="'+esc(librarySourceQuery)+'" placeholder="動画タイトル・IDで絞り込み"></div><div class="actions"><button class="btn" type="button" data-library-source-all>表示中をすべて選択</button><button class="btn" type="button" data-library-source-none>選択解除</button><button class="btn primary" type="button" data-library-source-import '+(!selectedCount?"disabled":"")+'>選択した '+selectedCount+' 件を取り込む</button></div><div class="muted" id="library-source-selection-count">'+selectedCount+' 件を選択中（一覧全体）</div>'+(rows?'<div style="overflow-x:auto;max-height:520px"><table class="table"><thead><tr><th>選択</th><th>#</th><th>動画</th><th>時間</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">検索条件に一致する動画はありません。</div>');
if(activeSearch){
const input=host.querySelector("#library-source-search");
if(input){input.focus();if(Number.isInteger(caret))input.setSelectionRange(caret,caret);}
}
}
async function recordVideoPlaybackHistory(item,queueType="library",playbackType="preview"){
if(!item?.videoId||!window.kananeoApp?.videoLibrary)return;
try{
const result=await window.kananeoApp.videoLibrary.recordPlayback({
videoId:item.videoId,url:item.url,title:item.title,lengthMs:item.lengthMs||0,
queueType:["request","stock","library"].includes(queueType)?queueType:"library",
playbackType:playbackType==="quotation"?"quotation":"preview"
});
if(result?.ok){videoLibraryData=result.library;if(page==="library"){render();renderVideoLibraryRows();}}
}catch{}
}
function renderVideoLibraryRows(){
const body=document.getElementById("library-items-body");
const count=document.getElementById("library-count");
const empty=document.getElementById("library-empty");
if(!body)return;
const query=String(document.getElementById("library-search")?.value??librarySearch).trim().toLocaleLowerCase("ja-JP");
const source=String(document.getElementById("library-source")?.value??librarySource);
librarySearch=query;
librarySource=source;
const rows=videoLibraryData.items.filter(item=>{
if(source&&item.source!==source)return false;
if(!query)return true;
return [item.videoId,item.title,item.memo,...(item.tags||[])].join(" ").toLocaleLowerCase("ja-JP").includes(query);
});
rows.sort((a,b)=>librarySort==="oldest"?Date.parse(a.createdAt)-Date.parse(b.createdAt):librarySort==="played"?(Number(b.playCount||0)-Number(a.playCount||0))||Date.parse(b.updatedAt)-Date.parse(a.updatedAt):Date.parse(b.createdAt)-Date.parse(a.createdAt));
if(count)count.textContent=rows.length+" 件";
if(empty)empty.textContent=rows.length?"":videoLibraryLoading?"読み込み中です…":"該当する動画はありません。";
body.innerHTML=rows.slice(0,1000).map(item=>{
const row='<tr><td><b>'+esc(item.title)+'</b><div class="muted">'+esc(item.videoId)+(item.tags?.length?" / "+item.tags.map(esc).join(", "):"")+'</div>'+(item.memo?'<div class="muted">'+esc(item.memo)+'</div>':"")+'<div class="muted">取り込み元：'+esc(librarySourceLabel(item.source))+'</div></td><td>'+(item.lengthMs?formatVideoTime(item.lengthMs/1000):"—")+'</td><td>'+Number(item.playCount||0).toLocaleString("ja-JP")+'</td><td>'+new Date(item.createdAt).toLocaleDateString("ja-JP")+'</td><td><button class="btn primary" data-library-play="'+esc(item.videoId)+'">プレビュー</button> <button class="btn" data-library-edit="'+esc(item.videoId)+'">編集</button> <button class="btn" data-library-delete="'+esc(item.videoId)+'">削除</button></td></tr>';
if(libraryEditId!==item.videoId)return row;
return row+'<tr><td colspan="5"><form id="library-edit-form" data-video-id="'+esc(item.videoId)+'" class="grid2"><div class="field"><label>動画タイトル</label><input class="input" id="library-edit-title" maxlength="200" value="'+esc(item.title)+'"></div><div class="field"><label>タグ（カンマ区切り・最大30個）</label><input class="input" id="library-edit-tags" maxlength="1200" value="'+esc((item.tags||[]).join(", "))+'"></div><div class="field"><label>メモ（最大1,000文字）</label><textarea class="input" id="library-edit-memo" rows="3" maxlength="1000">'+esc(item.memo||"")+'</textarea></div><div class="actions"><button class="btn primary" type="submit">変更を保存</button><button class="btn" type="button" data-library-edit-cancel>キャンセル</button></div></form></td></tr>';
}).join("");
}
async function playLibraryVideo(videoId){
const item=videoLibraryData.items.find(entry=>entry.videoId===videoId);
if(!item)return;
try{
const result=await window.kananeoApp.niconico.openVideo(item.url);
if(!result?.ok){toast(result?.message||"動画を開けませんでした。");return;}
state.player.status="loading";state.player.currentId="";state.player.currentQueueType="library";save();
void recordVideoPlaybackHistory(item,"library","preview");
toast(result.message||"プレビューを開きました。");
}catch{toast("プレビューを起動できませんでした。");}
}
function exportVideoLibrary(){
const blob=new Blob([JSON.stringify(videoLibraryData,null,2)],{type:"application/json"});
const url=URL.createObjectURL(blob);
const a=document.createElement("a");a.href=url;a.download="kananeo-video-library-"+new Date().toISOString().slice(0,10)+".json";a.click();
URL.revokeObjectURL(url);
toast("動画ライブラリをJSON形式で保存しました。");
}
function formatVideoTime(value){
const seconds=Math.max(0,Math.floor(Number(value)||0));
const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;
return h?String(h)+":"+String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"):String(m)+":"+String(sec).padStart(2,"0");
}
function currentQueueList(){return state.player.currentQueueType==="stock"?state.stocks:state.requests;}
function currentQueueItem(){
 return currentQueueList().find(x=>x.id===state.player.currentId)||
  state.requests.find(x=>x.id===state.player.currentId)||
  state.stocks.find(x=>x.id===state.player.currentId)||
  (quotePlayback.active&&quotePlayback.item?.id===state.player.currentId?quotePlayback.item:null);
}
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
function activeQuotedQueueItem(){
 const activeVideoId=String(quotePlayback.videoId||"").toLowerCase();
 // Played videos leave pending queues. Keep their current runtime snapshot
 // for video length, poll timing, stock autoplay policy, and now-playing UI.
 if(quotePlayback.active&&quotePlayback.item&&
    String(quotePlayback.item.videoId||"").toLowerCase()===activeVideoId)
  return quotePlayback.item;
 return window.KananeoQuoteTiming.findQuotedItem(activeVideoId,state.requests,state.stocks);
}
function storedQuoteDurationMs(item){
const itemValue=Number(item?.lengthMs??item?.durationMs??0);
if(Number.isFinite(itemValue)&&itemValue>0)return itemValue;
// Never use the previous quoted video's duration for a different video.
const id=String(item?.videoId||item?.video_id||quotePlayback.videoId||"").toLowerCase();
const storedId=String(state.player.quoteVideoId||"").toLowerCase();
const storedValue=Number(state.player.quoteDurationMs||0);
return id&&id===storedId&&Number.isFinite(storedValue)&&storedValue>0?storedValue:0;
}
function scheduleQuoteAutoNext(item,startedAt=Date.now(),options={}){
if(pollRuntime.active||state.player.quotePollAutoSuspended){
 quoteAutoMessage="アンケート処理中・結果未確認のため自動次動画を保留しています。";
 updateQuoteScheduleUi();return false;
}
if(options.clearExisting!==false)clearQuoteAutoTimer();
const durationMs=storedQuoteDurationMs(item);
const start=Number(startedAt)||Date.now();
state.player.quoteStartedAt=start;
state.player.quoteDurationMs=durationMs;
state.player.quoteVideoId=String(item?.videoId||item?.video_id||quotePlayback.videoId||"");
state.player.quoteProgramId=String(quotePlayback.programId||state.lastProgramId||"");
state.player.quoteExpectedEndAt=0;
if(!state.playback.quoteAutoNext||(quotePlayback.queueType==="stock"&&!state.playback.stockAutoPlay)){
quoteAutoMessage=quotePlayback.queueType==="stock"?"ストックの自動再生はOFFです。":"引用再生の自動次動画はOFFです。";
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
if(token!==quoteAutoToken||!state.playback.quoteAutoNext||quotePlayback.programId!==programId)return;
const advanced=await playNextQuoteItem({skipConfirmation:true,triggeredByAuto:true,programId});
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
const programId=(quotePlayback.active?quotePlayback.programId:state.lastProgramId)||state.lastProgramId||quotePlayback.programId;
if(!programId){if(!silent)toast("先に「放送・枠管理」で番組IDを確認してください。");return {ok:false};}
const result=await window.kananeoApp.niconico.getCurrentQuotation({programId});
if(!result?.ok){
quotePlayback={...quotePlayback,message:result?.message||"引用再生状態を取得できませんでした。"};
if(!silent)toast(quotePlayback.message);
if(page==="player")render();
return result;
}
const previousItemId=quotePlayback.itemId;
const previousQuote=quotePlayback;
const normalizedVideoId=String(result.currentVideoId||"").toLowerCase();
// Prefer the exact quotation this app started; otherwise a duplicate queued
// video ID could accidentally replace the current playback record.
const retained=result.exists&&previousQuote.active&&previousQuote.programId===programId&&
 String(previousQuote.videoId||"").toLowerCase()===normalizedVideoId&&
 String(previousQuote.item?.videoId||"").toLowerCase()===normalizedVideoId?
 previousQuote.item:null;
const matchedInQueue=result.exists?[...state.requests,...state.stocks].find(item=>
 String(item.videoId||"").toLowerCase()===normalizedVideoId):null;
const matched=retained||matchedInQueue;
const retainedQueueType=retained?previousQuote.queueType:"";
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
// A delayed positive read confirms an earlier accepted quotation. Remove only
// its own pending queue entry, never an unrelated entry or just-previewed item.
if(retained){
 const retired=window.KananeoQuoteQueue.retireVerifiedQuote(state,retainedQueueType,retained,{
  ok:true,verified:true,currentVideoId:normalizedVideoId
 });
 if(retired.removed)state.logs.unshift("引用再生を確認してキューから自動削除："+String(retained.title||normalizedVideoId));
}
quotePlayback={active:!!result.exists,verified:true,programId,videoId:result.currentVideoId||"",
 queueType:retained?retainedQueueType:matchedInQueue?(state.stocks.includes(matchedInQueue)?"stock":"request"):"",
 itemId:matched?.id||"",item:retained||null,
 message:result.exists?"ニコ生の引用再生状態を確認しました。":"現在、引用再生は行われていません。"};
if(matched){state.player.currentId=matched.id;state.player.currentQueueType=quotePlayback.queueType;}
if(!result.exists){
 if(state.player.currentId===previousItemId)state.player.currentId="";
 clearQuoteAutoTimer("ニコ生の引用再生は停止しています。");
 state.player.quoteStartedAt=0;
 state.player.quoteDurationMs=0;
 state.player.quoteVideoId="";
 state.player.quoteProgramId="";
 state.player.quoteExpectedEndAt=0;
}else{
 const timingContext={
  programId,videoId:result.currentVideoId,storedProgramId:state.player.quoteProgramId,
  storedVideoId:state.player.quoteVideoId,startedAt:state.player.quoteStartedAt,
  durationMs:state.player.quoteDurationMs
 };
 const trusted=window.KananeoQuoteTiming.trustedQuoteTiming(timingContext);
 if(trusted){
  if(!pollRuntime.active) {
   const scheduleItem={videoId:result.currentVideoId,lengthMs:Number(state.player.quoteDurationMs)};
   scheduleQuoteAutoNext(scheduleItem,Number(state.player.quoteStartedAt));
  }
 }else if(window.KananeoQuoteTiming.trustedQuoteStart(timingContext)&&
           Number(state.player.quoteDurationMs)<=0){
  // The app really started this exact quotation, but its duration is still
  // missing. Preserve the start time so a later metadata response can repair it.
  state.player.quoteExpectedEndAt=0;
  clearQuoteAutoTimer("引用再生の開始時刻を保持し、動画の長さを取得しています。");
  void ensureCurrentQuoteDuration();
 }else{
  // Never inherit an earlier video's timestamp, even when it exists in the queue.
  state.player.quoteStartedAt=0;
  state.player.quoteDurationMs=0;
  state.player.quoteVideoId=result.currentVideoId||"";
  state.player.quoteProgramId=programId;
  state.player.quoteExpectedEndAt=0;
  clearQuoteAutoTimer("引用再生中ですが正確な再生開始時刻を確認できません。自動アンケートは保留します。");
 }
}
save();
if(page==="player")render();
updateQuoteScheduleUi();
return result;
}
async function confirmStartedQuoteForQueue(programId,videoId,itemId){
 // Some successfully accepted quote mutations are not immediately reflected
 // in getCurrentQuotation. Retry read-only verification without risking
 // deletion of a still-unplayed request or stock entry.
 for(let attempt=0;attempt<3;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1500));
  if(!quotePlayback.active||quotePlayback.programId!==programId||
     String(quotePlayback.videoId||"").toLowerCase()!==String(videoId||"").toLowerCase()||
     quotePlayback.itemId!==itemId||!quotePlayback.item)return;
  let observed=null;
  try{observed=await window.kananeoApp.niconico.getCurrentQuotation({programId});}
  catch{}
  if(!quotePlayback.active||quotePlayback.programId!==programId||
     String(quotePlayback.videoId||"").toLowerCase()!==String(videoId||"").toLowerCase()||
     quotePlayback.itemId!==itemId||!quotePlayback.item)return;
  if(observed?.ok&&observed.exists&&
     String(observed.currentVideoId||"").toLowerCase()===String(videoId||"").toLowerCase()){
   const retired=window.KananeoQuoteQueue.retireVerifiedQuote(
    state,quotePlayback.queueType,quotePlayback.item,
    {ok:true,verified:true,currentVideoId:videoId});
   quotePlayback.verified=true;
   if(retired.removed){
    state.logs.unshift("引用再生を確認してキューから自動削除："+String(quotePlayback.item.title||videoId));
    save();
    if(page==="requests"||page==="stocks"||page==="player")render();
   }
   return;
  }
 }
}
async function playQuotedQueueItem(item,queueType="request",skipConfirmation=false,options={}){
if(!item)return false;
const programId=options.programId||state.lastProgramId||commentConnection.programId;
if(!programId){toast("先に「放送・枠管理」で配信中の放送IDを確認してください。");return false;}
const ok=skipConfirmation||confirm("ニコ生の放送へ「"+item.title+"」を引用再生します。\\n\\n視聴者に動画が流れます。放送主権限が必要です。実行しますか？");
if(!ok)return false;
try{
const validation=await window.kananeoApp.niconico.validateVideo(item.videoId||item.url);
if(!validation?.ok){toast(validation?.message||"引用再生できる動画IDではありません。");return false;}
if(options.autoLive){
 if(!state.playback.autoPlayOnOwnLive||state.playback.lastAutoPlayProgramId!==programId||
    (quotePlayback.active&&quotePlayback.programId===programId))return false;
 const checked=await window.kananeoApp.niconico.getCurrentQuotation({programId});
 if(!checked?.ok||checked.exists)return false;
}
const result=await window.kananeoApp.niconico.playQuotedVideo({
programId,videoId:validation.videoId,confirmed:true,
mainVolume:state.playback.mainVolume,subVolume:state.playback.subVolume
});
if(!result?.ok){toast(result?.message||"引用再生に失敗しました。");return false;}
void recordVideoPlaybackHistory(item,queueType,"quotation");
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
state.player.quotePollAutoSuspended=false;
const startedAt=Date.now();
state.player.quoteStartedAt=startedAt;
state.player.quoteDurationMs=storedQuoteDurationMs(item);
state.player.quoteVideoId=validation.videoId;
state.player.quoteExpectedEndAt=state.player.quoteDurationMs>0?startedAt+state.player.quoteDurationMs+Number(state.playback.nextIntervalSeconds||0)*1000:0;
quotePlayback={active:true,verified:!!result.verified,programId,videoId:result.videoId||validation.videoId,
 queueType,itemId:item.id,item,message:result.message};
quoteMetadataMessage="";
state.logs.unshift("ニコ生へ引用再生："+item.title);
// API acceptance alone is not playback confirmation. Retire this one queue
// entry only after verifying the live now quotes the expected video.
if(result.verified===true){
 const retired=window.KananeoQuoteQueue.retireVerifiedQuote(state,queueType,item,{
  ok:true,verified:true,currentVideoId:result.currentVideoId
 });
 if(retired.removed)state.logs.unshift("引用再生開始を確認してキューから自動削除："+item.title);
}else{
 void confirmStartedQuoteForQueue(programId,validation.videoId,item.id);
}
scheduleQuoteAutoNext(item,startedAt);
scheduleAutoPollOnQuote(programId,validation.videoId,startedAt);
if(storedQuoteDurationMs(item)<=0)void ensureCurrentQuoteDuration();
save();
if(page==="requests"||page==="stocks"||page==="player")render();
toast(result.message||"引用再生の要求を送信しました。");
return true;
}catch{toast("引用再生APIに接続できませんでした。");return false;}
}
async function stopQuotedPlayback(){
cancelPendingAutoPoll();
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
const endAt=Number(options.endTime??state.lastProgramEndAt);
const remainingMs=endAt>0?endAt*1000-Date.now():null;
const selected=options.selectedCandidate||await window.kananeoApp.niconico.selectPlaybackCandidate({
requests:state.requests.map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
stocks:(options.triggeredByAuto&&!state.playback.stockAutoPlay?[]:state.stocks).map(x=>({...x,lengthMs:Number(x.lengthMs)||0})),
playStyle:state.playback.playStyle,
randomStock:state.playback.randomStock,
remainingMs
});
if(!selected){if(!options.triggeredByAuto)toast("再生可能なリクエスト・ストックがありません。放送残り時間や引用可否も確認してください。");return false;}
const list=selected.queue==="stock"?state.stocks:state.requests;
const item=list[selected.index];
if(!item||options.triggeredByAuto&&["completed","skipped","rejected","playing"].includes(String(item.status||"").toLowerCase()))return false;
return await playQuotedQueueItem(item,selected.queue,options.skipConfirmation===true,{
 programId:options.programId||"",autoLive:options.autoLive===true
});
}
async function playQueueItem(item,queueType="request"){
if(!item)return false;
try{
const result=await window.kananeoApp.niconico.openVideo(item.url);
if(!result?.ok){toast(result?.message||"動画を開けませんでした。");return false;}
void recordVideoPlaybackHistory(item,queueType,"preview");
if(!quotePlayback.active){for(const list of [state.requests,state.stocks])list.forEach(x=>{if(x.id!==item.id&&x.status==="playing")x.status="queued";});item.status="playing";}
state.player.currentId=item.id;state.player.currentQueueType=queueType;state.player.status="loading";state.player.currentTime=0;state.player.duration=0;state.player.endedFor="";
state.logs.unshift("動画を再生："+item.title);save();playerState={state:"loading",currentTime:0,duration:0,message:result.message||"動画ページを開きました。"};
if(page==="requests"||page==="player")render();
toast(result.message||"動画ページを開きました。");
return true;
}catch{toast("プレイヤーを起動できませんでした。");return false;}
}
async function playNextQueueItem(manual=false){
const current=currentQueueItem();
const previousStatus=current?.status;
if(manual&&current&&current.status==="playing")current.status="skipped";
const next=await getNextQueueItem();
if(!next){
if(manual&&current)current.status=previousStatus||"playing";
save();if(page==="requests"||page==="player")render();toast("次に再生できる動画はありません。");return false;
}
save();return await playQueueItem(next);
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
state.poll={...state.poll,question,wait,result,continue:continueLabel,next:nextLabel,tie:true,zero:true};
save();
}
function setPollRuntime(status,message,result){
pollRuntime={...pollRuntime,status,message,result:result||pollRuntime.result,active:pollRuntime.active};
const label=document.getElementById("poll-status-label");
const detail=document.getElementById("poll-status-message");
const results=document.getElementById("poll-results");
const timing=document.getElementById("poll-timing-summary");
if(label)label.textContent=({idle:"停止中",voting:"投票中",results:"結果表示中",repeating:"再投票準備中",skipped:autoPollWaitingForRequestKey?"リクエスト待機中":"条件未確認・時間不足で省略",next:"次動画へ進みました",error:"エラー",stopping:"停止処理中"}[status]||"処理中");
if(detail)detail.textContent=message||"";
if(results&&result)results.textContent=result.map(item=>String(item.name)+"："+Number(item.rate).toFixed(1)+"%").join(" / ");
if(timing)timing.textContent=pollTimingSummary||"動画の長さを確認してから開始します。";
const start=document.querySelector("[data-poll-start]");
const stop=document.querySelector("[data-poll-stop]");
if(start)start.disabled=pollRuntime.active;
if(stop)stop.disabled=!pollRuntime.active;
}
function stopPollDeadlineGuard(){
 if(pollDeadlineTimer)clearTimeout(pollDeadlineTimer);
 pollDeadlineTimer=null;
}
function suspendQuoteAutoForPoll(){
 if(quoteAutoTimer)clearTimeout(quoteAutoTimer);
 quoteAutoTimer=null;quoteAutoToken++;quoteAutoSchedule=null;
 state.player.quotePollAutoSuspended=true;
 quoteAutoMessage="アンケートの結果が確定するまで自動次動画の予定を保留しています。";
 save();updateQuoteScheduleUi();
}

async function ensureCurrentQuoteDuration(options={}){
 const programId=String(quotePlayback.programId||"").toLowerCase();
 const id=String(quotePlayback.videoId||"").toLowerCase();
 if(!quotePlayback.active||!/^lv\d{1,20}$/.test(programId)||
    !/^(?:sm|nm|so)\d{1,12}$/.test(id))return false;
 const itemWithDuration=activeQuotedQueueItem();
 const knownDuration=storedQuoteDurationMs(itemWithDuration);
 if(knownDuration>0){
  // A queued request can already know its duration while the live timing
  // record is incomplete. Repair the duration without inventing a start.
  if(Number(state.player.quoteDurationMs)!==knownDuration){
   if(!window.KananeoQuoteTiming.trustedQuoteStart({
    programId,videoId:id,storedProgramId:state.player.quoteProgramId,
    storedVideoId:state.player.quoteVideoId,startedAt:state.player.quoteStartedAt
   }))state.player.quoteStartedAt=0;
   state.player.quoteDurationMs=knownDuration;
   state.player.quoteVideoId=id;
   state.player.quoteProgramId=programId;
   save();
  }
  const started=Number(state.player.quoteStartedAt);
  if(!pollRuntime.active&&state.playback.quoteAutoNext&&
     window.KananeoQuoteTiming.trustedQuoteTiming({
      programId,videoId:id,storedProgramId:state.player.quoteProgramId,
      storedVideoId:state.player.quoteVideoId,startedAt:started,durationMs:knownDuration
     }))
   scheduleQuoteAutoNext(itemWithDuration||{videoId:id,lengthMs:knownDuration},started);
  return true;
 }
 const key=programId+":"+id;
 if(quoteMetadataPending?.key===key)return quoteMetadataPending.promise;
 // Automatic refreshes are throttled, but a user pressing "取得" can retry.
 if(options.force!==true&&quoteMetadataAttempt.key===key&&
    Date.now()-quoteMetadataAttempt.at<60000)return false;
 quoteMetadataAttempt={key,at:Date.now()};
 const request=(async()=>{
  const result=await window.kananeoApp.niconico.getVideoMetadata(id);
  if(!result?.ok){
   quoteMetadataMessage=String(result?.message||"動画情報を取得できませんでした。").slice(0,180);
   return false;
  }
  if(!quotePlayback.active||quotePlayback.programId!==programId||quotePlayback.videoId!==id){
   quoteMetadataMessage="動画または番組が切り替わったため、古い動画情報を破棄しました。";
   return false;
  }
  const durationMs=Number(result.durationMs);
  if(!Number.isFinite(durationMs)||durationMs<=0||durationMs>86400000)return false;
  quoteMetadataMessage="";
  const item=activeQuotedQueueItem();
  if(item)item.lengthMs=durationMs;
  // A metadata response must not turn a timestamp from another live into
  // a trusted start for this live simply by overwriting its program/video IDs.
  if(!window.KananeoQuoteTiming.trustedQuoteStart({
   programId,videoId:id,storedProgramId:state.player.quoteProgramId,
   storedVideoId:state.player.quoteVideoId,startedAt:state.player.quoteStartedAt
  }))state.player.quoteStartedAt=0;
  state.player.quoteDurationMs=durationMs;
  state.player.quoteVideoId=id;
  state.player.quoteProgramId=programId;
  save();
  const started=Number(state.player.quoteStartedAt);
  const timingContext={programId,videoId:id,storedProgramId:state.player.quoteProgramId,
    storedVideoId:state.player.quoteVideoId,startedAt:started,durationMs};
  if(!pollRuntime.active&&state.playback.quoteAutoNext&&
     window.KananeoQuoteTiming.trustedQuoteTiming(timingContext))
   scheduleQuoteAutoNext(item||{videoId:id,lengthMs:durationMs},started);
  return true;
 })().catch(error=>{
  quoteMetadataMessage="動画情報の取得で通信エラーが発生しました。";
  return false;
 }).finally(()=>{if(quoteMetadataPending?.key===key)quoteMetadataPending=null;});
 quoteMetadataPending={key,promise:request};
 return request;
}

function cancelPendingAutoPoll(){
 if(autoPollPendingTimer!==null)clearTimeout(autoPollPendingTimer);
 autoPollPendingTimer=null;
}
function markAutoPollWaitingForRequests(programId,videoId,startedAt){
 if(!state.poll.autoOnQuote)return false;
 const key=window.KananeoAutoPoll.quotePollKey(programId,videoId,startedAt);
 if(!key)return false;
 autoPollWaitingForRequestKey=key;
 // Quote-start auto polls already claimed this key. An empty queue is not a
 // completed poll: allow exactly one new attempt on accepted request arrival.
 if(autoPollAttemptKey===key)autoPollAttemptKey="";
 return true;
}
function resumeAutoPollAfterRequestAccepted(){
 if(!state.poll.autoOnQuote||!autoPollWaitingForRequestKey||
    !window.KananeoPollNotices.hasPendingRequests(state.requests))return false;
 const programId=quotePlayback.programId,videoId=quotePlayback.videoId;
 const startedAt=state.player.quoteStartedAt;
 const currentKey=window.KananeoAutoPoll.quotePollKey(programId,videoId,startedAt);
 if(!quotePlayback.active||currentKey!==autoPollWaitingForRequestKey){
  // A new live, stopped quotation or stale start timestamp must not revive
  // an old poll. A future quote will follow its normal auto-poll path.
  autoPollWaitingForRequestKey="";
  return false;
 }
 autoPollWaitingForRequestKey="";
 scheduleAutoPollOnQuote(programId,videoId,startedAt);
 state.logs.unshift("リクエストを受け付けたため、現在の引用動画で自動アンケートを再開します。");
 save();
 return true;
}
function scheduleAutoPollOnQuote(programId,videoId,startedAt){
 cancelPendingAutoPoll();
 const key=window.KananeoAutoPoll.quotePollKey(programId,videoId,startedAt);
 if(key&&autoPollWaitingForRequestKey&&autoPollWaitingForRequestKey!==key)
  autoPollWaitingForRequestKey="";
 if(!key||!state.poll.autoOnQuote||autoPollAttemptKey===key)return;
 // A previous poll can still be finishing while the next quotation has started.
 // Do not consume the new quote's unique attempt until its own start is possible.
 let deferredCount=0;
 const tryStart=()=>{
  autoPollPendingTimer=null;
  if(!state.poll.autoOnQuote||!quotePlayback.active||autoPollAttemptKey===key)return;
  if(window.KananeoAutoPoll.quotePollKey(
   quotePlayback.programId,quotePlayback.videoId,state.player.quoteStartedAt)!==key)return;
  const busy=pollRuntime.active||pollStartPending||
   pollRuntime.status==="starting"||pollRuntime.status==="stopping";
  if(busy){
   if(++deferredCount<=120){
    autoPollPendingTimer=setTimeout(tryStart,1000);
   }else{
    state.logs.unshift("次動画のアンケート開始を保留したまま上限に達しました。動画を再確認してください。");
    save();
   }
   return;
  }
  if(!window.KananeoAutoPoll.canAutoPoll({
   enabled:state.poll.autoOnQuote,quoteActive:quotePlayback.active,pollBusy:false,
   attemptedKey:autoPollAttemptKey,programId,videoId,startedAt
  }))return;
  autoPollAttemptKey=key; // claim only when the poll is ready to be started
  void startAutomaticPoll();
 };
 autoPollPendingTimer=setTimeout(tryStart,800);
}

function activePollMedia(now=Date.now()){
 const programId=String(quotePlayback.programId||"").toLowerCase();
 const videoId=String(quotePlayback.videoId||"").toLowerCase();
 const startedAt=Number(state.player.quoteStartedAt);
 const trusted=window.KananeoQuoteTiming.trustedQuoteStart({
  programId,videoId,storedProgramId:state.player.quoteProgramId,
  storedVideoId:state.player.quoteVideoId,startedAt
 },now);
 return {now,startedAt:trusted?startedAt:0,
   durationMs:storedQuoteDurationMs(activeQuotedQueueItem()),videoId};
}
function safePollVideoMatches(){
 // A replay of the same video in another broadcast must not continue this poll.
 return !!(quotePlayback.active&&pollCurrentProgramId&&
  String(quotePlayback.programId||"").toLowerCase()===String(pollCurrentProgramId).toLowerCase()&&
  pollVideoId&&String(quotePlayback.videoId||"").toLowerCase()===String(pollVideoId).toLowerCase());
}
function restoreQuoteAutoAfterVerifiedPoll(){
 if(!pollVideoId||!safePollVideoMatches())return false;
 const media=activePollMedia();
 if(!Number.isFinite(media.startedAt)||media.startedAt<=0||media.durationMs<=0)return false;
 state.player.quotePollAutoSuspended=false;
 pollRuntime.active=false;
 save();
 if(state.playback.quoteAutoNext&&state.playback.playStyle!==0){
  const restored=scheduleQuoteAutoNext({videoId:pollVideoId,lengthMs:media.durationMs},media.startedAt);
  if(restored)quoteAutoMessage="投票済みです。動画の実際の終了時間に合わせて自動次動画を再開しました。";
 }else{
  quoteAutoMessage="投票済みです。手動再生モードのため、次動画の操作は手動で行います。";
 }
 updateQuoteScheduleUi();
 return true;
}
function setPollDeadlineGuard(token,mediaEndsAt){
 stopPollDeadlineGuard();
 const marginMs=window.KananeoPollTiming.SAFETY_SECONDS*1000;
 pollDeadlineTimer=setTimeout(()=>{
  if(token!==pollRunToken||!pollRuntime.active)return;
  pollTimingSummary="動画終了前の安全余裕に達したためアンケートを終了し、自動スキップを保留しました。";
  const resumeNatural=pollVerifiedRound&&pollRuntime.status==="repeating";
  void stopAutomaticPoll("動画終了が近いためアンケートを安全停止しました。")
    .then(()=>{if(resumeNatural)restoreQuoteAutoAfterVerifiedPoll();});
 },Math.max(0,mediaEndsAt-Date.now()-marginMs));
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
async function stopAutomaticPoll(reason="自動アンケートを停止しました。"){
stopPollDeadlineGuard();
if(!pollRuntime.active){if(pollStartPending)pollRunToken++;return;}
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
setPollRuntime("idle",reason);
toast(reason);
}
async function announceNoPendingRequests(programId,canSend){
 if(state.poll.announceResults===false)return;
 const notice=window.KananeoPollNotices.formatNoRequestsComment();
 if(!notice.ok)return;
 const posted=await postAutomatedBroadcasterComment(programId,notice.text,canSend);
 if(posted?.ok){
  state.logs.unshift("リクエストなしを運営コメントで通知："+notice.text);
 }else if(posted?.code!=="COMMENT_CANCELLED"){
  state.logs.unshift("リクエストなしの運営コメント送信失敗："+String(posted?.code||"SEND_FAILED"));
 }
 save();
}
async function startAutomaticPoll(){
 if(pollRuntime.active||pollStartPending){toast("自動アンケートは既に実行中・開始準備中です。");return;}
 pollStartPending=true;
 const setupGeneration=pollRunToken;
 try{
 if(pollEnqueteOpen){
  const cleared=await finishActiveEnquete(pollCurrentProgramId||state.lastProgramId||commentConnection.programId);
  if(!cleared?.ok){toast(cleared?.message||"前回のアンケートを終了できません。");return;}
 }
 savePollSettings();
 const programId=(quotePlayback.active?quotePlayback.programId:state.lastProgramId)||state.lastProgramId||commentConnection.programId;
 if(!programId){toast("先に「放送・枠管理」で放送IDを確認してください。");return;}
 const input={programId,question:state.poll.question,choices:[state.poll.continue,state.poll.next],waitSeconds:Number(state.poll.wait),resultSeconds:Number(state.poll.result)};
 // When the app just started a quote, Nico can report the previous state briefly.
 // Retry read-only verification before invalidating the known start timestamp.
 const expectedVideoId=String(quotePlayback.videoId||"").toLowerCase();
 const locallyStarted=quotePlayback.active&&window.KananeoQuoteTiming.trustedQuoteStart({
  programId,videoId:expectedVideoId,storedProgramId:state.player.quoteProgramId,
  storedVideoId:state.player.quoteVideoId,startedAt:state.player.quoteStartedAt
 });
 if(locallyStarted){
  let confirmed=false;
  for(let attempt=0;attempt<3;attempt++){
   const observed=await window.kananeoApp.niconico.getCurrentQuotation({programId});
   if(observed?.ok&&observed.exists&&String(observed.currentVideoId||"").toLowerCase()===expectedVideoId){
    confirmed=true;break;
   }
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1200));
  }
  if(!confirmed){
   pollTimingSummary="引用再生直後の動画状態をニコ生側で確認できませんでした。誤った動画への投票を防ぐため省略します。再生開始時刻は保持します。";
   setPollRuntime("skipped",pollTimingSummary,[]);toast(pollTimingSummary);return;
  }
 }
 // A stale cached quotation must never trigger a poll on a different video.
 const currentQuote=await refreshQuotePlayback({silent:true});
 if(!currentQuote?.ok){pollTimingSummary="引用再生の状態を確認できないためアンケートを開始できません。";setPollRuntime("skipped",pollTimingSummary,[]);toast(pollTimingSummary);return;}
 if(quotePlayback.active&&storedQuoteDurationMs(activeQuotedQueueItem())<=0){
  setPollRuntime("starting","動画の長さを自動取得しています…");
  await ensureCurrentQuoteDuration();
 }
 if(setupGeneration!==pollRunToken)return;
 if(expectedVideoId&&quotePlayback.active&&String(quotePlayback.videoId||"").toLowerCase()!==expectedVideoId){
  pollTimingSummary="確認中に引用動画が切り替わりました。別動画への誤投票を防ぐため開始しません。";
  setPollRuntime("skipped",pollTimingSummary,[]);return;
 }
 const media=activePollMedia();
 if(quotePlayback.active&&(!Number.isFinite(media.startedAt)||media.startedAt<=0)){
  pollTimingSummary="現在の動画の再生開始時刻が不明です。アプリから引用再生を開始し直してください。動画の長さだけでは開始時刻を推定できません。";
  setPollRuntime("skipped",pollTimingSummary,[]);toast(pollTimingSummary);return;
 }
 if(!quotePlayback.active||!media.videoId){
  pollTimingSummary="ニコ生で引用再生中の動画を確認できないため、アンケートを省略しました。";
  setPollRuntime("skipped",pollTimingSummary,[]);toast(pollTimingSummary);return;
 }
 // Alpha82 removes a request once Nico confirms its quoted playback.
 // Do not run another automatic poll when no next unplayed request remains.
 // Stock autoplay may still continue independently without a vote.
 if(!window.KananeoPollNotices.hasPendingRequests(state.requests)){
  if(state.poll.autoOnQuote)markAutoPollWaitingForRequests(programId,media.videoId,media.startedAt);
  pollTimingSummary="次の未再生リクエストがないためアンケートを省略しました。リクエストを受け付け次第、現在の動画で自動アンケートを再開します。";
  setPollRuntime("skipped",pollTimingSummary,[]);
  await announceNoPendingRequests(programId,()=>
   setupGeneration===pollRunToken&&quotePlayback.active&&quotePlayback.verified===true&&
   quotePlayback.programId===programId&&String(quotePlayback.videoId||"").toLowerCase()===media.videoId&&
   state.poll.announceResults!==false&&
   !window.KananeoPollNotices.hasPendingRequests(state.requests));
  save();
  return;
 }
 const timing=window.KananeoPollTiming;
 const initial=timing.mediaPlan({...media,startWaitSeconds:timing.INITIAL_START_SECONDS,voteSeconds:input.waitSeconds,resultSeconds:input.resultSeconds});
 if(!initial.ok){
  pollTimingSummary=initial.message+(initial.code==="UNKNOWN_VIDEO_DURATION"&&quoteMetadataMessage?" "+quoteMetadataMessage:"");
  setPollRuntime("skipped",pollTimingSummary,[]);toast(pollTimingSummary);return;
 }
 const token=++pollRunToken;
 let resumeNaturalAfterPoll=false;
 pollVideoId=media.videoId;
 pollVerifiedRound=false;
 pollRuntime={active:true,status:"starting",message:"アンケートを準備しています。",result:[],extensionSeconds:0};
 pollCurrentProgramId=programId;
 pollTimingSummary="必要 "+initial.requiredSeconds+"秒／動画残り "+Math.floor(initial.remainingMs/1000)+"秒（開始待ち "+timing.INITIAL_START_SECONDS+"秒、投票 "+input.waitSeconds+"秒、結果 "+input.resultSeconds+"秒、安全余裕 "+timing.SAFETY_SECONDS+"秒）";
 suspendQuoteAutoForPoll();
 setPollDeadlineGuard(token,initial.mediaEndsAt);
 setPollRuntime("starting","動画尺を確認しました。"+timing.INITIAL_START_SECONDS+"秒後に初回投票を始めます。",[]);
 try{
  if(timing.INITIAL_START_SECONDS>0){
   const waited=await waitForPoll(timing.INITIAL_START_SECONDS*1000,token);
   if(!waited)return;
  }
  for(let round=1;round<=100;round++){
   if(token!==pollRunToken||!pollRuntime.active)return;
   if(!safePollVideoMatches())throw new Error("対象動画が変更されました。自動スキップを中止します。");
   const budget=timing.mediaPlan({...activePollMedia(),startWaitSeconds:0,voteSeconds:input.waitSeconds,resultSeconds:input.resultSeconds});
   if(!budget.ok){
    pollTimingSummary=budget.message;setPollRuntime("skipped",budget.message);
    resumeNaturalAfterPoll=true;
    break;
   }
   setPollRuntime("starting",round+"回目のアンケートを開始しています。");
   const started=await window.kananeoApp.niconico.startEnquete(input);
   if(token!==pollRunToken){
    if(started?.ok){pollEnqueteOpen=true;await finishActiveEnquete(programId);}
    return;
   }
   if(!started?.ok)throw new Error(started?.message||"アンケート開始APIに失敗しました。");
   pollEnqueteOpen=true;
   setPollRuntime("voting",round+"回目の投票中です（"+input.waitSeconds+"秒）。");
   const waited=await waitForPoll(input.waitSeconds*1000,token);
   if(!waited){await finishActiveEnquete(programId);return;}
   if(!safePollVideoMatches())throw new Error("投票中に対象動画が変更されました。自動スキップを行いません。");
   setPollRuntime("results",round+"回目の結果をAPIから直接取得しています。");
   const fetched=await window.kananeoApp.niconico.showEnqueteResult({programId});
   if(token!==pollRunToken){await finishActiveEnquete(programId);return;}
   if(!fetched?.ok)throw new Error("投票結果をAPIから取得できませんでした。自動スキップを行いません。"+(fetched?.message||""));
   const decision=await window.kananeoApp.niconico.decideEnqueteResult({items:fetched.items,choices:input.choices,rules:{tie:true,zero:true}});
   if(token!==pollRunToken)return;
   if(!decision||!["next","repeat"].includes(decision.decision))throw new Error("投票結果を安全に判定できません。自動スキップを行いません。");
   const text=fetched.items.map(x=>String(x.name)+"："+Number(x.rate).toFixed(1)+"%").join(" / ");
   setPollRuntime("results",round+"回目の結果："+text+"。"+(decision.decision==="repeat"?"次回投票の待機を計算します。":"次動画が最多です。"),fetched.items);
   // Only publish the verified result for the exact current program/video.
   // A failed notice does not change the vote decision or force a skip.
   if(state.poll.announceResults!==false&&safePollVideoMatches()){
    const notice=window.KananeoPollResultComment.formatPollResultComment({
     round,choices:input.choices,items:fetched.items,decision:decision.decision
    });
    if(notice.ok){
     const reported=await postAutomatedBroadcasterComment(programId,notice.text,()=>
      token===pollRunToken&&pollRuntime.active&&safePollVideoMatches()&&
      state.poll.announceResults!==false);
     if(token!==pollRunToken)return;
     if(reported?.ok){
      state.logs.unshift("投票結果を運営コメントで通知："+notice.text);
     }else if(reported?.code!=="COMMENT_CANCELLED"){
      const reason=reported?.message||"運営コメント送信に失敗しました。";
      pollTimingSummary="結果の運営コメント通知に失敗："+reason.slice(0,150);
      state.logs.unshift("投票結果の運営コメント通知に失敗："+String(reported?.code||"SEND_FAILED"));
      setPollRuntime("results",pollRuntime.message+"（運営コメント通知は失敗）",fetched.items);
     }
     save();
    }
   }
   if(input.resultSeconds>0){
    const held=await waitForPoll(input.resultSeconds*1000,token);
    if(!held){await finishActiveEnquete(programId);return;}
   }
   const finish=await finishActiveEnquete(programId);
   if(!finish?.ok)throw new Error(finish?.message||"アンケート終了APIが失敗しました。自動スキップを行いません。");
   if(token!==pollRunToken)return;
   if(!safePollVideoMatches())throw new Error("動画が変わったため自動スキップを中止します。");
   if(decision.decision==="repeat")pollVerifiedRound=true;
   // Requests can be removed while votes are being counted. Never start
   // another round without any pending requests, even if stock exists.
   if(!window.KananeoPollNotices.hasPendingRequests(state.requests)){
    if(state.poll.autoOnQuote)markAutoPollWaitingForRequests(programId,pollVideoId,state.player.quoteStartedAt);
    pollTimingSummary="未再生リクエストがなくなったためアンケートを終了しました。次のリクエスト受付後に自動アンケートを再開します。";
    setPollRuntime("skipped",pollTimingSummary,fetched.items);
    await announceNoPendingRequests(programId,()=>
     token===pollRunToken&&pollRuntime.active&&safePollVideoMatches()&&
     !window.KananeoPollNotices.hasPendingRequests(state.requests)&&
     state.poll.announceResults!==false);
    if(token!==pollRunToken)return;
    resumeNaturalAfterPoll=true;
    break;
   }
   if(decision.decision==="next"){
    stopPollDeadlineGuard();
    const current=currentQueueItem();
    if(current&&current.status==="playing")current.status="completed";
    pollRuntime.active=false;pollCurrentProgramId="";pollVideoId="";
    setPollRuntime("next","「"+input.choices[1]+"」が最多でした。次の候補へ進みます。",fetched.items);
    state.player.quotePollAutoSuspended=false;save();
    const advanced=await playNextQuoteItem({skipConfirmation:true,triggeredByAuto:true,programId});
    if(!advanced)setPollRuntime("next","次に引用再生できる動画がありません。自動アンケート設定はONのままです。",fetched.items);
    return;
   }
   const plan=timing.repeatPlan({...activePollMedia(),decision,voteSeconds:input.waitSeconds,
     resultSeconds:input.resultSeconds,scheduledEndAt:state.player.quoteExpectedEndAt||initial.mediaEndsAt});
   if(!plan.ok){
    pollTimingSummary=plan.message||"動画の残り時間が足りません。";
    setPollRuntime("skipped","動画の残り尺を超えるため再投票を省略します。",fetched.items);
    resumeNaturalAfterPoll=true;
    break;
   }
   state.player.quoteExpectedEndAt=plan.plannedEndAt;
   pollRuntime.extensionSeconds=Number(pollRuntime.extensionSeconds||0)+plan.reserveSeconds;
   pollTimingSummary="自動待機 "+plan.delaySeconds+"秒＋次回投票 "+input.waitSeconds+"秒＋結果表示 "+input.resultSeconds+"秒＋安全余裕 "+timing.SAFETY_SECONDS+"秒＝再生終了予定に"+plan.reserveSeconds+"秒加算（累計"+pollRuntime.extensionSeconds+"秒）。";
   save();
   setPollRuntime("repeating",round+"回目の結果から待機 "+plan.delaySeconds+"秒を計算しました。",fetched.items);
   // Announce the exact computed wait. Countdown starts after the broadcast
   // comment is attempted so "N seconds later" matches what viewers see.
   if(state.poll.announceResults!==false&&safePollVideoMatches()){
    const notice=window.KananeoPollNotices.formatRepeatCountdownComment({
     round,delaySeconds:plan.delaySeconds
    });
    if(notice.ok){
     const posted=await postAutomatedBroadcasterComment(programId,notice.text,()=>
      token===pollRunToken&&pollRuntime.active&&safePollVideoMatches()&&
      state.poll.announceResults!==false&&
      window.KananeoPollNotices.hasPendingRequests(state.requests));
     if(token!==pollRunToken)return;
     if(posted?.ok)state.logs.unshift("次回アンケート予告を運営コメントで通知："+notice.text);
     else if(posted?.code!=="COMMENT_CANCELLED")
      state.logs.unshift("再アンケート予告の運営コメント送信失敗："+String(posted?.code||"SEND_FAILED"));
     save();
    }
   }
   if(token!==pollRunToken||!pollRuntime.active||!safePollVideoMatches())return;
   const retryWait=await waitForPoll(plan.delaySeconds*1000,token);
   if(!retryWait)return;
  }
  if(token===pollRunToken&&pollRuntime.active){
   const waitingForRequests=pollRuntime.status==="skipped"&&!!autoPollWaitingForRequestKey;
   const message=waitingForRequests?
    "リクエスト待機中です。新しいリクエストが届くと自動アンケートを再開します。":
    pollRuntime.status==="skipped"?"動画尺が不足するため自動アンケートを省略しました。":"再投票100回の安全上限に達しました。";
   pollRuntime.active=false;
   resumeNaturalAfterPoll=pollVerifiedRound;
   setPollRuntime(waitingForRequests?"skipped":"idle",message);toast(message);
  }
 }catch(error){
  if(token!==pollRunToken)return;
  const message=String(error?.message||"アンケートの処理に失敗しました。");
  pollTimingSummary="APIの結果を確認できない場合は、自動次動画への移動を行いません。";
  pollRuntime.active=false;
  setPollRuntime("error",message+" 自動スキップは実行しません。");
  toast(message);
 }finally{
  if(token===pollRunToken){
   stopPollDeadlineGuard();
   await finishActiveEnquete(programId);
   pollRuntime.active=false;
   if(resumeNaturalAfterPoll&&safePollVideoMatches())restoreQuoteAutoAfterVerifiedPoll();
   pollCurrentProgramId="";pollVideoId="";pollVerifiedRound=false;
   if(state.player.quotePollAutoSuspended){
    quoteAutoMessage="アンケート結果確認後の安全保留中です。次動画への移動は手動で行ってください。";
    updateQuoteScheduleUi();
   }
   save();
  }
 }
}finally{pollStartPending=false;}
}
function currentFilteredComments(){
const q=(document.getElementById("comments-search")?.value||"").trim().toLocaleLowerCase();
const filter=document.getElementById("comments-filter")?.value||"all";
return receivedComments.filter(c=>{
if(filter!=="all"&&c.type!==filter)return false;
if(!q)return true;
return [c.content,c.userName,c.userId,findUserProfile(c.userId)?.nickname].some(v=>String(v||"").toLocaleLowerCase().includes(q));
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
const profile=findUserProfile(c.userId);
const displayName=profile?.nickname||c.userName||kind;
const originalName=profile?.nickname&&c.userName&&profile.nickname!==c.userName?'<small class="muted">（'+esc(c.userName)+'）</small>':"";
const profileButton=c.userId?'<button class="btn" data-user-profile-from-comment="'+esc(c.userId)+'" data-user-name="'+esc(c.userName||"")+'">コテハン登録</button>':"";
const speechMuted=window.KananeoCommentSpeech.isUserSpeechMuted(state.voice,c.userId);
const speechToggle=c.userId?'<button class="btn" data-voice-toggle-user="'+esc(c.userId)+'">'+(speechMuted?"読み上げ許可":"読み上げ除外")+'</button>':"";
return '<div class="comment-entry"><div class="comment-meta"><b>'+esc(displayName)+'</b>'+originalName+'<span>'+esc(time)+'</span><span class="chip purple">'+kind+'</span>'+history+'</div><div class="comment-body">'+esc(c.content||"")+'</div><div class="comment-user-id">'+esc(c.userId||"")+' '+speechToggle+' '+profileButton+'</div></div>';
}).join("");
list.scrollTop=list.scrollHeight;
}
function getBroadcastFilteredComments(){
 const query=broadcastCommentSearch.trim().toLocaleLowerCase("ja-JP");
 return receivedComments.map((comment,index)=>({comment,index})).filter(({comment})=>{
  if(broadcastCommentType!=="all"&&comment.type!==broadcastCommentType)return false;
  if(broadcastCommentUserId&&comment.userId!==broadcastCommentUserId)return false;
  if(!query)return true;
  return [comment.content,comment.userName,comment.userId,findUserProfile(comment.userId)?.nickname]
   .some(value=>String(value||"").toLocaleLowerCase("ja-JP").includes(query));
 });
}
function buildBroadcastCommentSettingsControls(){
 const settings=broadcastCommentViewDraft;
 const columnControls=BROADCAST_COMMENT_COLUMNS.map(column=>'<label class="ncv-setting-check"><input type="checkbox" data-ncv-column-visible="'+column.key+'" '+(settings.columns[column.key]?"checked":"")+(column.key==="content"?" disabled":"")+'> '+column.label+'</label>').join("");
 const orderControls=settings.order.map((key,index)=>{
  const label=BROADCAST_COMMENT_COLUMNS.find(column=>column.key===key)?.label||key;
  return '<div class="ncv-order-row"><span>'+String(index+1)+'. '+label+'</span><div><button type="button" class="btn" data-ncv-order-move="up" data-ncv-column-order="'+key+'" '+(index===0?"disabled":"")+' aria-label="'+label+'を上へ">↑</button><button type="button" class="btn" data-ncv-order-move="down" data-ncv-column-order="'+key+'" '+(index===settings.order.length-1?"disabled":"")+' aria-label="'+label+'を下へ">↓</button></div></div>';
 }).join("");
 const colorControls=BROADCAST_COMMENT_COLORS.map(color=>'<label class="ncv-color-setting"><span>'+color.label+'</span><input type="color" data-ncv-type-color="'+color.key+'" value="'+settings.colors[color.key]+'"></label>').join("");
 return '<div class="ncv-settings-grid">'+
  '<div class="ncv-setting-group"><b>文字サイズ</b><label class="ncv-font-setting"><input type="range" id="ncv-comment-font-size" min="8" max="18" step="1" value="'+settings.fontSize+'"><output id="ncv-comment-font-size-value">'+settings.fontSize+'px</output></label></div>'+
  '<div class="ncv-setting-group"><b>表示する列</b><div class="ncv-column-toggles">'+columnControls+'</div><small>コメント本文は常に表示します。</small></div>'+
  '<div class="ncv-setting-group"><b>列の並び順</b><div class="ncv-column-order">'+orderControls+'</div><small>↑／↓で順序を変更できます。</small></div>'+
  '<div class="ncv-setting-group"><b>コメント種別の文字色</b><div class="ncv-color-grid">'+colorControls+'</div></div>'+
  '</div><div class="actions ncv-settings-actions"><button type="button" class="btn primary" data-ncv-display-save>表示設定を保存</button><button type="button" class="btn" data-ncv-display-reset>初期設定に戻す</button><span class="muted">このPC内に保存します。</span></div>';
}
function renderBroadcastCommentSettingsControls(){
 const node=document.getElementById("broadcast-comment-settings-controls");
 if(node)node.innerHTML=buildBroadcastCommentSettingsControls();
}
function persistBroadcastCommentViewSettings(nextSettings){
 const normalized=window.KananeoCommentViewSettings.normalizeCommentViewSettings(nextSettings);
 try{localStorage.setItem(COMMENT_VIEW_STORAGE_KEY,JSON.stringify(normalized));}
 catch{toast("表示設定を保存できませんでした。PCの空き容量を確認してください。");return false;}
 broadcastCommentViewSettings=normalized;
 broadcastCommentViewDraft=window.KananeoCommentViewSettings.normalizeCommentViewSettings(normalized);
 renderBroadcastCommentSettingsControls();renderBroadcastComments();
 return true;
}
function readBroadcastCommentViewDraftFromControls(){
 const host=document.getElementById("broadcast-comment-settings-controls");
 if(!host)return broadcastCommentViewDraft;
 const columns={...broadcastCommentViewDraft.columns},colors={...broadcastCommentViewDraft.colors};
 host.querySelectorAll("[data-ncv-column-visible]").forEach(input=>{columns[input.dataset.ncvColumnVisible]=input.checked;});
 host.querySelectorAll("[data-ncv-type-color]").forEach(input=>{colors[input.dataset.ncvTypeColor]=input.value;});
 return window.KananeoCommentViewSettings.normalizeCommentViewSettings({
  fontSize:Number(host.querySelector("#ncv-comment-font-size")?.value??broadcastCommentViewDraft.fontSize),
  columns,colors,order:broadcastCommentViewDraft.order
 });
}
function saveBroadcastCommentViewSettings(){
 const host=document.getElementById("broadcast-comment-settings-controls");if(!host)return;
 const columns={},colors={};
 host.querySelectorAll("[data-ncv-column-visible]").forEach(input=>{columns[input.dataset.ncvColumnVisible]=input.checked;});
 host.querySelectorAll("[data-ncv-type-color]").forEach(input=>{colors[input.dataset.ncvTypeColor]=input.value;});
 const next={fontSize:Number(host.querySelector("#ncv-comment-font-size")?.value??broadcastCommentViewDraft.fontSize),columns,colors,order:broadcastCommentViewDraft.order};
 if(persistBroadcastCommentViewSettings(next))toast("コメント表示設定を保存しました。");
}
function resetBroadcastCommentViewSettings(){
 if(persistBroadcastCommentViewSettings(window.KananeoCommentViewSettings.normalizeCommentViewSettings({})))toast("コメント表示設定を初期状態に戻しました。");
}
function renderBroadcastComments(){
 const list=document.getElementById("broadcast-comments-list");if(!list)return;
 const count=document.getElementById("broadcast-comment-count");
 const userFilter=document.getElementById("broadcast-comment-user-filter");
 const clearUser=document.querySelector("[data-broadcast-comment-clear-user]");
 const visible=getBroadcastFilteredComments(),settings=broadcastCommentViewSettings;
 if(count)count.textContent=visible.length+"件";
 if(userFilter)userFilter.textContent=broadcastCommentUserId?"ユーザー："+broadcastCommentUserId:"全ユーザー";
 if(clearUser)clearUser.disabled=!broadcastCommentUserId;
 const wasAtBottom=list.scrollHeight-list.scrollTop-list.clientHeight<48;
 if(!visible.length){list.innerHTML='<div class="empty">表示できるコメントがありません。</div>';return;}
 const seenUsers=new Set(),firstPostIds=new Set();
 for(const comment of receivedComments){if(comment.type!=="comment"||!comment.userId)continue;if(!seenUsers.has(comment.userId)){seenUsers.add(comment.userId);firstPostIds.add(comment.id);}}
 const visibleColumns=settings.order.filter(key=>settings.columns[key]);
 const headers=visibleColumns.map(key=>'<th data-ncv-column="'+key+'">'+(BROADCAST_COMMENT_COLUMNS.find(item=>item.key===key)?.label||key)+'</th>').join("");
 const rows=visible.map(({comment,index})=>{
  const date=new Date(comment.timestamp),time=Number.isNaN(date.getTime())?"--:--:--":date.toLocaleTimeString("ja-JP",{hour12:false});
  const profile=findUserProfile(comment.userId),name=profile?.nickname||comment.userName||"匿名";
  const kind=({comment:"通常",operatorComment:"放送者",gift:"ギフト",emotion:"エモーション",notification:"通知"}[comment.type]||"イベント");
  const first=firstPostIds.has(comment.id),read=broadcastReadThroughIndex>=index;
  const userButton=comment.userId?'<button class="ncv-user-button" data-broadcast-user="'+esc(comment.userId)+'" title="このユーザーで絞り込み">'+esc(name)+'</button>':esc(name);
  const userIdButton=comment.userId?'<button class="ncv-user-id-button" data-broadcast-user="'+esc(comment.userId)+'" title="このユーザーのコメントだけ表示">'+esc(comment.userId)+'</button>':"—";
  const cells={
   number:'<td data-ncv-column="number" class="ncv-number-cell"><button class="ncv-number-button" data-broadcast-read-through="'+index+'" title="ここまでを既読にする">'+esc(comment.commentNo||"—")+'</button></td>',
   time:'<td data-ncv-column="time" class="ncv-time-cell">'+esc(time)+'</td>',
   user:'<td data-ncv-column="user" class="ncv-user-cell">'+userButton+'</td>',
   userId:'<td data-ncv-column="userId" class="ncv-id-cell">'+userIdButton+'</td>',
   content:'<td data-ncv-column="content" class="ncv-body-cell">'+esc(comment.content||"")+'</td>',
   type:'<td data-ncv-column="type" class="ncv-kind-cell">'+esc(kind)+'</td>'
  };
  const color=settings.colors[comment.type]||settings.colors.comment;
  return '<tr data-broadcast-comment-index="'+index+'" class="'+(first?"ncv-first-post ":"")+(read?"ncv-read-marked":"")+'" style="--ncv-kind-color:'+esc(color)+'">'+visibleColumns.map(key=>cells[key]).join("")+'</tr>';
 }).join("");
 list.innerHTML='<table class="ncv-comment-table" style="font-size:'+settings.fontSize+'px"><thead><tr>'+headers+'</tr></thead><tbody>'+rows+'</tbody></table>';
 if(wasAtBottom)list.scrollTop=list.scrollHeight;
}async function copyBroadcastComments(){
 const rows=getBroadcastFilteredComments();
 if(!rows.length){toast("コピーするコメントがありません。");return;}
 const text=rows.map(({comment})=>{
  const time=new Date(comment.timestamp);
  const stamp=Number.isNaN(time.getTime())?"":time.toLocaleString("ja-JP");
  return "["+stamp+"] "+(comment.commentNo?"#"+comment.commentNo+" ":"")+(comment.userName||"匿名")+": "+(comment.content||"");
 }).join("\n");
 const result=await window.kananeoApp.niconico.copyText(text);
 toast(result?.ok?"コメントをコピーしました。":"コメントをコピーできませんでした。");
}
function updateBroadcastLivePanel(){
 const status=document.getElementById("broadcast-live-status");
 const message=document.getElementById("broadcast-live-message");
 const commentStatus=document.getElementById("broadcast-comment-status");
 const openButton=document.querySelector("[data-live-video-open]");
 const closeButton=document.querySelector("[data-live-video-close]");
 const commentStart=document.querySelector("[data-broadcast-comment-start]");
 const commentStop=document.querySelector("[data-broadcast-comment-stop]");
 const labels={closed:"未表示",loading:"読み込み中",ready:"表示中",error:"読み込みエラー"};
 if(status)status.textContent=labels[liveVideoState.status]||"未表示";
 if(message)message.textContent=liveVideoState.message||"";
 if(commentStatus)commentStatus.textContent=({disconnected:"未接続",connecting:"接続中",connected:"接続済み",recovering:"再接続中",error:"接続エラー"}[commentConnection.state]||"未接続");
 const active=["connecting","connected","recovering"].includes(commentConnection.state);
 if(openButton)openButton.disabled=liveVideoState.status==="loading";
 if(closeButton)closeButton.disabled=!liveVideoState.open;
 if(commentStart)commentStart.disabled=active;
 if(commentStop)commentStop.disabled=!active;
}
function applyLiveVideoState(state){
 if(!state||typeof state!=="object")return;
 liveVideoState={
  open:state.status!=="closed",
  status:state.status||"closed",
  programId:state.programId||"",
  message:state.message||""
 };
 if(page==="broadcast"){updateBroadcastLivePanel();updateLiveVideoBounds();}
}
function updateLiveVideoBounds(){
 const api=window.kananeoApp?.niconico?.setLiveVideoBounds;
 if(typeof api!=="function")return;
 const slot=document.getElementById("broadcast-video-slot");
 let bounds={visible:false,x:0,y:0,width:0,height:0};
 if(page==="broadcast"&&slot&&liveVideoState.open){
  const rect=slot.getBoundingClientRect();
  bounds={visible:rect.width>0&&rect.height>0,x:rect.left,y:rect.top,width:rect.width,height:rect.height,zoomMode:state.liveVideoZoom.zoomMode,zoomPercent:state.liveVideoZoom.zoomPercent};
 }
 const key=JSON.stringify(bounds);
 if(key===lastLiveVideoBoundsKey)return;
 lastLiveVideoBoundsKey=key;
 api(bounds);
}
function hideBroadcastCommentContextMenu(){
 const menu=document.getElementById("broadcast-comment-context");
 if(menu)menu.hidden=true;
 broadcastContextMenuComment=null;
}
function showBroadcastCommentContextMenu(comment,x,y){
 const menu=document.getElementById("broadcast-comment-context");
 if(!menu||!comment)return;
 broadcastContextMenuComment=comment;
 const userId=String(comment.userId||"");
 const userName=String(comment.userName||"");
 const body=String(comment.content||"");
 menu.innerHTML=
  '<button type="button" data-broadcast-context-action="copy-comment">コメントをコピー</button>'+
  (userId?'<button type="button" data-broadcast-context-action="copy-user-id">ユーザーIDをコピー</button>':"")+
  (userId?'<button type="button" data-broadcast-context-action="filter-user">このユーザーで絞り込む</button>':"")+
  (userId?'<button type="button" data-broadcast-context-action="add-ng-user">NGユーザーに追加</button>':"")+
  (body?'<button type="button" data-broadcast-context-action="add-ng-word">コメント本文をNGワードに追加</button>':"")+
  (userId?'<button type="button" data-user-profile-from-comment="'+esc(userId)+'" data-user-name="'+esc(userName)+'">コテハンを登録・編集</button>':"");
 menu.hidden=false;
 const rect=menu.getBoundingClientRect();
 menu.style.left=Math.max(8,Math.min(Number(x)||0,window.innerWidth-rect.width-8))+"px";
 menu.style.top=Math.max(8,Math.min(Number(y)||0,window.innerHeight-rect.height-8))+"px";
}
async function handleBroadcastCommentContextAction(action){
 const comment=broadcastContextMenuComment;
 hideBroadcastCommentContextMenu();
 if(!comment)return;
 const userId=String(comment.userId||"").trim();
 const body=String(comment.content||"").trim();
 if(action==="copy-comment"){
  const date=new Date(comment.timestamp);
  const stamp=Number.isNaN(date.getTime())?"":date.toLocaleString("ja-JP");
  const value="["+stamp+"] "+(comment.commentNo?"#"+comment.commentNo+" ":"")+(comment.userName||"匿名")+": "+body;
  const result=await window.kananeoApp.niconico.copyText(value);
  toast(result?.ok?"コメントをコピーしました。":"コメントをコピーできませんでした。");
  return;
 }
 if(action==="copy-user-id"){
  if(!userId)return;
  const result=await window.kananeoApp.niconico.copyText(userId);
  toast(result?.ok?"ユーザーIDをコピーしました。":"ユーザーIDをコピーできませんでした。");
  return;
 }
 if(action==="filter-user"){
  if(!userId)return;
  broadcastCommentUserId=userId;
  renderBroadcastComments();
  return;
 }
 if(action==="add-ng-user"){
  if(!userId)return;
  const exists=state.ngUsers.some(value=>String(value||"").trim().toLocaleLowerCase("ja-JP")===userId.toLocaleLowerCase("ja-JP"));
  if(exists){toast("このユーザーは既にNG登録されています。");return;}
  state.ngUsers.push(userId);
  state.logs.unshift("コメント一覧からNGユーザーを追加："+userId);
  save();
  toast("NGユーザーに追加しました。");
  return;
 }
 if(action==="add-ng-word"){
  if(!body)return;
  const exists=state.ngWords.some(value=>String(value||"").trim().toLocaleLowerCase("ja-JP")===body.toLocaleLowerCase("ja-JP"));
  if(exists){toast("このコメント本文は既にNGワードに登録されています。");return;}
  state.ngWords.push(body);
  state.logs.unshift("コメント一覧からNGワードを追加："+body.slice(0,60));
  save();
  toast("コメント本文をNGワードに追加しました。");
 }
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
// Serialize poll-result announcements with request acknowledgements to respect
// Nico's 5-second broadcaster-comment limit and avoid dropping poll notices.
function postAutomatedBroadcasterComment(programId,text,canSend){
 const permitted=()=>{try{return canSend();}catch{return false;}};
 const send=async()=>{
  if(!permitted())return {ok:false,code:"COMMENT_CANCELLED"};
  const waitMs=Math.max(0,5000-(Date.now()-lastRequestReplySentAt));
  if(waitMs)await new Promise(resolve=>setTimeout(resolve,waitMs));
  if(!permitted())return {ok:false,code:"COMMENT_CANCELLED"};
  lastRequestReplySentAt=Date.now();
  try{return await window.kananeoApp.niconico.postBroadcasterComment({programId,text});}
  catch{return {ok:false,code:"SEND_FAILED",message:"運営コメントAPIに接続できませんでした。"};}
 };
 const pending=automatedBroadcasterCommentTail.then(send,send);
 automatedBroadcasterCommentTail=pending.then(()=>{},()=>{});
 return pending;
}
async function processRequestReplyQueue(){
if(requestReplyBusy)return;
requestReplyBusy=true;
try{
while(requestReplyQueue.length){
const item=requestReplyQueue.shift();
if(!state.requestSettings?.replyEnabled||commentConnection.state!=="connected"||commentConnection.programId!==item.programId)continue;
const result=await postAutomatedBroadcasterComment(item.programId,item.text,()=>
 state.requestSettings?.replyEnabled===true&&commentConnection.state==="connected"&&
 commentConnection.programId===item.programId);
if(result?.code==="COMMENT_CANCELLED")continue;
if(result?.ok){
state.logs.unshift("リクエスト受付結果を運営コメントで返信："+item.videoId);save();
}else{
state.logs.unshift("運営コメント自動返信失敗："+String(result?.code||"SEND_FAILED"));save();
if(Date.now()-lastRequestReplyErrorToastAt>30000){
lastRequestReplyErrorToastAt=Date.now();
toast(result?.message||"運営コメントを送信できませんでした。");
}
if(["AUTH_REQUIRED","BROADCASTER_PERMISSION_REQUIRED","PROGRAM_NOT_ON_AIR","BROADCASTER_RATE_LIMITED"].includes(result?.code)){if(result?.code==="BROADCASTER_RATE_LIMITED")lastRequestReplySentAt=Date.now()+Math.max(25000,Number(result?.retryAfterMs)||0);requestReplyQueue.length=0;}
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
const item={id:"req-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),title:validation.videoId,url:validation.url,videoId:validation.videoId,status:"queued",lengthMs:0,addedAt:new Date().toISOString(),source:"comment",requestUserId:userId,requestedBy:getUserDisplayName(comment,String(comment.userName||""))};
state.requests.push(item);state.logs.unshift("コメントから動画リクエスト："+item.videoId);save();
resumeAutoPollAfterRequestAccepted();
if(page==="requests"||page==="poll")render();
toast("コメントからリクエストを受け付けました："+item.videoId);
queueCommentRequestReply(comment,state.requestSettings.replyAccepted,validation.videoId,"");
}catch(error){
state.logs.unshift("コメントリクエスト判定エラー："+String(error?.message||"不明なエラー").slice(0,120));save();
}finally{pendingCommentRequestIds.delete(pendingId);}
}
function receiveComment(comment){
if(!comment||typeof comment!=="object")return;
receivedComments.push(comment);
queueCommentSpeech(comment);
void maybeAddCommentRequest(comment);
if(receivedComments.length>MAX_DISPLAY_COMMENTS){const overflow=receivedComments.length-MAX_DISPLAY_COMMENTS;receivedComments.splice(0,overflow);broadcastReadThroughIndex=Math.max(-1,broadcastReadThroughIndex-overflow);}
renderComments();
renderBroadcastComments();
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
updateBroadcastLivePanel();
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
async function startComments(programIdOverride=""){
const id=String(programIdOverride||document.getElementById("comments-program-id")?.value||document.getElementById("broadcast-watch-id")?.value||"").trim();
if(!id){toast("放送IDまたは番組URLを入力してください。");return;}
const normalizedId=id.trim().toLowerCase();
if(commentConnection.programId.trim().toLowerCase()!==normalizedId||commentConnection.state==="disconnected"){
 hideBroadcastCommentContextMenu();
 receivedComments=[];
 broadcastReadThroughIndex=-1;
 broadcastCommentSearch="";
 broadcastCommentType="all";
 broadcastCommentUserId="";
 renderComments();
 renderBroadcastComments();
 const search=document.getElementById("broadcast-comment-search");if(search)search.value="";
 const type=document.getElementById("broadcast-comment-type");if(type)type.value="all";
}
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
function isSpeechEngineAvailable(){
return !!(window.speechSynthesis&&typeof window.SpeechSynthesisUtterance==="function");
}
function renderSpeechVoices(){
const select=document.getElementById("voice-uri");
const status=document.getElementById("voice-engine-status");
if(!select)return;
if(!isSpeechEngineAvailable()){if(status)status.textContent="この環境では音声合成APIを利用できません。";return;}
const voices=window.speechSynthesis.getVoices()||[];
const current=state.voice.voiceURI||"";
const selected=window.KananeoCommentSpeech.selectSpeechVoice(voices,current);
select.innerHTML='<option value="">システム標準の日本語音声</option>'+voices.map(voice=>'<option value="'+esc(voice.voiceURI)+'">'+esc(voice.name)+'（'+esc(voice.lang||"言語不明")+'）</option>').join("");
select.value=selected?.voiceURI||"";
if(status)status.textContent=voices.length?voices.length+" 個の音声が利用できます。"+(selected&&selected.lang?.toLowerCase().startsWith("ja")?"日本語音声「"+selected.name+"」を選択中です。":"日本語音声がないため、システム標準音声を使用します。"):"音声一覧を取得できませんでした。Windowsの音声機能を確認してください。";
}
function getSpeechQueueText(item){
return typeof item==="string"?item:String(item?.text||"");
}
function getSpeechQueueUserName(item){
if(!item||typeof item!=="object")return "ユーザー不明";
return getUserDisplayName({userId:item.userId,userName:item.userName},item.userId||"ユーザー不明");
}
function renderSpeechQueuePreview(){
const node=document.getElementById("voice-queue-preview");
if(!node)return;
const active=speechBusy&&speechCurrentItem
?'<div class="row"><div><b>読み上げ中：'+esc(getSpeechQueueUserName(speechCurrentItem))+'</b><small>'+esc(getSpeechQueueText(speechCurrentItem).slice(0,100))+'</small></div><span class="muted">再生中</span></div>'
:"";
const rows=speechQueue.slice(0,10).map((item,index)=>'<div class="row"><div><b>'+esc(getSpeechQueueUserName(item))+'</b><small>'+esc(getSpeechQueueText(item).slice(0,100))+'</small></div><button class="btn" type="button" data-voice-queue-remove="'+index+'">削除</button></div>').join("");
const remaining=Math.max(0,speechQueue.length-10);
node.innerHTML=(active+rows+(remaining?'<div class="muted">ほか '+remaining+' 件</div>':""))||'<div class="empty">読み上げ待ちのコメントはありません。</div>';
}
function updateSpeechQueueUi(){
const node=document.getElementById("voice-queue-status");
if(node)node.textContent="待ち行列："+speechQueue.length+" 件 / 読み上げ中："+(speechBusy?"はい":"いいえ")+" / あふれて破棄："+speechDroppedCount+" 件";
renderSpeechQueuePreview();
}
function stopSpeechQueue(clear=true){
speechGeneration++;
if(clear)speechQueue=[];
if(isSpeechEngineAvailable())window.speechSynthesis.cancel();
speechBusy=false;
speechCurrentItem=null;
updateSpeechQueueUi();
}
function speakDirect(text){
if(!isSpeechEngineAvailable()){toast("この環境では音声合成を利用できません。");return false;}
const utterance=new window.SpeechSynthesisUtterance(String(text||"").slice(0,320));
utterance.lang="ja-JP";
utterance.rate=Number(state.voice.rate)||1;
utterance.pitch=Number(state.voice.pitch??1);
utterance.volume=Number(state.voice.volume??1);
const voice=window.KananeoCommentSpeech.selectSpeechVoice(window.speechSynthesis.getVoices()||[],state.voice.voiceURI);
if(voice)utterance.voice=voice;
window.speechSynthesis.speak(utterance);
return true;
}
function speakNextComment(){
if(speechBusy||!speechQueue.length||!state.voice.enabled||!isSpeechEngineAvailable())return;
const next=speechQueue.shift();
speechCurrentItem=typeof next==="string"?{text:next,userId:"",userName:""}:next;
const generation=speechGeneration;
speechBusy=true;
updateSpeechQueueUi();
const utterance=new window.SpeechSynthesisUtterance(getSpeechQueueText(speechCurrentItem));
utterance.lang="ja-JP";
utterance.rate=Number(state.voice.rate)||1;
utterance.pitch=Number(state.voice.pitch??1);
utterance.volume=Number(state.voice.volume??1);
const voice=window.KananeoCommentSpeech.selectSpeechVoice(window.speechSynthesis.getVoices()||[],state.voice.voiceURI);
if(voice)utterance.voice=voice;
let finished=false;
const finish=()=>{
if(finished)return;
finished=true;
if(generation!==speechGeneration)return;
speechBusy=false;
speechCurrentItem=null;
updateSpeechQueueUi();
if(state.voice.enabled)speakNextComment();
};
utterance.onend=finish;
utterance.onerror=finish;
window.speechSynthesis.speak(utterance);
}
function queueCommentSpeech(comment){
if(!state.voice?.enabled||!isSpeechEngineAvailable())return;
const profile=findUserProfile(comment?.userId);
const result=window.KananeoCommentSpeech.createCommentSpeechText(comment,profile,state.voice,state.ngWords);
if(!result.ok)return;
const queued=window.KananeoCommentSpeech.appendSpeechQueue(speechQueue,{
text:result.text,
userId:String(comment?.userId||""),
userName:String(profile?.nickname||comment?.userName||"")
},state.voice.maxQueue||100);
speechQueue=queued.queue;
speechDroppedCount+=queued.dropped;
updateSpeechQueueUi();
speakNextComment();
}
function saveVoiceSettings(){
const result=window.KananeoCommentSpeech.normalizeCommentSpeechSettings({
enabled:document.getElementById("voice-enabled").checked,
includeName:document.getElementById("voice-include-name").checked,
speakOperator:document.getElementById("voice-speak-operator").checked,
rate:document.getElementById("voice-rate").value,
pitch:document.getElementById("voice-pitch").value,
volume:document.getElementById("voice-volume").value,
voiceURI:document.getElementById("voice-uri").value,
maxQueue:100,
mutedUserIds:state.voice.mutedUserIds
});
state.voice=result;
save();
if(!state.voice.enabled)stopSpeechQueue(true);
else if(isSpeechEngineAvailable())window.speechSynthesis.resume();
toast("コメント読み上げ設定を保存しました。");
renderSpeechVoices();
updateSpeechQueueUi();
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
try{
 const r=await window.kananeoApp.niconico.checkProgram(input);
 node.replaceChildren();
 const title=document.createElement("b");title.textContent=r.ok?(r.title||r.programId):"確認できませんでした";
 const detail=document.createElement("div");detail.textContent=r.message||"";node.append(title,detail);
 if(r.ok){
  state.lastProgramId=r.programId;state.lastProgramTitle=r.title||r.programId;state.lastProgramStatus=r.programStatus||"";state.lastProgramEndAt=Number(r.endTime)||0;
  const manageInput=document.getElementById("broadcast-manage-id");if(manageInput)manageInput.value=r.programId;
  broadcastManageVerification=window.KananeoBroadcastManagement.createBroadcastVerification(r);
  save();state.logs.unshift("番組ページを確認："+r.programId);save();
  renderBroadcastManageVerification();
  void refreshDashboardStatistics(true);void refreshQuotePlayback({silent:true});
 }
}catch{node.textContent="確認中にエラーが発生しました。";}
finally{if(button)button.disabled=false;}
}
function renderBroadcastManageVerification(){
 const input=document.getElementById("broadcast-manage-id");
 const result=document.getElementById("broadcast-manage-result");
 const button=document.querySelector("[data-broadcast-manage]");
 if(!input||!button)return;
 const id=input.value.trim();
 const fresh=window.KananeoBroadcastManagement.isBroadcastVerificationFresh(broadcastManageVerification,id);
 button.disabled=!fresh;
 if(!result)return;
 if(fresh){
  const info=broadcastManageVerification;
  const age=Math.max(0,Math.floor((Date.now()-info.checkedAt)/1000));
  result.textContent=info.title+"\n"+info.programId+" / "+info.statusLabel+"\n確認済み（"+age+"秒前）。配信終了は公式画面で実行してください。";
 }else{
  result.textContent="未確認、対象ID変更、または確認期限切れです。「放送ID・状態を確認」を押してください。";
 }
}
async function verifyBroadcastManageTarget(){
 const input=document.getElementById("broadcast-manage-id");
 const resultNode=document.getElementById("broadcast-manage-result");
 const verifyButton=document.querySelector("[data-broadcast-verify]");
 const id=input?.value.trim()||"";
 if(!id){toast("確認する放送IDを入力してください。");return;}
 if(resultNode)resultNode.textContent="番組ページと現在の状態を確認しています…";
 if(verifyButton)verifyButton.disabled=true;
 broadcastManageVerification=null;renderBroadcastManageVerification();
 try{
  const checked=await window.kananeoApp.niconico.checkProgram(id);
  if(!checked?.ok)throw new Error(checked?.message||"番組を確認できませんでした。");
  broadcastManageVerification=window.KananeoBroadcastManagement.createBroadcastVerification(checked);
  if(!broadcastManageVerification)throw new Error("放送IDまたは番組情報を検証できませんでした。");
  state.lastProgramId=broadcastManageVerification.programId;
  state.lastProgramTitle=broadcastManageVerification.title;
  state.lastProgramStatus=broadcastManageVerification.status;
  state.lastProgramEndAt=Number(checked.endTime)||0;
  const primaryInput=document.getElementById("live-id");if(primaryInput)primaryInput.value=broadcastManageVerification.programId;
  input.value=broadcastManageVerification.programId;
  save();state.logs.unshift("放送管理対象を確認："+broadcastManageVerification.programId);save();
  renderBroadcastManageVerification();
  void refreshDashboardStatistics(true);
  toast("番組を確認しました。90秒以内に管理画面を開けます。");
 }catch(error){
  broadcastManageVerification=null;renderBroadcastManageVerification();
  if(resultNode)resultNode.textContent=error?.message||"番組を確認できませんでした。";
  toast(error?.message||"番組を確認できませんでした。");
 }finally{if(verifyButton)verifyButton.disabled=false;}
}
function clampBgmVolume(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.min(1,number)):0.7;}
function formatBgmFileSize(bytes){const size=Number(bytes);if(!Number.isFinite(size)||size<=0)return "サイズ不明";return size>=1024*1024?(size/(1024*1024)).toFixed(1)+" MB":(size/1024).toFixed(0)+" KB";}
function formatBgmTime(seconds){const value=Number(seconds);if(!Number.isFinite(value)||value<0)return "00:00";const total=Math.floor(value),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),secs=total%60;return hours?String(hours).padStart(2,"0")+":"+String(minutes).padStart(2,"0")+":"+String(secs).padStart(2,"0"):String(minutes).padStart(2,"0")+":"+String(secs).padStart(2,"0");}
function getCurrentBgmTrack(){return bgmTracks.find(track=>track.id===bgmCurrentId)||null;}
function ensureBgmAudio(){
 if(bgmAudio)return bgmAudio;
 if(typeof Audio!=="function")return null;
 bgmAudio=new Audio();bgmAudio.preload="metadata";bgmAudio.volume=clampBgmVolume(state.playback.bgmVolume);
 bgmAudio.addEventListener("timeupdate",updateBgmPlaybackUi);
 bgmAudio.addEventListener("loadedmetadata",updateBgmPlaybackUi);
 bgmAudio.addEventListener("play",updateBgmPlaybackUi);
 bgmAudio.addEventListener("pause",updateBgmPlaybackUi);
 bgmAudio.addEventListener("ended",()=>{void playNextBgmTrack(true);});
 bgmAudio.addEventListener("error",()=>{bgmError="この音源を再生できません。ファイル形式または音源ファイルを確認してください。";updateBgmPlaybackUi();});
 return bgmAudio;
}
function updateBgmPlaybackUi(){
 const current=getCurrentBgmTrack(),title=document.getElementById("bgm-current-name"),status=document.getElementById("bgm-current-status"),clock=document.getElementById("bgm-clock"),progress=document.getElementById("bgm-progress"),volume=document.getElementById("bgm-volume"),volumeLabel=document.getElementById("bgm-volume-label"),toggle=document.querySelector("[data-bgm-toggle]"),stop=document.querySelector("[data-bgm-stop]");
 if(title)title.textContent=current?.name||"再生する曲を選択してください";
 if(status)status.textContent=bgmError||(!current?"停止中":bgmAudio&&!bgmAudio.paused?"再生中":bgmAudio&&bgmAudio.ended?"再生終了":bgmAudio&&bgmAudio.currentTime>0?"一時停止中":"停止中");
 const duration=bgmAudio&&Number.isFinite(bgmAudio.duration)?bgmAudio.duration:0,currentTime=bgmAudio&&Number.isFinite(bgmAudio.currentTime)?bgmAudio.currentTime:0;
 if(clock)clock.textContent=formatBgmTime(currentTime)+" / "+formatBgmTime(duration);
 if(progress){progress.max=1000;progress.value=duration>0?Math.round(Math.max(0,Math.min(1,currentTime/duration))*1000):0;progress.disabled=!current||duration<=0;}
 if(volume)volume.value=String(clampBgmVolume(state.playback.bgmVolume));
 if(volumeLabel)volumeLabel.textContent=Math.round(clampBgmVolume(state.playback.bgmVolume)*100)+"%";
 if(toggle){toggle.disabled=!bgmTracks.length;toggle.textContent=bgmAudio&&!bgmAudio.paused?"一時停止":"再生";}
 document.querySelectorAll("[data-bgm-play]").forEach(button=>{
  const active=button.dataset.bgmPlay===bgmCurrentId&&!!bgmAudio&&!bgmAudio.paused;
  button.textContent=active?"再生中":"再生";
  button.classList.toggle("primary",active);
 });
 if(stop)stop.disabled=!current;
 const libraryStatus=document.getElementById("bgm-library-status");
 if(libraryStatus&&!bgmLoading)libraryStatus.textContent=bgmError||"登録 "+bgmTracks.length+" 曲";
}
async function refreshBgmLibrary(silent=false){
 if(bgmLoading)return;
 bgmLoading=true;if(page==="player")render();
 try{
  const result=await window.kananeoApp.bgm.get();
  if(!result?.ok)throw new Error(result?.message||"BGMライブラリを読み込めませんでした。");
  bgmTracks=Array.isArray(result.tracks)?result.tracks:[];bgmError="";
  if(bgmCurrentId&&!bgmTracks.some(track=>track.id===bgmCurrentId)){if(bgmAudio){bgmAudio.pause();bgmAudio.removeAttribute("src");bgmAudio.load();}bgmCurrentId="";}
 }catch(error){bgmError=error?.message||"BGMライブラリを読み込めませんでした。";if(!silent)toast(bgmError);}
 finally{bgmLoading=false;if(page==="player")render();}
}
async function playBgmTrack(trackId){
 const track=bgmTracks.find(item=>item.id===trackId);if(!track){toast("再生するBGMが見つかりません。");return;}
 const audio=ensureBgmAudio();if(!audio){toast("この環境では音声を再生できません。");return;}
 bgmError="";
 if(bgmCurrentId!==track.id||audio.src!==track.url){audio.pause();bgmCurrentId=track.id;audio.src=track.url;audio.load();}
 audio.volume=clampBgmVolume(state.playback.bgmVolume);if(audio.ended)audio.currentTime=0;
 try{await audio.play();if(page==="player")render();else updateBgmPlaybackUi();}
 catch(error){bgmError=error?.name==="NotAllowedError"?"ブラウザーが音声再生を拒否しました。再生ボタンをもう一度押してください。":"音源を再生できませんでした。対応形式とファイルを確認してください。";updateBgmPlaybackUi();toast(bgmError);}
}
async function toggleBgmPlayback(){
 const audio=ensureBgmAudio();if(!audio){toast("この環境では音声を再生できません。");return;}
 if(!bgmCurrentId){if(bgmTracks.length)await playBgmTrack(bgmTracks[0].id);else toast("先に音源ファイルを追加してください。");return;}
 if(audio.paused){if(audio.ended)audio.currentTime=0;try{await audio.play();bgmError="";}catch{bgmError="音源を再生できませんでした。";}}else audio.pause();
 updateBgmPlaybackUi();if(page==="player")render();
}
async function playNextBgmTrack(automatic=false){
 if(!bgmTracks.length)return;
 const currentIndex=bgmTracks.findIndex(track=>track.id===bgmCurrentId);let nextIndex=currentIndex+1;
 if(nextIndex>=bgmTracks.length){if(automatic&&!state.playback.bgmRepeat){if(bgmAudio){bgmAudio.pause();bgmAudio.currentTime=0;}updateBgmPlaybackUi();return;}nextIndex=0;}
 await playBgmTrack(bgmTracks[nextIndex].id);
}
async function playPreviousBgmTrack(){
 if(!bgmTracks.length)return;
 const audio=ensureBgmAudio();if(audio&&audio.currentTime>3){audio.currentTime=0;updateBgmPlaybackUi();return;}
 const currentIndex=bgmTracks.findIndex(track=>track.id===bgmCurrentId),previousIndex=currentIndex>0?currentIndex-1:(state.playback.bgmRepeat?bgmTracks.length-1:0);
 await playBgmTrack(bgmTracks[previousIndex].id);
}
function stopBgmPlayback(){if(!bgmAudio)return;bgmAudio.pause();try{bgmAudio.currentTime=0;}catch{}updateBgmPlaybackUi();}
async function handleRemoteControlRequest(request){
 if(!request||typeof request.requestId!=="string"||request.requestId.length>64)return;
 let result={ok:false,code:"INVALID_REMOTE_ACTION",message:"未対応の操作です。"};
 try{
  if(request.action==="snapshot"){
   const current=currentQueueItem(),bgm=getCurrentBgmTrack();
   const stateLabels={closed:"未起動",loading:"読み込み中",playing:"再生中",paused:"一時停止",ended:"再生終了",error:"エラー"};
   result={ok:true,status:{
    authenticated:!!nicoStatus.authenticated,
    programId:state.lastProgramId||commentConnection.programId||"",
    comment:{state:commentConnection.state,stateLabel:({disconnected:"未接続",connecting:"接続中",connected:"接続済み",recovering:"再接続中",error:"接続エラー"}[commentConnection.state]||"不明"),count:receivedComments.length},
    player:{state:playerState.state,stateLabel:stateLabels[playerState.state]||"状態確認中",title:current?.title||playerState.title||"",currentTime:Number(playerState.currentTime)||0,duration:Number(playerState.duration)||0},
    bgm:{stateLabel:bgmAudio&&!bgmAudio.paused?"再生中":bgmAudio&&bgmAudio.currentTime>0?"一時停止":"停止中",trackName:bgm?.name||"",volume:clampBgmVolume(state.playback.bgmVolume)}
   }};
  }else if(request.action==="comments"){
   const limit=Math.max(1,Math.min(100,Math.floor(Number(request.payload?.limit)||30)));
   result={ok:true,comments:receivedComments.slice(-limit).map(comment=>{
    const date=new Date(comment.timestamp);
    return {userName:getUserDisplayName(comment,"匿名"),time:Number.isNaN(date.getTime())?"":date.toLocaleTimeString("ja-JP",{hour12:false}),content:String(comment.content||"").slice(0,2000),type:String(comment.type||"comment")};
   })};
  }else if(request.action==="command"){
   const command=request.payload?.command,payload=request.payload?.payload||{};
   if(command==="player:pause"){
    result=await window.kananeoApp.niconico.pauseVideo();
   }else if(command==="player:next"){
    if(quotePlayback.active)result={ok:false,code:"QUOTATION_ACTIVE",message:"引用再生中はリモートからプレビューの次動画へ進めません。"};
    else if(await playNextQueueItem(true))result={ok:true,message:"次のプレビューを開きました。"};
    else result={ok:false,code:"NO_NEXT_VIDEO",message:"次のプレビュー動画がありません。"};
   }else if(command==="player:stop"){
    const closed=await window.kananeoApp.niconico.closeVideo();
    playerState={state:"closed",message:closed?.message||"プレビューを閉じました。"};
    updateVideoPlayerState(playerState);
    result=closed?.ok===false?closed:{ok:true,message:"動画プレビューを閉じました。"};
   }else if(command==="bgm:play"){
    if(!bgmTracks.length&&!bgmLoading)await refreshBgmLibrary(true);
    const track=bgmTracks.find(item=>item.id===bgmCurrentId)||bgmTracks[0];
    if(!track)result={ok:false,code:"NO_BGM",message:"BGMが登録されていません。"};
    else{await playBgmTrack(track.id);result=bgmError?{ok:false,code:"BGM_PLAY_FAILED",message:bgmError}:{ok:true,message:"BGMを再生しました。"};}
   }else if(command==="bgm:pause"){
    if(!bgmAudio||bgmAudio.paused)result={ok:false,code:"BGM_NOT_PLAYING",message:"BGMは再生中ではありません。"};
    else{bgmAudio.pause();updateBgmPlaybackUi();result={ok:true,message:"BGMを一時停止しました。"};}
   }else if(command==="bgm:next"){
    if(!bgmTracks.length&&!bgmLoading)await refreshBgmLibrary(true);
    if(!bgmTracks.length)result={ok:false,code:"NO_BGM",message:"BGMが登録されていません。"};
    else{await playNextBgmTrack(false);result=bgmError?{ok:false,code:"BGM_NEXT_FAILED",message:bgmError}:{ok:true,message:"次のBGMへ切り替えました。"};}
   }else if(command==="bgm:volume"){
    const value=payload.value;
    if(typeof value!=="number"||!Number.isFinite(value)||value<0||value>1)result={ok:false,code:"INVALID_VOLUME",message:"BGM音量は0〜1で指定してください。"};
    else{state.playback.bgmVolume=value;if(bgmAudio)bgmAudio.volume=value;save();updateBgmPlaybackUi();result={ok:true,message:"BGM音量を"+Math.round(value*100)+"%に変更しました。"};}
   }else result={ok:false,code:"COMMAND_NOT_ALLOWED",message:"許可されていない操作です。"};
  }
 }catch(error){result={ok:false,code:"REMOTE_ACTION_FAILED",message:error?.message||"操作を実行できませんでした。"};}
 window.kananeoApp.remote.resolveRequest(request.requestId,result);
}
function renderInAppUpdateNotice(){
 const host=document.getElementById("in-app-update-notice");
 if(!host)return;
 const model=window.KananeoUpdateUi?.inAppUpdateNotice?.(autoUpdateState,updateCheckState.result);
 if(!model)return;
 host.hidden=!model.visible;
 if(!model.visible)return;
 const title=document.getElementById("in-app-update-title");
 const detail=document.getElementById("in-app-update-detail");
 const button=host.querySelector("[data-update-notice-action]");
 const releases=host.querySelector("[data-update-open-releases]");
 if(title)title.textContent=model.title;
 if(detail)detail.textContent=model.detail;
 if(button){
  button.hidden=!model.action;
  button.disabled=!model.action;
  button.dataset.updateNoticeAction=model.action||"";
  button.textContent=model.actionLabel||"";
 }
 if(releases)releases.hidden=!model.showReleases;
}
function renderDashboardAlphaUpdateStatus(){
 const banner=document.getElementById("dashboard-alpha-update");
 if(!banner)return;
 if(document.getElementById("in-app-update-notice")){banner.hidden=true;return;}
 const s=autoUpdateState;
 const downloading=s.supported&&s.phase==="downloading";
 const downloaded=s.supported&&s.phase==="downloaded";
 banner.hidden=!downloading&&!downloaded;
 if(banner.hidden)return;
 const title=document.getElementById("dashboard-alpha-update-title");
 const detail=document.getElementById("dashboard-alpha-update-detail");
 if(title)title.textContent=downloaded?"α版アップデートの準備ができました":("α版の更新ファイルを取得中："+Math.round(s.percent)+"%");
 if(detail)detail.textContent=downloaded?
  "対象 "+(s.version||"新しいバージョン")+"。アプリ終了時に自動適用、または設定から更新して再起動できます。":
  "対象 "+(s.version||"新しいバージョン")+"。ダウンロード完了後に安全なタイミングで更新します。";
}
function renderAutoUpdateStatus(){
 const status=document.getElementById("auto-update-status"),details=document.getElementById("auto-update-details"),button=document.querySelector("[data-update-auto-check]"),apply=document.querySelector("[data-update-auto-apply]");
 if(!status||!details)return;
 const s=autoUpdateState;
 status.textContent=s.message||"状態不明";
 details.textContent=s.phase==="downloading"?"ダウンロード："+s.percent+"%"+(s.version?" / "+s.version:""):
   s.phase==="downloaded"?"ダウンロード済み："+(s.version||"新しいバージョン")+"。通常終了時に自動適用、または今すぐ更新して再起動できます。":
   s.phase==="installing"?"アプリを終了して更新を適用しています。":
   s.phase==="error"?"エラーコード："+(s.errorCode||"UPDATE_FAILED")+"。更新診断をコピーして報告できます。":
   !s.supported?"自動更新はWindows Setup版に対応します。Portable版では「公開版を確認」から更新情報を確認し、最新版Setupをインストールしてください。":
   "利用チャンネル："+({alpha:"α開発版",beta:"βテスト版",latest:"製品版"}[s.channel]||"不明")+"。更新はアプリ終了時に適用し、配信中に強制再起動しません。";
 if(button)button.disabled=!s.supported||["checking","downloading","downloaded","installing"].includes(s.phase);
 if(apply){apply.hidden=s.phase!=="downloaded";apply.disabled=s.phase!=="downloaded";}
}
function applyAutoUpdateStatus(s){
 if(!s||typeof s!=="object")return;
 autoUpdateState={supported:s.supported===true,channel:String(s.channel||"alpha"),phase:String(s.phase||"idle"),message:String(s.message||"").slice(0,220),percent:Number(s.percent)||0,version:String(s.version||"").slice(0,70),errorCode:String(s.errorCode||"").slice(0,80),checkedAt:String(s.checkedAt||"").slice(0,50),source:String(s.source||"").slice(0,50)};
 renderAutoUpdateStatus();
 renderDashboardAlphaUpdateStatus();
 renderInAppUpdateNotice();
}
async function applyDownloadedUpdate(){
 if(autoUpdateState.phase!=="downloaded"){toast("更新のダウンロードが完了していません。");return;}
 if(!confirm("アプリを終了し、新しいバージョンをインストールして再起動しますか？\n\nコメント取得・放送監視・リモート接続を終了します。配信中なら終了後に実行してください。"))return;
 try{
  const result=await window.kananeoApp.updates.applyAuto();
  if(!result?.ok)toast(result?.message||"更新を適用できませんでした。");
  else toast("アプリを終了して更新を適用し、再起動します。");
 }catch{toast("更新処理を開始できませんでした。");}
}
async function copyUpdateDiagnostic(){
 const v=autoUpdateState;
 const lines=[
  "kananeo nico live stream 自動更新診断",
  "アプリ版: "+String(window.kananeoApp.version),
  "OS: "+String(window.kananeoApp.platform),
  "自動更新対応: "+(v.supported?"はい":"いいえ"),
  "状態: "+v.phase,
  "エラーコード: "+(v.errorCode||"なし"),
  "対象版: "+(v.version||"不明"),
  "更新チャンネル: "+(v.channel||"不明"),
  "自動更新の取得経路: "+(v.source||"未選択"),
  "確認日時: "+(v.checkedAt||"不明"),
  "状況: "+v.message
 ];
 try{
  const result=await window.kananeoApp.niconico.copyText(lines.join("\n"));
  toast(result?.ok?"更新診断をコピーしました。":"診断情報をコピーできませんでした。");
 }catch{toast("診断情報をコピーできませんでした。");}
}
async function manuallyCheckAutoUpdate(){
 try{const s=await window.kananeoApp.updates.checkAuto();applyAutoUpdateStatus(s);if(s?.phase==="error"||s?.phase==="unavailable")toast(s.message);}
 catch{toast("自動更新の確認に失敗しました。");}
}
function renderUpdateCheck(){
 const status=document.getElementById("update-check-status");
 const details=document.getElementById("update-release-details");
 const button=document.querySelector("[data-update-check]");
 if(!status||!details)return;
 if(button)button.disabled=updateCheckState.loading;
 if(updateCheckState.loading){status.textContent="GitHub Releasesを確認しています…";details.textContent="";return;}
 if(updateCheckState.error){status.textContent=updateCheckState.error;details.textContent="";return;}
 const result=updateCheckState.result;
 if(!result){status.textContent="未確認";details.textContent="";return;}
 status.textContent=result.message+(result.checkedAt?"（"+new Date(result.checkedAt).toLocaleString("ja-JP")+"）":"");
 const release=result.release;
 if(!release){details.innerHTML='<div class="empty">'+esc(result.message||"公開済みのリリースはありません。")+'</div>';return;}
 const date=release.publishedAt?new Date(release.publishedAt).toLocaleString("ja-JP"):"公開日不明";
 const notes=String(release.body||"").trim().slice(0,3000);
 const notesHtml=notes?'<div class="muted" style="white-space:normal;line-height:1.8;margin-top:8px">'+esc(notes).replace(/\r?\n/g,"<br>")+'</div>':'<div class="muted">リリースノートはありません。</div>';
 details.innerHTML='<div class="row"><div><b>最新公開版：'+esc(release.version)+'</b><small>'+esc(date)+' / 配布ファイル '+Number(release.assetsCount||0)+' 件</small></div>'+(result.updateAvailable?'<span class="tag">更新あり</span>':'')+'</div><div class="row"><div><b>'+esc(release.name||release.tagName)+'</b>'+notesHtml+'</div></div>';
}
async function checkForApplicationUpdates(silent=false){
 if(updateCheckState.loading)return;
 updateCheckState={loading:true,result:null,error:""};
 renderUpdateCheck();
 try{
  const result=await window.kananeoApp.updates.check();
  if(!result?.ok)throw new Error(result?.message||"アップデート情報を確認できませんでした。");
  updateCheckState={loading:false,result,error:""};
 }catch(error){
  updateCheckState={loading:false,result:null,error:error?.message||"アップデート情報を確認できませんでした。"};
 }
 renderUpdateCheck();
 renderInAppUpdateNotice();
if(page==="dashboard"&&updateCheckState.result?.updateAvailable)render();
if(!silent&&updateCheckState.error)toast(updateCheckState.error);
}
function go(p){if(p!=="broadcast")hideBroadcastCommentContextMenu();page=p;render();if(p==="dashboard")void refreshDashboardStatistics(true);if(p==="player"){void refreshQuotePlayback();if(!bgmTracks.length&&!bgmLoading)void refreshBgmLibrary(true);}if(p==="comments")renderComments();if(p==="library"){void refreshVideoLibrary();renderVideoLibraryRows();}if(p==="users")renderUserProfileRows();if(p==="remote")void refreshRemoteControlUi(true);if(p==="changelog"&&!releaseHistoryState.items.length)void fetchReleaseHistory();}
document.getElementById("nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(!b)return;window.KananeoUiHealth?.trackAction("画面移動："+b.textContent);try{go(b.dataset.page);}catch(error){window.KananeoUiHealth?.report(error,"メニュー操作");}});
window.addEventListener("resize",()=>{hideBroadcastCommentContextMenu();updateLiveVideoBounds();},{passive:true});
document.addEventListener("scroll",()=>{hideBroadcastCommentContextMenu();updateLiveVideoBounds();},true);
document.addEventListener("contextmenu",e=>{const row=e.target.closest("#broadcast-comments-list tr[data-broadcast-comment-index]");if(!row)return;e.preventDefault();const index=Number(row.dataset.broadcastCommentIndex);showBroadcastCommentContextMenu(receivedComments[index],e.clientX,e.clientY);});
document.addEventListener("click",e=>{void handleUiClick(e).catch(error=>window.KananeoUiHealth?.report(error,"ボタン操作"));});
async function handleUiClick(e){
const goBtn=e.target.closest("[data-go]");if(goBtn){hideBroadcastCommentContextMenu();go(goBtn.dataset.go);return}
if(!e.target.closest("#broadcast-comment-context"))hideBroadcastCommentContextMenu();
const b=e.target.closest("button");if(!b)return;
window.KananeoUiHealth?.trackAction(b.textContent);
if(b.hasAttribute("data-ncv-order-move")){
 broadcastCommentViewDraft=readBroadcastCommentViewDraftFromControls();
 const key=b.dataset.ncvColumnOrder,direction=b.dataset.ncvOrderMove,index=broadcastCommentViewDraft.order.indexOf(key),nextIndex=index+(direction==="up"?-1:1);
 if(index>=0&&nextIndex>=0&&nextIndex<broadcastCommentViewDraft.order.length){
  const order=[...broadcastCommentViewDraft.order];[order[index],order[nextIndex]]=[order[nextIndex],order[index]];
  broadcastCommentViewDraft={...broadcastCommentViewDraft,order};renderBroadcastCommentSettingsControls();
 }
 return;
}
if(b.hasAttribute("data-ncv-display-save")){saveBroadcastCommentViewSettings();return;}
if(b.hasAttribute("data-ncv-display-reset")){resetBroadcastCommentViewSettings();return;}
if(b.hasAttribute("data-remote-audit-refresh")){void refreshRemoteAudit();return;}
if(b.hasAttribute("data-remote-audit-export")){const result=await window.kananeoApp.remote.exportAudit(remoteAuditFilters);if(result?.ok)toast("CSVを書き出しました（"+result.count+"件）。");else if(result?.code!=="CANCELLED")toast(result?.message||"CSVを書き出せませんでした。");return;}
if(b.hasAttribute("data-remote-audit-clear")){if(confirm("監査ログをすべて消去しますか？")){const result=await window.kananeoApp.remote.clearAudit();if(result?.ok){remoteAuditEntries=[];renderRemoteAuditRows();toast("監査ログを消去しました。");}else toast(result?.message||"消去できませんでした。");}return;}
if(b.hasAttribute("data-remote-start")){void startRemoteControlFromUi("localhost");return;}
if(b.hasAttribute("data-remote-start-lan")){void startRemoteControlFromUi("lan");return;}
if(b.hasAttribute("data-remote-choose-cert")){void chooseRemoteTlsFile("certificate");return;}
if(b.hasAttribute("data-remote-choose-key")){void chooseRemoteTlsFile("privateKey");return;}
if(b.hasAttribute("data-remote-refresh-lan")){void refreshRemoteLanOptions();return;}
if(b.hasAttribute("data-remote-stop")){void stopRemoteControlFromUi();return;}
if(b.hasAttribute("data-remote-refresh")){void refreshRemoteControlUi();return;}
if(b.hasAttribute("data-remote-pair-create")){void createRemotePairingFromUi();return;}
if(b.hasAttribute("data-remote-open-controller")){const result=await window.kananeoApp.remote.openController();if(!result?.ok)toast(result?.message||"操作画面を開けませんでした。");return;}
if(b.hasAttribute("data-remote-revoke")){void revokeRemoteDeviceFromUi(b.dataset.remoteRevoke);return;}
if(b.hasAttribute("data-remote-copy-code")){if(remoteControlUi.pairingCode){const result=await window.kananeoApp.niconico.copyText(remoteControlUi.pairingCode);toast(result?.ok?"ペアリングコードをコピーしました。":"コードをコピーできませんでした。");}return;}
if(b.hasAttribute("data-remote-copy-url")){const url=remoteControlUi.status.url;if(url){const result=await window.kananeoApp.niconico.copyText(url);toast(result?.ok?"URLをコピーしました。":"URLをコピーできませんでした。");}return;}
if(b.hasAttribute("data-broadcast-context-action")){void handleBroadcastCommentContextAction(b.dataset.broadcastContextAction);return;}
if(b.hasAttribute("data-nico-login")){window.kananeoApp.niconico.openLogin().then(()=>toast("ニコニコ公式ログイン画面を開きました"));return;}
if(b.hasAttribute("data-auto-next-check")){void checkAutoNextFrame(true);return;}
if(b.hasAttribute("data-program-start")||b.hasAttribute("data-program-end")){
 const action=b.hasAttribute("data-program-start")?"start":"end";
 const id=document.getElementById("broadcast-manage-id")?.value?.trim()||state.lastProgramId||"";
 if(!/^lv\d{1,20}$/i.test(id)){toast("管理する放送IDを確認してください。");return;}
 const label=action==="start"?"開始":"終了";
 if(!confirm("放送 "+id+" を"+label+"します。ニコニコ側で実際に番組状態が変更されます。続けますか？"))return;
 const response=await window.kananeoApp.niconico.controlProgram(id,action);
 toast(response?.message||(label+"の操作に失敗しました。"));
 if(response?.ok)await adoptCreatedBroadcast(id);
 return;
}
if(b.hasAttribute("data-create-program-in-app")){
 const title=document.getElementById("create-program-title")?.value?.trim()||"";
 const description=document.getElementById("create-program-description")?.value||"";
 const category=document.getElementById("create-program-category")?.value?.trim()||"";
 const tags=(document.getElementById("create-program-tags")?.value||"").split(/[,、]/).map(x=>x.trim()).filter(Boolean);
 const isMemberOnly=document.getElementById("create-program-member-only")?.checked===true;
 if(!title||!category){toast("番組タイトルとカテゴリを入力してください。");return;}
 if(!confirm("ニコニコに番組「"+title+"」を"+(isMemberOnly?"会員限定":"一般公開")+"で作成します。\n\n番組の公開範囲と内容を確認してください。作成後の取り消しは自動では行いません。続けますか？"))return;
 const button=document.querySelector("[data-create-program-in-app]");if(button)button.disabled=true;
 try{
  const result=await window.kananeoApp.niconico.createProgramInApp({title,description,category,tags,isMemberOnly,confirmed:true});
  toast(result?.message||"番組作成の結果を確認できませんでした。");
  if(result?.ok&&result.programId){
   await adoptCreatedBroadcast(result.programId);
   if(state.automation.autoStartProgram)void maybeStartNewProgram(result.programId);
   render();
  }
 }catch{toast("番組作成の通信に失敗しました。再送せず、自分の番組履歴を確認してください。");}
 finally{if(button&&button.isConnected)button.disabled=false;}
 return;
}
if(b.hasAttribute("data-broadcast-create")){
 const result=await window.kananeoApp.niconico.openBroadcastCreate();
 toast(result?.ok?"アプリ内に番組作成画面を開きました。内容を確認して作成してください。":(result?.message||"番組作成画面を開けませんでした。"));
 return;
}
if(b.hasAttribute("data-live-video-open")){
 const id=document.getElementById("broadcast-watch-id")?.value.trim()||state.lastProgramId||commentConnection.programId||"";
 if(!id){toast("放送IDまたは番組URLを入力してください。");return;}
 const button=document.querySelector("[data-live-video-open]");if(button)button.disabled=true;
 liveVideoState={open:true,status:"loading",programId:id,message:"ニコニコ生放送の映像ページを読み込んでいます。"};
 updateBroadcastLivePanel();
 try{
  const result=await window.kananeoApp.niconico.openLiveVideo(id);
  if(!result?.ok)throw new Error(result?.message||"放送画面を開けませんでした。");
  liveVideoState={open:true,status:"loading",programId:result.programId||id,message:result.message||"放送画面を読み込んでいます。"};
  updateLiveVideoBounds();updateBroadcastLivePanel();
 }catch(error){
  liveVideoState={open:false,status:"error",programId:id,message:error?.message||"放送画面を開けませんでした。"};
  updateBroadcastLivePanel();toast(liveVideoState.message);
 }finally{if(button)button.disabled=false;}
 return;
}
if(b.hasAttribute("data-live-video-close")){
 const result=await window.kananeoApp.niconico.closeLiveVideo();
 if(result?.ok){liveVideoState={open:false,status:"closed",programId:"",message:"放送画面を閉じました。"};lastLiveVideoBoundsKey="";updateBroadcastLivePanel();updateLiveVideoBounds();}
 else toast(result?.message||"放送画面を閉じられませんでした。");
 return;
}
if(b.hasAttribute("data-broadcast-own-fetch")||b.hasAttribute("data-stream-monitor-own-fetch")){await refreshOwnBroadcast(true);return;}
 if(b.hasAttribute("data-stream-monitor-save")){saveStreamMonitorSettings();return;}
if(b.hasAttribute("data-stream-monitor-start")){startStreamMonitor();return;}
if(b.hasAttribute("data-stream-monitor-stop")){stopStreamMonitor();return;}
if(b.hasAttribute("data-own-monitor-check")){const result=await window.kananeoApp.niconico.checkOwnMonitor?.();if(result?.phase)applyOwnMonitorStatus(result);return;}
if(b.hasAttribute("data-stream-monitor-check")){void runStreamMonitorCheck(true);void window.kananeoApp.niconico.checkRegisteredUserMonitor?.();return;}
if(b.hasAttribute("data-broadcast-comment-start")){
 const id=document.getElementById("broadcast-watch-id")?.value.trim()||state.lastProgramId||"";
 if(!id){toast("コメント受信する放送IDを入力してください。");return;}
 void startComments(id);return;
}
if(b.hasAttribute("data-broadcast-comment-stop")){void stopComments();return;}
if(b.hasAttribute("data-broadcast-comment-clear-user")){broadcastCommentUserId="";renderBroadcastComments();return;}
if(b.hasAttribute("data-broadcast-user")){broadcastCommentUserId=b.dataset.broadcastUser||"";renderBroadcastComments();return;}
if(b.hasAttribute("data-broadcast-comments-copy")){void copyBroadcastComments();return;}
if(b.hasAttribute("data-broadcast-verify")){void verifyBroadcastManageTarget();return;}
if(b.hasAttribute("data-broadcast-manage")){
 const id=document.getElementById("broadcast-manage-id")?.value.trim()||"";
 if(!window.KananeoBroadcastManagement.isBroadcastVerificationFresh(broadcastManageVerification,id)){
  renderBroadcastManageVerification();toast("先に放送ID・現在の状態を確認してください。");return;
 }
 const info=broadcastManageVerification;
 const prompt="番組管理画面を開きます。\n\n"+info.title+"（"+info.programId+"）\n現在の状態："+info.statusLabel+"\n\n配信終了はニコニコ公式画面で最終確認して実行してください。続けますか？";
 if(!confirm(prompt))return;
 const result=await window.kananeoApp.niconico.openBroadcastManage(id);
 toast(result?.ok?"アプリ内に番組管理画面を開きました。公式画面で必要な操作を行ってください。":(result?.message||"番組管理画面を開けませんでした。"));
 return;
}
if(b.hasAttribute("data-nico-refresh")){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus);return;}
if(b.hasAttribute("data-nico-logout")){if(confirm("このアプリ専用のニコニコセッションを削除しますか？")){clearQuoteAutoTimer("ログアウトのため引用再生の自動次動画を停止しました。");state.playback.quoteAutoNext=false;save();window.kananeoApp.niconico.logout().then(r=>{toast(r.message);return window.kananeoApp.niconico.getSessionStatus()}).then(applyNicoStatus);}return;}
if(b.hasAttribute("data-nico-check")){void checkProgram();return;}
if(b.hasAttribute("data-dashboard-refresh")){void refreshDashboardStatistics(false);return;}
if(b.hasAttribute("data-extension-check")){void refreshExtensionOptions();return;}
if(b.hasAttribute("data-release-history-refresh")){void fetchReleaseHistory(true);return;}
if(b.hasAttribute("data-release-history-more")){void fetchReleaseHistory();return;}
if(b.hasAttribute("data-release-history-open")){
 const result=await window.kananeoApp.updates.openRelease(b.dataset.releaseHistoryOpen);
 if(!result?.ok)toast(result?.message||"リリース詳細を開けませんでした。");
 return;
}
if(b.hasAttribute("data-update-notice-action")){
 const action=b.dataset.updateNoticeAction;
 if(action==="apply")void applyDownloadedUpdate();
 else if(action==="check")void manuallyCheckAutoUpdate();
 else if(action==="releases"){
  const result=await window.kananeoApp.updates.openReleases();
  if(!result?.ok)toast(result?.message||"配布ページを開けませんでした。");
 }
 return;
}
if(b.hasAttribute("data-update-check")){void checkForApplicationUpdates();return;}
if(b.hasAttribute("data-update-auto-check")){void manuallyCheckAutoUpdate();return;}
if(b.hasAttribute("data-update-auto-apply")){void applyDownloadedUpdate();return;}
if(b.hasAttribute("data-update-diagnostic-copy")){void copyUpdateDiagnostic();return;}
if(b.hasAttribute("data-bgm-add-files")){
 b.disabled=true;
 try{
  const result=await window.kananeoApp.bgm.addFiles();
  if(!result?.ok)throw new Error(result?.message||"BGMを追加できませんでした。");
  if(result.canceled)return;
  bgmTracks=Array.isArray(result.tracks)?result.tracks:[];
  bgmError="";
  if(page==="player")render();
  toast("BGMを追加しました："+(result.added||0)+" 曲"+(result.skipped?" / 対象外 "+result.skipped+" 件":""));
 }catch(error){toast(error?.message||"BGMを追加できませんでした。");}
 finally{if(page==="player")render();}
 return;
}
if(b.hasAttribute("data-bgm-play")){void playBgmTrack(b.dataset.bgmPlay);return;}
if(b.hasAttribute("data-bgm-toggle")){void toggleBgmPlayback();return;}
if(b.hasAttribute("data-bgm-next")){void playNextBgmTrack(false);return;}
if(b.hasAttribute("data-bgm-prev")){void playPreviousBgmTrack();return;}
if(b.hasAttribute("data-bgm-stop")){stopBgmPlayback();return;}
if(b.hasAttribute("data-bgm-move")){
 const id=b.dataset.bgmId,direction=b.dataset.bgmMove;
 b.disabled=true;
 try{
  const result=await window.kananeoApp.bgm.move(id,direction);
  if(!result?.ok)throw new Error(result?.message||"BGMの順番を変更できませんでした。");
  bgmTracks=Array.isArray(result.tracks)?result.tracks:[];
  bgmError="";
  if(page==="player")render();
 }catch(error){toast(error?.message||"BGMの順番を変更できませんでした。");}
 return;
}
if(b.hasAttribute("data-bgm-remove")){
 const id=b.dataset.bgmRemove,target=bgmTracks.find(track=>track.id===id);
 if(!target)return;
 if(!confirm("BGM「"+target.name+"」をプレイリストとアプリ内保存先から削除しますか？"))return;
 if(bgmCurrentId===id){if(bgmAudio){bgmAudio.pause();bgmAudio.removeAttribute("src");bgmAudio.load();}bgmCurrentId="";}
 const result=await window.kananeoApp.bgm.remove(id);
 if(!result?.ok){toast(result?.message||"BGMを削除できませんでした。");return;}
 bgmTracks=Array.isArray(result.tracks)?result.tracks:[];
 bgmError="";
 if(page==="player")render();
 toast("BGMを削除しました。");
 return;
}
if(b.hasAttribute("data-update-open-releases")){const result=await window.kananeoApp.updates.openReleases();toast(result?.ok?"GitHub Releasesを開きました。":result?.message||"GitHub Releasesを開けませんでした。");return;}
if(b.hasAttribute("data-library-refresh")){void refreshVideoLibrary();return;}if(b.hasAttribute("data-library-browse")){
const type=document.getElementById("library-import-type")?.value||"";
const listId=document.getElementById("library-import-id")?.value.trim()||"";
if(!["watch-later","mylist","series"].includes(type)){toast("一覧の選択取り込みでは、あとで見る・マイリスト・シリーズを選んでください。");return;}
if(type!=="watch-later"&&!listId){toast("マイリストまたはシリーズのURL・IDを入力してください。");return;}
librarySourceLoading=true;librarySourceEntries=[];librarySourceSelected=new Set();librarySourceTitle="";librarySourceQuery="";librarySourceType=type;librarySourceLimited=false;renderLibrarySourcePreview();b.disabled=true;
try{
const result=await window.kananeoApp.videoLibrary.list({type,listId});
if(!result?.ok)throw new Error(result?.message||"動画一覧を取得できませんでした。");
librarySourceEntries=Array.isArray(result.entries)?result.entries:[];
librarySourceTitle=result.sourceTitle||"";
librarySourceType=result.sourceType||type;
librarySourceLimited=result.limited===true;
if(!librarySourceEntries.length)toast("一覧に取り込める動画がありませんでした。");
else toast(result.count+" 件の動画を一覧表示しました。必要な動画にチェックを入れてください。");
}catch(error){librarySourceEntries=[];toast(error?.message||"動画一覧を取得できませんでした。");}
finally{librarySourceLoading=false;b.disabled=false;renderLibrarySourcePreview();}
return;
}
if(b.hasAttribute("data-library-source-all")){for(const item of getFilteredLibrarySourceEntries())librarySourceSelected.add(item.videoId);renderLibrarySourcePreview();return;}
if(b.hasAttribute("data-library-source-none")){librarySourceSelected.clear();renderLibrarySourcePreview();return;}
if(b.hasAttribute("data-library-source-import")){
const entries=librarySourceEntries.filter(item=>librarySourceSelected.has(item.videoId));
if(!entries.length){toast("取り込む動画を選択してください。");return;}
b.disabled=true;
try{
const result=await window.kananeoApp.videoLibrary.importSelected({sourceType:librarySourceType,entries});
if(!result?.ok)throw new Error(result?.message||"選択した動画を保存できませんでした。");
videoLibraryData=result.library;librarySourceSelected.clear();librarySource=librarySourceType;
state.logs.unshift("一覧から動画を選択して取り込み："+(result.added||0)+" 件追加");save();render();renderVideoLibraryRows();
toast("選択取り込み完了：新規 "+(result.added||0)+" 件、重複統合 "+(result.updated||0)+" 件、除外 "+(result.skipped||0)+" 件");
}catch(error){toast(error?.message||"選択した動画を保存できませんでした。");}
finally{b.disabled=false;renderLibrarySourcePreview();}
return;
}

if(b.hasAttribute("data-library-export")){exportVideoLibrary();return;}
if(b.hasAttribute("data-library-play")){void playLibraryVideo(b.dataset.libraryPlay);return;}
if(b.hasAttribute("data-library-edit")){libraryEditId=b.dataset.libraryEdit;renderVideoLibraryRows();return;}
if(b.hasAttribute("data-library-edit-cancel")){libraryEditId="";renderVideoLibraryRows();return;}
if(b.hasAttribute("data-library-delete")){
const id=b.dataset.libraryDelete;
if(confirm(id+" を動画ライブラリから削除しますか？")){
const result=await window.kananeoApp.videoLibrary.remove({videoId:id});
if(result?.ok){videoLibraryData=result.library;render();renderVideoLibraryRows();toast("動画をライブラリから削除しました。");}
else toast(result?.message||"動画を削除できませんでした。");
}
return;
}
if(b.hasAttribute("data-library-clear-history")){
if(confirm("動画の再生履歴をすべて消去しますか？")){
const result=await window.kananeoApp.videoLibrary.clearHistory();
if(result?.ok){videoLibraryData=result.library;render();toast("再生履歴を消去しました。");}
else toast(result?.message||"再生履歴を消去できませんでした。");
}
return;
}
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
if(b.hasAttribute("data-poll-duration-fetch")){
 const id=String(quotePlayback.videoId||state.player.quoteVideoId||"");
 if(!id){toast("先にニコ生で引用再生中の動画を確認してください。");return;}
 const ok=await ensureCurrentQuoteDuration({force:true});
 toast(ok?"動画の長さを取得して保存しました。":(quoteMetadataMessage||"取得できませんでした。")+" 動画時間を手動で入力してください。");
 return;
}
if(b.hasAttribute("data-poll-duration-set")){
 const seconds=Number(document.getElementById("poll-manual-duration")?.value);
 const id=String(quotePlayback.videoId||state.player.quoteVideoId||"");
 if(!quotePlayback.active||!/^(?:sm|nm|so)\d{1,12}$/.test(id)){toast("先に動画の引用再生状態を確認してください。");return;}
 if(!Number.isInteger(seconds)||seconds<1||seconds>86400){toast("動画の長さを1〜86400秒で入力してください。");return;}
 const item=[...state.requests,...state.stocks].find(x=>x.videoId===id);
 if(item)item.lengthMs=seconds*1000;
 state.player.quoteDurationMs=seconds*1000;save();
 if(state.player.quoteStartedAt>0&&state.playback.quoteAutoNext&&!pollRuntime.active)
  scheduleQuoteAutoNext(item||{videoId:id,lengthMs:seconds*1000},state.player.quoteStartedAt);
 toast("動画の長さを"+seconds+"秒に設定しました。");
 return;
}
if(b.hasAttribute("data-poll-start")){void startAutomaticPoll();return;}
if(b.hasAttribute("data-poll-stop")){
 // Stop only the current poll. The persistent auto-on-quote preference is
 // controlled by its checkbox and must survive the next video transition.
 cancelPendingAutoPoll();
 void stopAutomaticPoll();return;
}
if(b.hasAttribute("data-comment-start")){void startComments();return;}
if(b.hasAttribute("data-comment-stop")){void stopComments();return;}
if(b.hasAttribute("data-comment-copy")){void copyVisibleComments();return;}
if(b.hasAttribute("data-comment-open-folder")){window.kananeoApp.niconico.openCommentFolder().then(r=>toast(r?.message||"保存先フォルダを開けませんでした。"));return;}
if(b.hasAttribute("data-comment-csv")){exportCommentsCsv();return;}
if(b.hasAttribute("data-comment-clear")){receivedComments=[];renderComments();toast("コメント表示をクリアしました。");return;}
if(b.hasAttribute("data-save-poll")){savePollSettings();toast("アンケート設定を保存しました");}
if(b.hasAttribute("data-save-auto")){
 const enableAutoCreate=document.querySelector('[data-toggle="auto-create-next"]')?.checked===true;
 if(enableAutoCreate&&!state.automation.autoCreate&&!confirm("前枠の放送内容を引き継ぎ、終了時にニコニコへ新しい番組を自動作成します。公式APIの変更などで失敗する可能性があります。有効化しますか？"))return;
 state.automation.autoCreate=enableAutoCreate;
 state.automation.autoNext=document.querySelector('[data-toggle="auto-next"]').checked||enableAutoCreate;
 state.automation.keepPosition=document.querySelector('[data-toggle="keep-position"]').checked;
 state.automation.autoExtend=document.querySelector('[data-toggle="auto-extend"]').checked;
 state.automation.adjustVideo=document.querySelector('[data-toggle="adjust-video"]').checked;
 state.automation.extend=+document.getElementById("extend").value||30;
 save();void syncAutoNextSettings();render();toast(enableAutoCreate?"前枠引き継ぎ自動作成を有効にしました。":"自動化設定を保存しました。");
}
if(b.hasAttribute("data-save-paths")){state.external={obs:document.getElementById("obs").value,nair:document.getElementById("nair").value,xsplit:document.getElementById("xsplit").value};save();toast("外部ツールのパスを保存しました");}
if(b.hasAttribute("data-up")){let i=+b.dataset.up;if(i>0)[state.requests[i-1],state.requests[i]]=[state.requests[i],state.requests[i-1]];save();render()}
if(b.hasAttribute("data-down")){let i=+b.dataset.down;if(i<state.requests.length-1)[state.requests[i+1],state.requests[i]]=[state.requests[i],state.requests[i+1]];save();render()}
if(b.hasAttribute("data-stock-up")){let i=+b.dataset.stockUp;if(i>0)[state.stocks[i-1],state.stocks[i]]=[state.stocks[i],state.stocks[i-1]];save();render();}
if(b.hasAttribute("data-stock-down")){let i=+b.dataset.stockDown;if(i<state.stocks.length-1)[state.stocks[i+1],state.stocks[i]]=[state.stocks[i],state.stocks[i+1]];save();render();}
if(b.hasAttribute("data-stock-remove")){state.stocks=state.stocks.filter(x=>x.id!==b.dataset.stockRemove);save();render();}
if(b.hasAttribute("data-stock-clear")){if(quotePlayback.queueType==="stock"&&quotePlayback.active){toast("引用再生を停止してからストックを消去してください。");return;}state.stocks=[];save();render();}
if(b.hasAttribute("data-remove")){const removed=state.requests.find(x=>x.id===b.dataset.remove);state.requests=state.requests.filter(x=>x.id!==b.dataset.remove);if(removed&&removed.id===state.player.currentId){state.player.currentId="";state.player.status="closed";void window.kananeoApp.niconico.closeVideo();}save();render()}
if(b.hasAttribute("data-clear")){if(state.player.currentId)void window.kananeoApp.niconico.closeVideo();state.requests=[];state.player.currentId="";state.player.status="closed";save();render()}
if(b.hasAttribute("data-voice-toggle-user")){
const userId=b.dataset.voiceToggleUser||"";
const result=window.KananeoCommentSpeech.setUserSpeechMuted(state.voice,userId);
if(!result.ok){toast(result.code==="MUTE_LIMIT"?"読み上げ除外は最大2,000人までです。":"ユーザーIDを確認してください。");return;}
state.voice=result.settings;
let removedCount=0;
let stoppedCurrent=false;
if(result.muted){
const filtered=window.KananeoCommentSpeech.removeSpeechQueueByUser(speechQueue,result.userId);
speechQueue=filtered.queue;
removedCount=filtered.removed;
stoppedCurrent=!!(speechCurrentItem&&String(speechCurrentItem.userId||"").replace(/\s+/g,"")===result.userId);
if(stoppedCurrent){stopSpeechQueue(false);speakNextComment();}
}
save();
updateSpeechQueueUi();
if(page==="comments")renderComments();
if(page==="voice")render();
if(result.muted){
const details=[];
if(removedCount)details.push("待ち行列 "+removedCount+" 件を削除");
if(stoppedCurrent)details.push("読み上げ中のコメントを停止");
toast("このユーザーを読み上げ除外しました。"+(details.length?"（"+details.join("・")+"）":""));
}else toast("このユーザーの読み上げを許可しました。");
return;
}
if(b.hasAttribute("data-voice-unmute-user")){
const result=window.KananeoCommentSpeech.setUserSpeechMuted(state.voice,b.dataset.voiceUnmuteUser,false);
if(result.ok){state.voice=result.settings;save();render();toast("このユーザーの読み上げを許可しました。");}
return;
}
if(b.hasAttribute("data-voice-clear-muted")){
state.voice=window.KananeoCommentSpeech.normalizeCommentSpeechSettings({...state.voice,mutedUserIds:[]});
save();render();toast("個別除外をすべて解除しました。");return;
}
if(b.hasAttribute("data-voice-queue-remove")){
const result=window.KananeoCommentSpeech.removeSpeechQueueItem(speechQueue,Number(b.dataset.voiceQueueRemove));
if(result.ok){speechQueue=result.queue;updateSpeechQueueUi();toast("読み上げ待ちコメントを削除しました。");}
return;
}
if(b.hasAttribute("data-voice-test")){if(!isSpeechEngineAvailable())toast("この環境では音声合成を利用できません。");else{saveVoiceSettings();speakDirect("コメント読み上げのテストです。日本語の音声を確認してください。");}return;}
if(b.hasAttribute("data-voice-pause")){if(isSpeechEngineAvailable())window.speechSynthesis.pause();return;}
if(b.hasAttribute("data-voice-resume")){if(isSpeechEngineAvailable())window.speechSynthesis.resume();return;}
if(b.hasAttribute("data-voice-clear")){speechDroppedCount=0;stopSpeechQueue(true);toast("読み上げと待ち行列を停止しました。");return;}
if(b.hasAttribute("data-user-profile-from-comment")){
const userId=b.dataset.userProfileFromComment||"";
const existing=findUserProfile(userId);
const userName=b.dataset.userName||"";
go("users");
document.getElementById("profile-user-id").value=userId;
document.getElementById("profile-nickname").value=existing?.nickname||userName;
document.getElementById("profile-memo").value=existing?.memo||"";
document.getElementById("profile-nickname").focus();
return;
}
if(b.hasAttribute("data-user-profile-edit")){
const profile=state.userProfiles[Number(b.dataset.userProfileEdit)];
if(profile){document.getElementById("profile-user-id").value=profile.userId;document.getElementById("profile-nickname").value=profile.nickname;document.getElementById("profile-memo").value=profile.memo;document.getElementById("profile-nickname").focus();}
return;
}
if(b.hasAttribute("data-user-profile-remove")){
const profile=state.userProfiles[Number(b.dataset.userProfileRemove)];
if(profile&&confirm(profile.nickname+"（"+profile.userId+"）のコテハンを削除しますか？")){
const result=window.KananeoUserProfiles.removeUserProfile(state.userProfiles,profile.userId);
state.userProfiles=result.profiles;save();render();toast("ユーザー登録を削除しました。");
}
return;
}
if(b.hasAttribute("data-user-profile-clear")){
document.getElementById("profile-user-id").value="";
document.getElementById("profile-nickname").value="";
document.getElementById("profile-memo").value="";
return;
}
if(b.hasAttribute("data-ngw")){state.ngWords.splice(+b.dataset.ngw,1);save();render()}
if(b.hasAttribute("data-ngu")){state.ngUsers.splice(+b.dataset.ngu,1);save();render()}
if(b.hasAttribute("data-track")){state.playlist.splice(+b.dataset.track,1);save();render()}
if(b.hasAttribute("data-export")){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));a.download="kananeo-settings.json";a.click();URL.revokeObjectURL(a.href)}
if(b.hasAttribute("data-clear-logs")){state.logs=[];save();render()}
if(b.hasAttribute("data-placeholder"))toast("現在の段階ではこの操作は未実装です。");
}
 document.addEventListener("click",e=>{const marker=e.target.closest("[data-broadcast-read-through]");if(marker){broadcastReadThroughIndex=Number(marker.dataset.broadcastReadThrough);renderBroadcastComments();}});
 document.addEventListener("dblclick",e=>{if(e.target.closest("[data-broadcast-read-through]")){broadcastReadThroughIndex=-1;renderBroadcastComments();}});
document.addEventListener("input",e=>{if(e.target.id==="release-history-search"){releaseHistoryState.query=e.target.value.slice(0,150);renderReleaseHistoryRows();}if(["remote-audit-query","remote-audit-type","remote-audit-from","remote-audit-to"].includes(e.target.id)){remoteAuditFilters={query:document.getElementById("remote-audit-query")?.value||"",type:document.getElementById("remote-audit-type")?.value||"all",from:document.getElementById("remote-audit-from")?.value||"",to:document.getElementById("remote-audit-to")?.value||""};renderRemoteAuditRows();}if(e.target.id==="ncv-comment-font-size"){const output=document.getElementById("ncv-comment-font-size-value");if(output)output.textContent=e.target.value+"px";}if(e.target.id==="broadcast-comment-search"){broadcastCommentSearch=e.target.value;renderBroadcastComments();}if(e.target.id==="broadcast-manage-id"){broadcastManageVerification=null;renderBroadcastManageVerification();}if(e.target.id==="comments-search")renderComments();if(e.target.id==="user-profile-search"){userProfileSearch=e.target.value;renderUserProfileRows();}if(e.target.id==="library-search")renderVideoLibraryRows();if(e.target.id==="library-source-search"){librarySourceQuery=e.target.value;renderLibrarySourcePreview();}});
document.addEventListener("input",e=>{
 if(e.target.id==="bgm-volume"){state.playback.bgmVolume=clampBgmVolume(e.target.value);if(bgmAudio)bgmAudio.volume=state.playback.bgmVolume;updateBgmPlaybackUi();}
 if(e.target.id==="bgm-progress"&&bgmAudio&&Number.isFinite(bgmAudio.duration)){bgmAudio.currentTime=bgmAudio.duration*(Math.max(0,Math.min(1000,Number(e.target.value)||0))/1000);updateBgmPlaybackUi();}
});
document.addEventListener("change",e=>{
 if(e.target.id==="poll-announce-results"){
  state.poll.announceResults=e.target.checked===true;
  save();
  toast(e.target.checked?"投票結果の運営コメント通知をONにしました。":"投票結果の運営コメント通知をOFFにしました。");
  return;
 }
 if(e.target.id==="poll-auto-on-quote"){
  if(e.target.checked&&!state.poll.autoOnQuote&&
   !confirm("アプリから動画を引用再生するたびに、視聴者向けアンケートを自動で開始します。有効にしますか？")){
   e.target.checked=false;return;
  }
  state.poll.autoOnQuote=e.target.checked===true;
  if(!state.poll.autoOnQuote){
   autoPollWaitingForRequestKey="";
   cancelPendingAutoPoll();
   if(pollStartPending&&!pollRuntime.active)pollRunToken++;
  }else if(quotePlayback.active){
   // Enabling auto mode after a quote has started must also subscribe to
   // the next accepted request, instead of waiting for another video.
   if(window.KananeoPollNotices.hasPendingRequests(state.requests))
    scheduleAutoPollOnQuote(quotePlayback.programId,quotePlayback.videoId,state.player.quoteStartedAt);
   else markAutoPollWaitingForRequests(quotePlayback.programId,quotePlayback.videoId,state.player.quoteStartedAt);
  }
  save();toast(state.poll.autoOnQuote?"引用再生連動アンケートをONにしました。":"引用再生連動アンケートをOFFにしました。");
  return;
 }
 if(e.target.id==="request-auto-on-live"){
  const enabled=e.target.checked===true;
  if(enabled&&!state.playback.autoPlayOnOwnLive&&!confirm("自分の番組開始を検知したら、視聴者へ動画リクエストを自動で引用再生します。有効にしますか？")){e.target.checked=false;return;}
  state.playback.autoPlayOnOwnLive=enabled;
  setAutoLiveQuoteMessage(enabled?"自分の放送開始を確認しています。":"自動再生はOFFです。");
  // Keep the attempted program ID even if this switch is toggled during the same live.
  save();toast(enabled?"放送開始時の動画自動再生をONにしました。":"放送開始時の動画自動再生をOFFにしました。");
  if(enabled){for(const item of ownMonitorStatus.activePrograms||[])void maybeAutoPlayOnOwnLive(item);}
 }
});
document.addEventListener("change",e=>{if(e.target.id==="release-history-type"){releaseHistoryState.type=e.target.value;renderReleaseHistoryRows();}if(e.target.id==="stream-monitor-interval"||e.target.id==="stream-monitor-auto-comments"){if(e.target.id==="stream-monitor-interval")state.streamMonitor.intervalSeconds=Number(e.target.value)||60;else state.streamMonitor.autoComments=e.target.checked;save();}if(e.target.id==="remote-audit-notification-enabled"){const enabled=e.target.checked;void window.kananeoApp.remote.setNotificationSettings({enabled}).then(result=>{if(result?.ok){remoteAuditNotificationEnabled=enabled;toast(enabled?"異常アクセス通知をONにしました。":"異常アクセス通知をOFFにしました。");}else{e.target.checked=remoteAuditNotificationEnabled;toast(result?.message||"通知設定を保存できませんでした。");}}).catch(()=>{e.target.checked=remoteAuditNotificationEnabled;toast("通知設定を保存できませんでした。");});}});
document.addEventListener("change",e=>{if(e.target.id==="broadcast-comment-type"){broadcastCommentType=e.target.value;renderBroadcastComments();}if(e.target.id==="library-sort"){librarySort=e.target.value;renderVideoLibraryRows();}if(e.target.id==="library-source"){librarySource=e.target.value;renderVideoLibraryRows();}});
document.addEventListener("change",e=>{if(e.target.matches("[data-library-source-check]")){const id=e.target.dataset.librarySourceCheck;if(e.target.checked)librarySourceSelected.add(id);else librarySourceSelected.delete(id);const count=document.getElementById("library-source-selection-count");if(count)count.textContent=librarySourceSelected.size+" 件を選択中";const button=document.querySelector("[data-library-source-import]");if(button){button.disabled=librarySourceSelected.size===0;button.textContent="選択した "+librarySourceSelected.size+" 件を取り込む";}}});
document.addEventListener("change",e=>{if(e.target.id==="bgm-volume"){state.playback.bgmVolume=clampBgmVolume(e.target.value);save();}if(e.target.id==="bgm-repeat"){state.playback.bgmRepeat=e.target.checked;save();toast(e.target.checked?"BGMを最後の曲から先頭へ繰り返します。":"BGMの繰り返しをOFFにしました。");}if(e.target.matches('[data-toggle="quote-auto-next"]')){if(state.playback.playStyle===0&&e.target.checked){e.target.checked=false;state.playback.quoteAutoNext=false;save();toast("手動モードでは自動次動画を使えません。自動順次または自動ランダムに変更してください。");return;}state.playback.quoteAutoNext=e.target.checked;save();if(e.target.checked&&quotePlayback.active){const active=currentQueueItem();const started=Number(state.player.quoteStartedAt);if(started>0)scheduleQuoteAutoNext(active||{videoId:quotePlayback.videoId,lengthMs:state.player.quoteDurationMs},started);else{quoteAutoMessage="引用再生の開始時刻が不明です。次の動画から自動予約します。";updateQuoteScheduleUi();}}else clearQuoteAutoTimer("引用再生の自動次動画はOFFです。");toast(e.target.checked?"引用再生の自動次動画をONにしました。":"引用再生の自動次動画をOFFにしました。");}if(e.target.id==="comments-filter")renderComments();if(e.target.id==="player-auto-next"){state.player.autoNext=e.target.checked;save();toast(e.target.checked?"自動で次の動画へ切り替えます。":"自動次動画切替をOFFにしました。");}if(e.target.id==="request-from-comments"){state.requestSettings.acceptComments=e.target.checked;save();toast(e.target.checked?"コメントからのリクエスト受付をONにしました。":"コメントからのリクエスト受付をOFFにしました。");}if(e.target.id==="request-max-per-user"){state.requestSettings.maxPerUser=Math.min(50,Math.max(1,Number(e.target.value)||5));save();toast("ユーザー別リクエスト上限を保存しました。");}if(e.target.id==="request-reply-enabled"){state.requestSettings.replyEnabled=e.target.checked;save();toast(e.target.checked?"受付結果の自動返信をONにしました。":"受付結果の自動返信をOFFにしました。");}if(e.target.id==="request-reply-accepted"){state.requestSettings.replyAccepted=Array.from(String(e.target.value||"")).slice(0,80).join("");save();}if(e.target.id==="request-reply-rejected"){state.requestSettings.replyRejected=Array.from(String(e.target.value||"")).slice(0,80).join("");save();}});
document.addEventListener("submit",e=>{void handleUiSubmit(e).catch(error=>window.KananeoUiHealth?.report(error,"入力・保存操作"));});
async function handleUiSubmit(e){
e.preventDefault();
window.KananeoUiHealth?.trackAction("フォーム送信："+e.target.id);
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
state.requests.push(item);state.logs.unshift("動画をキューに追加："+item.title);save();
resumeAutoPollAfterRequestAccepted();
render();toast("動画をキューに追加しました。");
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
if(e.target.id==="library-add-form"){
const videoId=document.getElementById("library-video-id").value.trim();
const title=document.getElementById("library-title").value.trim();
const durationSeconds=Math.max(0,Number(document.getElementById("library-duration").value)||0);
if(!videoId){toast("動画IDまたはURLを入力してください。");return;}
const result=await window.kananeoApp.videoLibrary.add({videoId,title,lengthMs:durationSeconds*1000});
if(result?.ok){videoLibraryData=result.library;state.logs.unshift("動画ライブラリへ追加："+videoId);save();render();renderVideoLibraryRows();toast("動画をライブラリに追加しました。");}
else toast(result?.message||"動画を登録できませんでした。");
}
if(e.target.id==="library-edit-form"){
const videoId=e.target.dataset.videoId;
const title=document.getElementById("library-edit-title").value;
const tags=document.getElementById("library-edit-tags").value;
const memo=document.getElementById("library-edit-memo").value;
try{
const result=await window.kananeoApp.videoLibrary.update({videoId,title,tags,memo});
if(!result?.ok){toast(result?.message||"動画情報を保存できませんでした。");return;}
videoLibraryData=result.library;libraryEditId="";state.logs.unshift("動画ライブラリ情報を編集："+videoId);save();render();renderVideoLibraryRows();toast("動画情報を保存しました。");
}catch{toast("動画情報を保存できませんでした。");}
}
if(e.target.id==="library-import-form"){
const type=document.getElementById("library-import-type").value;
const listId=document.getElementById("library-import-id").value.trim();
const textValue=document.getElementById("library-import-text").value;
if((type==="mylist"||type==="series")&&!listId){toast("一覧URLまたはIDを入力してください。");return;}
if((type==="text"||type==="json")&&!textValue.trim()){toast("取り込むテキストまたはJSONを入力してください。");return;}
const submitButton=e.target.querySelector('button[type="submit"],button:not([type])');
if(submitButton)submitButton.disabled=true;
try{
const result=await window.kananeoApp.videoLibrary.import(type==="text"||type==="json"?{type,text:textValue}:{type,listId});
if(!result?.ok){toast(result?.message||"動画を取り込めませんでした。");return;}
videoLibraryData=result.library;
state.logs.unshift("動画ライブラリ取り込み："+type+" / 追加 "+result.added+" 件");save();render();renderVideoLibraryRows();
toast("取り込み完了：新規 "+(result.added||0)+" 件、重複統合 "+(result.updated||0)+" 件、履歴追加 "+(result.historyImported||0)+" 件、除外 "+(result.skipped||0)+" 件");
}catch{toast("動画一覧の取り込みに失敗しました。通信とログイン状態を確認してください。");}
finally{if(submitButton)submitButton.disabled=false;}
}
if(e.target.id==="voice-settings-form"){saveVoiceSettings();}
if(e.target.id==="user-profile-form"){
const userId=document.getElementById("profile-user-id").value;
const nickname=document.getElementById("profile-nickname").value;
const memo=document.getElementById("profile-memo").value;
const result=window.KananeoUserProfiles.upsertUserProfile(state.userProfiles,{userId,nickname,memo});
if(!result.ok){toast(result.code==="PROFILE_LIMIT"?"登録ユーザー数が上限です。":"ユーザーIDとコテハンを入力してください。");return;}
state.userProfiles=result.profiles;state.logs.unshift("コテハンを登録・更新："+result.profile.nickname+" / "+result.profile.userId);save();render();toast("コテハンを保存しました。");
}
if(e.target.id==="ng-word-form"){state.ngWords.push(document.getElementById("ng-word").value.trim());save();render()}
if(e.target.id==="ng-user-form"){state.ngUsers.push(document.getElementById("ng-user").value.trim());save();render()}
if(e.target.id==="track-form"){state.playlist.push(document.getElementById("track").value.trim());save();render()}
}
document.addEventListener("change",e=>{
 if(e.target.id==="stock-auto-play"){
  state.playback.stockAutoPlay=e.target.checked;
  if(e.target.checked){state.playback.quoteAutoNext=true;if(state.playback.playStyle===0)state.playback.playStyle=1;}
  save();toast(e.target.checked?"ストックの自動再生を有効にしました。":"ストックの自動再生を無効にしました。");
 }
 if(e.target.id==="broadcast-video-zoom"){
  const choice=e.target.value;
  state.liveVideoZoom.zoomMode=choice==="auto"?"auto":"manual";
  if(choice!=="auto")state.liveVideoZoom.zoomPercent=Number(choice)||70;
  save();lastLiveVideoBoundsKey="";updateLiveVideoBounds();
  toast(choice==="auto"?"放送画面の表示倍率を自動調整にしました。":"放送画面の表示倍率 "+state.liveVideoZoom.zoomPercent+"% を保存しました。");
 }
 if(e.target.id==="auto-start-program"){
  if(e.target.checked&&!confirm("枠を作成すると自動で番組の本番開始を要求します。OBSの配信開始は別途必要です。有効にしますか？")){e.target.checked=false;return;}
  state.automation.autoStartProgram=e.target.checked;save();
  toast(e.target.checked?"新規番組の自動開始を有効にしました。":"新規番組の自動開始を無効にしました。");
 }
});
window.addEventListener("focus",()=>{if(state.streamMonitor.enabled){streamMonitorRuntime.nextCheckAt=0;void runStreamMonitorCheck(true);}});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&state.streamMonitor.enabled){streamMonitorRuntime.nextCheckAt=0;void runStreamMonitorCheck(true);}});
if(window.speechSynthesis&&typeof window.speechSynthesis.addEventListener==="function"){window.speechSynthesis.addEventListener("voiceschanged",()=>{if(page==="voice")renderSpeechVoices();});}
if(window.kananeoApp?.niconico){window.kananeoApp.niconico.getSessionStatus().then(applyNicoStatus).catch(()=>{});window.kananeoApp.niconico.onSessionChanged(applyNicoStatus);
    window.kananeoApp.niconico.onLiveVideoState(applyLiveVideoState);
    window.kananeoApp.niconico.onCreatedBroadcast?.(value=>{if(value?.programId){void adoptCreatedBroadcast(value.programId).then(()=>maybeStartNewProgram(value.programId));toast("作成した番組IDを検知："+value.programId);}});
    window.kananeoApp.niconico.onAutoNextStatus?.(applyAutoNextStatus);
    window.kananeoApp.niconico.onRegisteredUserLive?.(info=>{void onRegisteredUserLive(info);});
    window.kananeoApp.niconico.onRegisteredUserMonitorStatus?.(applyRegisteredMonitorStatus);
    window.kananeoApp.niconico.onOwnMonitorStatus?.(applyOwnMonitorStatus);
    window.kananeoApp.niconico.onOwnMonitorLive?.(info=>{void handleOwnBroadcastLive(info);});
    void window.kananeoApp.niconico.getOwnMonitorStatus?.().then(result=>{
     if(!result?.ok)return;
     applyOwnMonitorStatus(result.status);
     for(const info of result.status?.activePrograms||[])void handleOwnBroadcastLive(info);
    }).catch(()=>{});
    void syncRegisteredUserMonitor();
    void syncAutoNextSettings();
    void refreshVideoLibrary(true);
    window.kananeoApp.niconico.onComment(receiveComment);
    window.kananeoApp.niconico.onCommentState(updateCommentConnection);window.kananeoApp.niconico.onVideoState(updateVideoPlayerState);}
render();
window.KananeoUiHealth?.markReady();
void refreshBgmLibrary(true);
void refreshRemoteLanOptions();
void checkForApplicationUpdates(true);
if(window.kananeoApp?.updates?.onAutoStatus){window.kananeoApp.updates.onAutoStatus(applyAutoUpdateStatus);void window.kananeoApp.updates.getAutoStatus().then(applyAutoUpdateStatus).catch(()=>{});}
if(window.kananeoApp?.remote){window.kananeoApp.remote.onRequest(request=>{void handleRemoteControlRequest(request);});}
if(state.lastProgramId){void refreshDashboardStatistics(true);void refreshQuotePlayback({silent:true});}
setInterval(()=>{if(state.streamMonitor.enabled&&!streamMonitorRuntime.busy&&Date.now()>=streamMonitorRuntime.nextCheckAt)void runStreamMonitorCheck();updateQuoteScheduleUi();if(page==="remote"&&!remoteControlUi.loading&&Date.now()-remoteControlUi.lastRefreshAt>5000)void refreshRemoteControlUi(true);if(page==="broadcast"){renderBroadcastManageVerification();updateLiveVideoBounds();}if(page==="dashboard"){updateDashboardStatsUi();if(!dashboardStats.loading&&state.lastProgramId&&Date.now()-(Date.parse(dashboardStats.updatedAt)||0)>30000)void refreshDashboardStatistics(true);}},1000);
})();