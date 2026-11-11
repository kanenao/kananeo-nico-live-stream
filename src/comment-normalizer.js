"use strict";

function safeString(value,maxLength=4000){
  if(value===null||value===undefined)return "";
  return String(value).slice(0,maxLength);
}
function safeTimestamp(value){
  const date=value instanceof Date?value:new Date(value||Date.now());
  return Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString();
}
function normalizeComment(comment){
  const userId=safeString(comment?.userId,128);
  const userName=safeString(comment?.userName,128)||(userId?`ID:${userId}`:"匿名");
  return {
    id:safeString(comment?.id ?? comment?.no,128)||`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    commentNo:/^\d+$/.test(String(comment?.no ?? comment?.id ?? ""))?String(comment?.no ?? comment?.id).slice(0,20):"",
    type:"comment",content:safeString(comment?.content),userId,userName,
    timestamp:safeTimestamp(comment?.timestamp),isHistory:Boolean(comment?.isHistory)
  };
}
function normalizeOperatorComment(event){
  return {
    id:`operator-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    type:"operatorComment",content:safeString(event?.content),
    userName:safeString(event?.name,128)||"放送者",userId:"",
    timestamp:safeTimestamp(event?.timestamp),isHistory:Boolean(event?.isHistory)
  };
}
function normalizeNotification(event,type="notification"){
  const label=type==="gift"?"ギフト":type==="emotion"?"エモーション":"通知";
  const content=type==="gift"
    ?[safeString(event?.userName,128),safeString(event?.itemName,128),event?.point?`${Number(event.point)}pt`:"",safeString(event?.message,1000)].filter(Boolean).join(" / ")
    :type==="emotion"?safeString(event?.id||event?.content,1000):safeString(event?.message,2000);
  return {
    id:`${type}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    type,content:content||label,userName:label,userId:"",
    timestamp:safeTimestamp(event?.timestamp),isHistory:Boolean(event?.isHistory)
  };
}
module.exports={normalizeComment,normalizeOperatorComment,normalizeNotification};
