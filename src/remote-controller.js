"use strict";

(() => {
const TOKEN_KEY="kananeo.remote.token";
const PERMISSIONS_KEY="kananeo.remote.permissions";
const connection=document.getElementById("connection-state");
const pairPanel=document.getElementById("pair-panel");
const controlPanel=document.getElementById("control-panel");
const pairMessage=document.getElementById("pair-message");
const controlMessage=document.getElementById("control-message");
const statusGrid=document.getElementById("status-grid");
const commentsList=document.getElementById("comments-list");
const commentCount=document.getElementById("comment-count");
const volume=document.getElementById("bgm-volume");
const volumeValue=document.getElementById("volume-value");
let token=sessionStorage.getItem(TOKEN_KEY)||"";
let permissions=[];
let pollTimer=null;
let busy=false;

async function api(path,options={}){
 const headers={"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{})};
 const response=await fetch(path,{...options,headers,cache:"no-store",credentials:"same-origin",redirect:"error"});
 let data={};
 try{data=await response.json();}catch{}
 if(!response.ok||data.ok===false)throw new Error(data.message||"要求に失敗しました（HTTP "+response.status+"）。");
 return data;
}
function setConnection(text,active=false){connection.textContent=text;connection.classList.toggle("active",active);}
function showPair(message){pairPanel.classList.remove("hidden");controlPanel.classList.add("hidden");if(message)pairMessage.textContent=message;}
function showControls(){pairPanel.classList.add("hidden");controlPanel.classList.remove("hidden");}
function renderStatus(status){
 const comment=status.comment||{},player=status.player||{},bgm=status.bgm||{};
 const rows=[
  ["ログイン",status.authenticated?"確認済み":"未ログイン"],
  ["放送ID",status.programId||"未設定"],
  ["コメント受信",comment.stateLabel||"未接続"],
  ["表示コメント",String(comment.count??0)+"件"],
  ["プレビュー",player.stateLabel||"未起動"],
  ["BGM",bgm.stateLabel||"停止中"],
  ["再生中BGM",bgm.trackName||"未選択"]
 ];
 statusGrid.innerHTML=rows.map(([label,value])=>'<div class="status-item"><small>'+escapeHtml(label)+'</small><b>'+escapeHtml(value)+'</b></div>').join("");
 const allowed=new Set(status.permissions||permissions);
 document.getElementById("player-controls").classList.toggle("hidden",!allowed.has("player:control"));
 document.getElementById("bgm-controls").classList.toggle("hidden",!allowed.has("bgm:control"));
 document.getElementById("comments-card").classList.toggle("hidden",!allowed.has("comments:read"));
 if(typeof bgm.volume==="number"){volume.value=String(bgm.volume);volumeValue.textContent=Math.round(bgm.volume*100)+"%";}
}
function renderComments(items){
 const safe=Array.isArray(items)?items:[];
 commentCount.textContent=safe.length+"件";
 commentsList.innerHTML=safe.length?safe.map(item=>{
  return '<article class="comment"><div><b>'+escapeHtml(item.userName||"匿名")+'</b><small>'+escapeHtml(item.time||"")+'</small></div><p>'+escapeHtml(item.content||"")+'</p></article>';
 }).join(""):'<p class="hint">まだコメントはありません。</p>';
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
async function refresh(){
 if(!token||busy)return;
 busy=true;
 try{
  const result=await api("/api/status");
  renderStatus(result.status||{});
  if(permissions.includes("comments:read")){
   const comments=await api("/api/comments?limit=40");
   renderComments(comments.comments||[]);
  }
  setConnection("接続中",true);
 }catch(error){
  const message=error.message||"接続できません。";
  controlMessage.textContent=message;
  if(/認証|権限|端末/.test(message)){clearToken();showPair("認証情報が無効です。アプリ側で再度ペアリングしてください。");}
  setConnection("接続エラー");
 }finally{busy=false;}
}
function startPolling(){if(pollTimer)clearInterval(pollTimer);void refresh();pollTimer=setInterval(()=>{void refresh();},4000);}
function clearToken(){
 token="";permissions=[];sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(PERMISSIONS_KEY);
 if(pollTimer)clearInterval(pollTimer);pollTimer=null;
}
document.getElementById("pair-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const code=document.getElementById("pair-code").value.trim();
 const name=document.getElementById("device-name").value.trim();
 pairMessage.textContent="端末を登録しています…";
 try{
  const result=await api("/api/pair",{method:"POST",body:JSON.stringify({code,name})});
  token=result.token;permissions=result.device?.permissions||[];
  sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem(PERMISSIONS_KEY,JSON.stringify(permissions));
  pairMessage.textContent="ペアリングしました。";
  showControls();startPolling();
 }catch(error){pairMessage.textContent=error.message||"ペアリングできませんでした。";}
});
document.getElementById("disconnect-button").addEventListener("click",()=>{
 clearToken();showPair("このブラウザーの接続情報を消去しました。端末登録そのものを解除するにはアプリ側で失効してください。");setConnection("切断済み");
});
document.querySelectorAll("[data-command]").forEach(button=>{
 button.addEventListener("click",async()=>{
  if(!token)return;
  button.disabled=true;
  try{
   const result=await api("/api/command",{method:"POST",body:JSON.stringify({command:button.dataset.command})});
   controlMessage.textContent=result.message||"操作しました。";
   void refresh();
  }catch(error){controlMessage.textContent=error.message||"操作できませんでした。";}
  finally{button.disabled=false;}
 });
});
volume.addEventListener("change",async()=>{
 if(!token)return;
 volumeValue.textContent=Math.round(Number(volume.value)*100)+"%";
 try{
  const result=await api("/api/command",{method:"POST",body:JSON.stringify({command:"bgm:volume",payload:{value:Number(volume.value)}})});
  controlMessage.textContent=result.message||"BGM音量を変更しました。";
 }catch(error){controlMessage.textContent=error.message||"音量を変更できませんでした。";}
});
if(token){
 try{permissions=JSON.parse(sessionStorage.getItem(PERMISSIONS_KEY)||"[]");}catch{permissions=[];}
 showControls();startPolling();
}else{showPair("");setConnection("未接続");}
})();
