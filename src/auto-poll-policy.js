"use strict";
(() => {
const VID=/^(?:sm|nm|so)\d{1,12}$/i,PROG=/^lv\d{1,20}$/i;
function quotePollKey(programId,videoId,startedAt){
 const program=String(programId||"").toLowerCase(),video=String(videoId||"").toLowerCase(),time=Number(startedAt);
 if(!PROG.test(program)||!VID.test(video)||!Number.isSafeInteger(time)||time<=0)return "";
 return program+":"+video+":"+time;
}
function canAutoPoll(input){
 const key=quotePollKey(input?.programId,input?.videoId,input?.startedAt);
 return !!(key&&input.enabled===true&&input.quoteActive===true&&input.pollBusy!==true&&input.attemptedKey!==key);
}
const api=Object.freeze({quotePollKey,canAutoPoll});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoAutoPoll=api;
})();
