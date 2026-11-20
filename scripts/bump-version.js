"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");

function parseVersion(value){
 const match=String(value||"").match(/^(\d+)\.(\d+)\.(\d+)-alpha\.(\d+)$/);
 if(!match)throw new Error("α版のバージョン形式 X.Y.Z-alpha.N が必要です。");
 const parts=match.slice(1).map(Number);
 if(!parts.every(Number.isSafeInteger))throw new Error("バージョン番号が大きすぎます。");
 return parts;
}
function bumpVersion(current,kind="patch"){
 const [major,minor,patch,alpha]=parseVersion(current);
 if(kind==="patch")return [major,minor,patch+1].join(".")+"-alpha."+(alpha+1);
 if(kind==="feature"){
  // A 1.0.0 stable release must never be inferred from commit history.
  if(major===0)return "0."+(minor+1)+".0-alpha."+(alpha+1);
  return [major,minor+1,0].join(".")+"-alpha."+(alpha+1);
 }
 throw new Error("更新種別は auto、patch または feature を指定してください。");
}
function replaceVersion(content,current,next){
 if(!content.includes(current))throw new Error("バージョン "+current+" がファイル内に見つかりません。");
 return content.split(current).join(next);
}
function isReleaseRelevantFile(file){
 return /^(?:src\/|scripts\/|config\/|package\.json$|\.github\/workflows\/windows-build\.yml$)/.test(String(file));
}
function classifyChangeMessages(messages,files){
 if(!Array.isArray(messages)||!Array.isArray(files))throw new TypeError("コミットと変更ファイル一覧が必要です。");
 const relevant=files.some(isReleaseRelevantFile);
 if(!relevant)return {kind:"none",reason:"アプリ・配布に影響する変更がありません。"};
 const lines=messages.map(s=>String(s||"").trim()).filter(Boolean);
 if(!lines.length)return {kind:"none",reason:"新しい開発コミットがありません。"};
 // Feature-level changes are identified by explicit commit intent. An
 // ambiguous change is conservatively a patch, never a stable/major release.
 const productChange=files.some(file=>/^src\//.test(String(file)));
 const breaking=lines.some(s=>/^(?:breaking:|重大な仕様変更[:：]?)/i.test(s)||
   /BREAKING[ -]CHANGE\s*:/i.test(s)||
   /^feat(?:\([^)]*\))?!:/i.test(s));
 const newFeature=lines.some(s=>/^(?:feat(?:\((?!small\))[^)]*\))?:|feature:|大規模(?:機能)?追加[:：]?)/i.test(s));
 if(breaking||productChange&&newFeature)
  return {kind:"feature",reason:"新機能または大規模な仕様変更を検出しました。"};
 return {kind:"patch",reason:"不具合修正・小規模改善・保守変更として判定しました。"};
}
function readChangesSinceRelease(root,current){
 const tag="v"+current;
 function git(args){
  return execFileSync("git",args,{cwd:root,encoding:"utf8",timeout:12000,stdio:["ignore","pipe","pipe"]}).trim();
 }
 try{git(["rev-parse","--verify","refs/tags/"+tag]);}
 catch{throw new Error("基準リリースタグ "+tag+" がありません。タグを取得してから再実行してください。");}
 const range=tag+"..HEAD";
 const messages=git(["log","--no-merges","--format=%s",range]).split(/\r?\n/).filter(Boolean);
 const files=git(["diff","--name-only",range]).split(/\r?\n/).filter(Boolean);
 return {messages,files};
}
function cleanReleaseMessage(value){
 return String(value).replace(/[\r\n<>]/g," ").replace(/\s+/g," ").trim().slice(0,160);
}
function prependReleaseNotes(existing,next,alpha,messages,kind){
 if(existing.includes("## "+next+"\n"))return existing;
 const descriptions=messages.map(cleanReleaseMessage).filter(Boolean).slice(0,12);
 const bullet=descriptions.length?descriptions.map(x=>"- "+x).join("\n"):
  "- "+(kind==="feature"?"機能追加・仕様変更":"不具合修正・小規模改善");
 return existing.replace(/^(# [^\n]+\n)/,match=>
  match+"\n## "+next+"\n"+bullet+"\n\n");
}
function run(){
 const mode=process.argv[2]||"auto";
 const root=path.resolve(__dirname,"..");
 const packagePath=path.join(root,"package.json");
 const pkg=JSON.parse(fs.readFileSync(packagePath,"utf8"));
 const current=pkg.version;
 let kind=mode,changes={messages:[],files:[]};
 if(mode==="auto"){
  changes=readChangesSinceRelease(root,current);
  const decision=classifyChangeMessages(changes.messages,changes.files);
  if(decision.kind==="none")throw new Error(decision.reason+" 不必要なα版の発行を中止しました。");
  kind=decision.kind;
  console.log("自動判定: "+decision.reason+" ("+kind+")");
 }
 const next=bumpVersion(current,kind);
 const [, , ,alpha]=parseVersion(current);
 const nextAlpha=alpha+1;
 // Prepare all content before writing; never partially update version metadata.
 const updated=new Map();
 const preload=path.join(root,"src/preload.js");
 const index=path.join(root,"src/index.html");
 const docs=path.join(root,"docs/VERSIONING.md");
 const readme=path.join(root,"README.md");
 const changelog=path.join(root,"CHANGELOG.md");
 updated.set(preload,replaceVersion(fs.readFileSync(preload,"utf8"),current,next));
 let html=replaceVersion(fs.readFileSync(index,"utf8"),current,next);
 const badge="ALPHA "+alpha;
 if(!html.includes(badge))throw new Error("現在のα版バッジが一致しません。");
 html=html.replace(badge,"ALPHA "+nextAlpha);
 updated.set(index,html);
 let rules=fs.readFileSync(docs,"utf8");
 const marker="現在のバージョン："+String.fromCharCode(96)+current+String.fromCharCode(96);
 if(!rules.includes(marker))throw new Error("docs/VERSIONING.md の現在の版数が一致しません。");
 rules=rules.replace(marker,"現在のバージョン："+String.fromCharCode(96)+next+String.fromCharCode(96));
 updated.set(docs,rules);
 const originalReadme=fs.readFileSync(readme,"utf8");
 const description=kind==="feature"?"機能追加":"不具合修正・運用改善";
 const readmeHeading="## α"+nextAlpha+"："+description;
 if(!originalReadme.startsWith("# "))throw new Error("README見出しが不正です。");
 updated.set(readme,originalReadme.replace(/^(# [^\n]+\n)/,s=>
   s+"\n"+readmeHeading+"\n"+
   (changes.messages.length?changes.messages.map(cleanReleaseMessage).filter(Boolean).slice(0,12).map(x=>"- "+x).join("\n"):
    "- "+description)+"\n"));
 updated.set(changelog,prependReleaseNotes(fs.readFileSync(changelog,"utf8"),next,nextAlpha,changes.messages,kind));
 pkg.version=next;
 updated.set(packagePath,JSON.stringify(pkg,null,2)+"\n");
 for(const [file,content] of updated)fs.writeFileSync(file,content,"utf8");
 console.log("バージョンを "+current+" から "+next+" に更新しました。");
}
if(require.main===module){try{run();}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={parseVersion,bumpVersion,replaceVersion,classifyChangeMessages,
 isReleaseRelevantFile,readChangesSinceRelease,prependReleaseNotes};
