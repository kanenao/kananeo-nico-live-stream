"use strict";

const {parseVersion}=require("./update-checker");
const RELEASE_BASE="https://github.com/kanenao/kananeo-nico-live-stream/releases/tag/";
const VALID_TAG=/^v?\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/i;
const PAGE_SIZE=30;

function releaseHistoryUrl(tag){
 if(typeof tag!=="string"||tag.length>96||!VALID_TAG.test(tag)||!parseVersion(tag))return "";
 return RELEASE_BASE+encodeURIComponent(tag);
}
function summarizeReleaseNotes(raw){
 if(typeof raw!=="string")return [];
 const text=raw.slice(0,20000).replace(/\r/g,"");
 const lines=text.split("\n");
 const notes=[];
 for(const rawLine of lines){
  const line=rawLine.trim();
  if(!line||/^(?:##?\s*(?:What's Changed|Full Changelog|変更内容|更新履歴)|\*\*Full Changelog\*\*)/i.test(line))continue;
  if(/^(?:開発中のα版です|機能・動作は未完成|Windows x64版はSetup|.*は未検証です)/.test(line))continue;
  const bullet=line.match(/^(?:[-*+]\s+|\d+\.\s+)(.+)$/);
  if(!bullet)continue;
  // Renderer always escapes the text; keep release text, not HTML, and never execute links.
  const body=bullet[1].replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,"$1").replace(/\s+by\s+@[\w-]+\s+in\s+https?:\/\/\S+/i,"").trim();
  if(body&&!notes.includes(body))notes.push(body.slice(0,600));
  if(notes.length>=18)break;
 }
 return notes;
}
function normalizeHistoryRelease(input){
 if(!input||typeof input!=="object"||input.draft===true)return null;
 const tag=String(input.tag_name||"").trim();
 const releaseUrl=releaseHistoryUrl(tag);
 if(!releaseUrl)return null;
 const published=Date.parse(String(input.published_at||""));
 const assets=Array.isArray(input.assets)?input.assets:[];
 const notes=summarizeReleaseNotes(input.body);
 return {
  tag,version:tag.replace(/^v/i,""),
  title:String(input.name||tag).replace(/[\r\n<>]/g," ").slice(0,180).trim(),
  publishedAt:Number.isFinite(published)?new Date(published).toISOString():"",
  prerelease:input.prerelease===true,notes,
  noteAvailable:notes.length>0,releaseUrl,
  setupAvailable:assets.some(x=>/-Setup-x64\.exe$/i.test(String(x?.name||""))),
  portableAvailable:assets.some(x=>/-Portable-x64\.exe$/i.test(String(x?.name||"")))
 };
}
function normalizeHistoryPage(items,page){
 const number=Number(page);
 if(!Number.isInteger(number)||number<1||number>20)return {ok:false,code:"INVALID_PAGE",message:"履歴ページは1〜20を指定してください。"};
 if(!Array.isArray(items))return {ok:false,code:"INVALID_HISTORY",message:"リリース履歴の応答を確認できません。"};
 const seen=new Set(),releases=[];
 for(const row of items){
  const value=normalizeHistoryRelease(row);
  if(value&&!seen.has(value.tag)){seen.add(value.tag);releases.push(value);}
 }
 return {ok:true,page:number,items:releases,hasMore:items.length===PAGE_SIZE};
}
module.exports={PAGE_SIZE,releaseHistoryUrl,summarizeReleaseNotes,normalizeHistoryRelease,normalizeHistoryPage};
