"use strict";
const TARGET_CONTENT_WIDTH=1100;
// Fit the official watch page into the actual viewport without changing its DOM.
const TARGET_CONTENT_HEIGHT=720;
function normalizeLiveZoomSettings(input){
 const v=input&&typeof input==="object"?input:{};
 const percent=Number(v.zoomPercent);
 return {zoomMode:v.zoomMode==="manual"?"manual":"auto",zoomPercent:Number.isFinite(percent)?Math.max(35,Math.min(125,Math.round(percent))):70};
}
function calculateLivePageZoomFactor(width,input,height){
 const v=normalizeLiveZoomSettings(input);
 if(v.zoomMode==="manual")return v.zoomPercent/100;
 const w=Number(width),h=Number(height);
 if(!Number.isFinite(w)||w<=0)return 0.7;
 const widthScale=w/TARGET_CONTENT_WIDTH;
 const scale=Number.isFinite(h)&&h>0?Math.min(widthScale,h/TARGET_CONTENT_HEIGHT):widthScale;
 return Math.max(0.35,Math.min(1,Math.round(scale*100)/100));
}
module.exports={normalizeLiveZoomSettings,calculateLivePageZoomFactor,TARGET_CONTENT_WIDTH,TARGET_CONTENT_HEIGHT};
