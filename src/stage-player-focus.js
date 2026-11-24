"use strict";
// The injected function is self-contained. It neither reads credentials nor
// intercepts network requests. Only the official watch page can be focused.
function installStagePlayerFocus(){
 const here=()=>location.protocol==="https:"&&["live.nicovideo.jp","live2.nicovideo.jp"].includes(location.hostname)&&/^\/watch\/lv\d{1,20}\/?$/.test(location.pathname);
 if(!here()||window.__kananeoStageFocusInstalled)return;
 window.__kananeoStageFocusInstalled=true;
 const mark="data-kananeo-stage-focus";
 const styleId="kananeo-stage-focus-style";
 const candidates='[data-player-layout],[data-testid="player-container"],[data-testid="video-player"],[data-testid="live-player"],[class*="PlayerContainer"],[class*="VideoPlayerContainer"],[class*="LivePlayerContainer"]';
 let root=null,video=null;
 function visible(el){
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width>=120&&r.height>=68&&s.display!=="none"&&s.visibility!=="hidden";
 }
 function restore(){
  if(root)root.removeAttribute(mark);
  document.getElementById(styleId)?.remove();
  root=null;video=null;
 }
 function selectPlayer(){
  const playing=[...document.querySelectorAll("video")].filter(v=>v.readyState>=2&&!v.paused&&!v.ended&&v.videoWidth>0&&visible(v));
  playing.sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.width*y.height-x.width*x.height;});
  for(const v of playing){
   const candidate=v.closest(candidates);
   if(!candidate||candidate===document.body||candidate===document.documentElement||!visible(candidate))continue;
   if(candidate.querySelector("header,nav,main,[role=banner]"))continue;
   const r=candidate.getBoundingClientRect(),vr=v.getBoundingClientRect();
   if(vr.width*vr.height<r.width*r.height*0.25)continue;
   // Fixed positioning inside a transformed ancestor may not fill the viewport.
   // Do not change such an ancestor; preserve the official popup instead.
   let safe=true;
   for(let p=candidate.parentElement;p&&p!==document.documentElement;p=p.parentElement){
    const s=getComputedStyle(p);
    if(s.transform!=="none"||s.perspective!=="none"||s.filter!=="none"||/paint|layout|strict|content/.test(s.contain||"")){safe=false;break;}
   }
   if(safe)return {root:candidate,video:v};
  }
  return null;
 }
 function tick(){
  if(!here()){restore();return;}
  if(root&&(!root.isConnected||!video?.isConnected||!root.contains(video)||video.ended)){restore();}
  if(root)return; // Pause/resume must not cause disruptive layout changes.
  const found=selectPlayer();
  if(!found)return; // Unknown DOM, login, waiting, errors: leave the official page intact.
  const css=document.createElement("style");css.id=styleId;
  css.textContent=`
   [${mark}]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;z-index:2147483646!important;background:#000!important;overflow:hidden!important}
   [${mark}] video{object-fit:contain!important}
  `;
  (document.head||document.documentElement).appendChild(css);
  root=found.root;video=found.video;root.setAttribute(mark,"");
 }
 // Poll at a low rate so delayed media and replacement nodes are handled.
 // Each document owns its own timer; navigation disposes of it.
 setInterval(tick,1000);tick();
}
function buildStagePlayerFocusScript(){return "("+installStagePlayerFocus.toString()+")()";}
function ownLiveStageProgram(info){
 const id=String(info?.programId||"").toLowerCase();
 return /^lv\d{1,20}$/.test(id)&&["ON_AIR","ONAIR"].includes(String(info?.programStatus||"").toUpperCase())?id:"";
}
module.exports={buildStagePlayerFocusScript,ownLiveStageProgram};
