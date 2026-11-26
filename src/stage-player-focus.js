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
 const rejected=new WeakMap();
 const viewportKey=()=>[window.innerWidth,window.innerHeight].join("x");
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
   if(rejected.get(candidate)===viewportKey())continue;
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
 function coversViewport(el){
  const w=window.innerWidth,h=window.innerHeight;
  if(!(w>0&&h>0))return false;
  const r=el.getBoundingClientRect();
  // Check real post-layout geometry, not merely the CSS we requested.
  if(r.left>4||r.top>4||r.right<w-4||r.bottom<h-4)return false;
  // Check the rendered player is not covered by page chrome or clipped by
  // an ancestor. A player controls overlay still counts as part of the root.
  const points=[[w/2,h/2],[w*.25,h*.25],[w*.75,h*.75]];
  return points.every(([x,y])=>{
   const hit=document.elementFromPoint(x,y);
   return hit&&(hit===el||el.contains(hit));
  });
 }
 function tick(){
  if(!here()){restore();return;}
  if(root&&(!root.isConnected||!video?.isConnected||!root.contains(video)||video.ended)){restore();}
  if(root){
   // Preserve intentional pause, but roll back if the native layout is
   // obscured, clipped or no longer covers the viewport.
   if(!coversViewport(root)||!visible(video)){
    rejected.set(root,viewportKey());
    restore();
   }
   return;
  }
  const found=selectPlayer();
  if(!found)return; // Unknown DOM, login, waiting, errors: leave the official page intact.
  const css=document.createElement("style");css.id=styleId;
  css.textContent=`
   [${mark}]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;z-index:2147483646!important;background:#000!important;overflow:hidden!important}
   [${mark}] video{object-fit:contain!important}
  `;
  (document.head||document.documentElement).appendChild(css);
  root=found.root;video=found.video;root.setAttribute(mark,"");
  // Verify after browser layout. A failure returns to the untouched
  // official popup, rather than repeatedly flashing a broken overlay.
  requestAnimationFrame(()=>{if(root===found.root&&video===found.video)tick();});
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
// Never replace a manually selected view or a view from another account.
// Missing/failed official verification must not be interpreted as an ended frame.
function ownStageTransition(info,current,owner,verification){
 const target=ownLiveStageProgram(info);
 if(!target)return "ignore";
 if(!current?.open)return "open";
 const previous=String(current.programId||"").toLowerCase();
 if(previous===target)return "keep";
 const account=String(info?.userId||"");
 if(!/^\d{1,20}$/.test(account)||!/^lv\d{1,20}$/.test(previous)||
    owner?.programId!==previous||owner?.userId!==account)return "keep";
 if(!verification)return "verify";
 if(verification.ok===true&&String(verification.programId||"").toLowerCase()===previous&&
    ["ENDED","END","CLOSED"].includes(String(verification.programStatus||"").toUpperCase()))return "follow";
 return "wait";
}
if(typeof module==="object"&&module.exports)module.exports={buildStagePlayerFocusScript,ownLiveStageProgram,ownStageTransition};
else window.KananeoStageFocus={ownLiveStageProgram,ownStageTransition};
