"use strict";
(()=>{
const MAX_COMMENT_LENGTH=80;
function cleanLabel(value){
 return Array.from(String(value||"").replace(/[\r\n\t\u0000-\u001f]+/g," ").trim())
  .slice(0,14).join("");
}
function formatPollResultComment({round,choices,items,decision}={}){
 if(!Number.isInteger(round)||round<1||round>100||
    !Array.isArray(choices)||choices.length!==2||
    !Array.isArray(items)||!["next","repeat"].includes(decision))
  return {ok:false,code:"INVALID_POLL_RESULT"};
 const labels=choices.map(cleanLabel);
 if(labels.some(label=>!label)||labels[0]===labels[1])
  return {ok:false,code:"INVALID_POLL_CHOICES"};
 const values=[];
 for(const choice of choices){
  const matches=items.filter(x=>x&&String(x.name)===String(choice));
  if(matches.length!==1)return {ok:false,code:"UNVERIFIED_POLL_CHOICES"};
  const rate=Number(matches[0].rate);
  if(!Number.isFinite(rate)||rate<0||rate>100)
   return {ok:false,code:"INVALID_POLL_RATE"};
  values.push(rate.toFixed(1)+"%");
 }
 const action=decision==="next"?"次動画へ":"再投票";
 const text="【投票結果"+round+"回】"+labels[0]+" "+values[0]+" / "+labels[1]+" "+values[1]+" →"+action;
 if(Array.from(text).length>MAX_COMMENT_LENGTH)return {ok:false,code:"POLL_COMMENT_TOO_LONG"};
 return {ok:true,text};
}
const api=Object.freeze({formatPollResultComment});
if(typeof module!=="undefined"&&module.exports)module.exports=api;
if(typeof window!=="undefined")window.KananeoPollResultComment=api;
})();
