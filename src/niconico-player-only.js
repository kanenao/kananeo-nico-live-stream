"use strict";

// Make only the *existing official live player* fill the WebContentsView.
// Never replace Niconico's media source or fetch streams independently.
// If the site's markup changes, leave the original watch page intact.
function installPlayerOnlyMode() {
 if (window.__kananeoLivePlayerOnly) return "already-installed";
 window.__kananeoLivePlayerOnly = true;
 let attempts = 0;
 let activeRoot = null;
 const preferred = /player|viewer|video|stream|screen/i;
 function selectPlayer() {
  const videos = [...document.querySelectorAll("video")].map(node => {
   const box = node.getBoundingClientRect();
   return {node, area:box.width * box.height,box};
  }).filter(item => item.box.width >= 160 && item.box.height >= 90);
  videos.sort((a,b) => b.area - a.area);
  const video = videos[0]?.node;
  if (!video || !document.body) return null;
  const base = video.getBoundingClientRect();
  const matches = [];
  let parent = video.parentElement;
  for (let depth=0;parent && parent !== document.body && depth<10;depth++,parent=parent.parentElement) {
   const box = parent.getBoundingClientRect();
   if (box.width < base.width*.8 || box.height < base.height*.8 ||
       box.width > base.width*1.7 || box.height > base.height*1.8) continue;
   const name = String(parent.id||"")+" "+String(typeof parent.className==="string"?parent.className:"");
   matches.push({parent,name,depth});
  }
  // Prefer the broadest actual player wrapper, preserving comment overlays
  // and playback controls. A too-large page shell is never selected.
  const named = matches.filter(item => preferred.test(item.name));
  return (named.at(-1)||matches.at(-1))?.parent||video.parentElement;
 }
 function enable() {
  if (activeRoot && document.contains(activeRoot)) return true;
  const root = selectPlayer();
  if (!root) return false;
  let parent=root.parentElement;
  while(parent && parent!==document.body) {
   parent.style.setProperty("transform","none","important");
   parent.style.setProperty("contain","none","important");
   parent.style.setProperty("overflow","visible","important");
   parent=parent.parentElement;
  }
  root.classList.add("kananeo-player-only-root");
  if (!document.getElementById("kananeo-player-only-style")) {
   const style=document.createElement("style");
   style.id="kananeo-player-only-style";
   style.textContent=[
    "html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;width:100%!important;height:100%!important}",
    ".kananeo-player-only-root{position:fixed!important;inset:0!important;z-index:2147483640!important;width:100vw!important;height:100vh!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:hidden!important;background:#000!important}",
    ".kananeo-player-only-root video{object-fit:contain!important;max-width:100%!important;max-height:100%!important}"
   ].join("\n");
   (document.head||document.documentElement).appendChild(style);
  }
  activeRoot=root;
  return true;
 }
 if (enable()) return "player-only";
 // The video is often created after did-finish-load. Do not hide the
 // standard page while waiting, so an unavailable stream stays diagnosable.
 const poll=window.setInterval(()=>{
  attempts++;
  if (enable()||attempts>=60) window.clearInterval(poll);
 },500);
 return "waiting-for-player";
}

function buildNiconicoPlayerOnlyScript(){
 return "("+installPlayerOnlyMode.toString()+")()";
}

module.exports={buildNiconicoPlayerOnlyScript};
