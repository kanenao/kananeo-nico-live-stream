"use strict";

const VERSION_HEADING=/^##\s+v?(\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?)\s*$/i;
const NOTE_LINE=/^\s*[-*]\s+(.+)$/;
const MAX_ENTRIES=100;
const MAX_NOTES=30;

function parseBundledChangelog(input) {
 if(typeof input!=="string"||input.length>250000)return [];
 const sections=[];
 let current=null;
 for(const rawLine of input.replace(/\r/g,"").split("\n")){
  const line=rawLine.trim();
  const heading=line.match(VERSION_HEADING);
  if(heading){
   const version=heading[1];
   current=sections.find(x=>x.version===version)||null;
   if(!current&&sections.length<MAX_ENTRIES){
    current={version,notes:[]};
    sections.push(current);
   }
   continue;
  }
  if(line.startsWith("## ")){current=null;continue;}
  if(!current)continue;
  const bullet=line.match(NOTE_LINE);
  if(!bullet||current.notes.length>=MAX_NOTES)continue;
  const note=bullet[1].trim().slice(0,500);
  if(note&&!current.notes.includes(note))current.notes.push(note);
 }
 return sections.filter(s=>s.notes.length>0);
}

function attachBundledDetails(pageResult,localSections) {
 if(!pageResult?.ok||!Array.isArray(pageResult.items))return pageResult;
 const byVersion=new Map(localSections.map(x=>[x.version,x.notes]));
 return {...pageResult,items:pageResult.items.map(item=>({
  ...item,details:[...(byVersion.get(item.version)||[])],localOnly:false
 }))};
}

function localHistoryFallback(localSections,page,warning) {
 if(page!==1||!localSections.length)return null;
 return {
  ok:true,page:1,items:localSections.map(section=>({
   tag:"v"+section.version,version:section.version,
   title:section.version,publishedAt:"",prerelease:section.version.includes("-"),
   notes:[],details:[...section.notes],localOnly:true,
   setupAvailable:false,portableAvailable:false,releaseUrl:""
  })),
  hasMore:false,offline:true,
  warning:String(warning||"GitHubに接続できないため、アプリ同梱の変更履歴を表示しています。").slice(0,180)
 };
}

module.exports={parseBundledChangelog,attachBundledDetails,localHistoryFallback};
