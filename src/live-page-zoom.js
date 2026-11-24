"use strict";
const TARGET_CONTENT_WIDTH=1100;
function normalizeLiveZoomSettings(input){
 const v=input&&typeof input==="object"?input:{};
 const percent=Number(v.zoomPercent);
 return {zoomMode:v.zoomMode==="manual"?"manual":"auto",zoomPercent:Number.isFinite(percent)?Math.max(35,Math.min(125,Math.round(percent))):70};
}
function calculateLivePageZoomFactor(width,input){
 const v=normalizeLiveZoomSettings(input);
 if(v.zoomMode==="manual")return v.zoomPercent/100;
 const w=Number(width);
 if(!Number.isFinite(w)||w<=0)return 0.7;
 return Math.max(0.35,Math.min(1,Math.round(w/TARGET_CONTENT_WIDTH*100)/100));
}
module.exports={normalizeLiveZoomSettings,calculateLivePageZoomFactor,TARGET_CONTENT_WIDTH};
