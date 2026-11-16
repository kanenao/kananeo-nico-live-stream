"use strict";
function textField(value,max,required=false){
 if(typeof value!=="string"||value.length>max||required&&!value.trim())return null;
 return value.trim();
}
function validateManualProgramInput(input){
 if(!input||typeof input!=="object"||Array.isArray(input)||input.confirmed!==true)
  return {ok:false,code:"CONFIRMATION_REQUIRED",message:"番組作成には内容確認と明示的な同意が必要です。"};
 const title=textField(input.title,200,true),description=textField(input.description,10000),
  category=textField(input.category,100,true);
 if(!title||description===null||!category)return {ok:false,code:"INVALID_FIELDS",message:"タイトル（最大200文字）、説明、カテゴリを確認してください。"};
 if(typeof input.isMemberOnly!=="boolean")return {ok:false,code:"VISIBILITY_REQUIRED",message:"公開範囲を明示してください。"};
 if(input.password||input.isPrivate||input.isLimited)return {ok:false,code:"UNSUPPORTED_PRIVACY",message:"合言葉・非公開枠は公式作成画面で設定してください。"};
 const rawTags=Array.isArray(input.tags)?input.tags:[];
 if(rawTags.length>10)return {ok:false,code:"TOO_MANY_TAGS",message:"タグは最大10件です。"};
 const tags=[];
 for(const raw of rawTags){
  const label=textField(raw,100,true);
  if(!label)return {ok:false,code:"INVALID_TAG",message:"タグの文字数を確認してください。"};
  if(!tags.some(t=>t.label===label))tags.push({label,isLocked:false});
 }
 return {ok:true,payload:{title,description,category,tags,isMemberOnly:input.isMemberOnly}};
}
module.exports={validateManualProgramInput};
