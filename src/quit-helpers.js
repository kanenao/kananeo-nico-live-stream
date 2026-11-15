"use strict";
/** Allow shutdown cleanup to finish, but never hang app exit indefinitely. */
async function settleBeforeQuit(tasks,timeoutMs=7000,{schedule=setTimeout,cancel=clearTimeout}={}){
 const duration=Number.isFinite(timeoutMs)?Math.min(Math.max(timeoutMs,100),30000):7000;
 let timer;
 const pending=Promise.allSettled((Array.isArray(tasks)?tasks:[]).map(task=>
  Promise.resolve().then(()=>typeof task==="function"?task():undefined)));
 try{
  return await Promise.race([
   pending.then(results=>({timedOut:false,results})),
   new Promise(resolve=>{timer=schedule(()=>resolve({timedOut:true,results:[]}),duration);})
  ]);
 }finally{if(timer!=null)cancel(timer);}
}
module.exports={settleBeforeQuit};
