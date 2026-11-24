"use strict";

// This is a native Nico Live watch URL, not a bundled browser extension.
// The compact URL parameters are based on the user-supplied example.
// Their actual layout is controlled by Nico Live and may change.
function normalizeLiveViewMode(value){
 return value==="normal"?"normal":"popup";
}
function buildLiveWatchUrl(programId,mode){
 if(typeof programId!=="string"||!/^lv\d{1,20}$/i.test(programId))throw new TypeError("INVALID_PROGRAM_ID");
 const id=programId.toLowerCase();
 if(normalizeLiveViewMode(mode)==="normal")return "https://live2.nicovideo.jp/watch/"+encodeURIComponent(id);
 const url=new URL("https://live.nicovideo.jp/watch/"+encodeURIComponent(id));
 url.searchParams.set("popup","on");
 url.searchParams.set("screenmode","2");
 return url.href;
}
function liveWatchZoomFactor(width,settings,mode,calculateNormalZoom){
 // Native popup layout gets a real viewport, not the normal watch-page
 // downscaling. Manual zoom settings remain available in both modes.
 if(normalizeLiveViewMode(mode)==="popup"&&settings?.zoomMode!=="manual")return 1;
 return calculateNormalZoom(width,settings);
}
module.exports={normalizeLiveViewMode,buildLiveWatchUrl,liveWatchZoomFactor};
