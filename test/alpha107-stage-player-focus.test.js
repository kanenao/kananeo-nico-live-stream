"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const {ownLiveStageProgram,buildStagePlayerFocusScript}=require("../src/stage-player-focus");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("own-stage auto-open accepts only a verified live program ID",()=>{
 assert.equal(ownLiveStageProgram({programId:"LV123",programStatus:"ON_AIR"}),"lv123");
 assert.equal(ownLiveStageProgram({programId:"lv123",programStatus:"onair"}),"lv123");
 for(const programStatus of ["TEST","RESERVED","WAITING","ENDED",undefined])assert.equal(ownLiveStageProgram({programId:"lv123",programStatus}),"");
 assert.equal(ownLiveStageProgram({programId:"lv123?evil",programStatus:"ON_AIR"}),"");
});
function fixture({hostname="live.nicovideo.jp",known=true}={}){
 let tick,style,marked=false;
 const html={},body={parentElement:html};
 const rect={width:800,height:450};
 const root={parentElement:body,isConnected:true,getBoundingClientRect:()=>rect,querySelector:()=>null,contains:v=>v===video,setAttribute:()=>{marked=true},removeAttribute:()=>{marked=false}};
 const video={isConnected:true,readyState:0,paused:true,ended:false,videoWidth:1280,getBoundingClientRect:()=>rect,closest:()=>known?root:null};
 const context={window:{},location:{protocol:"https:",hostname,pathname:"/watch/lv123"},document:{body,documentElement:html,head:{appendChild:s=>{style=s}},querySelectorAll:()=>[video],getElementById:()=>style,createElement:()=>({remove:()=>{style=null}})},getComputedStyle:()=>({display:"block",visibility:"visible",transform:"none",perspective:"none",filter:"none",contain:"none"}),setInterval:f=>{tick=f}};
 vm.runInNewContext(buildStagePlayerFocusScript(),context);
 return {video,root,tick:()=>tick?.(),focused:()=>marked,hasTimer:()=>!!tick,style:()=>style};
}
test("focus waits for actual playback, preserves pause and restores on end",()=>{
 const f=fixture();
 assert.equal(f.focused(),false);
 f.video.readyState=2;f.video.paused=false;f.tick();
 assert.equal(f.focused(),true);
 assert.match(f.style().textContent,/position:fixed!important/);
 f.video.paused=true;f.tick();assert.equal(f.focused(),true);
 f.video.ended=true;f.tick();assert.equal(f.focused(),false);assert.equal(f.style(),null);
});
test("unrecognized DOM or foreign host never receives player focus",()=>{
 const f=fixture({known:false});f.video.readyState=3;f.video.paused=false;f.tick();assert.equal(f.focused(),false);
 assert.equal(fixture({hostname:"example.com"}).hasTimer(),false);
});
test("existing watch layout is preserved and automatic display is wired to own live monitor",()=>{
 const r=read("src/renderer.js"),m=read("src/main.js"),i=read("src/index.html");
 assert.match(r,/function maybeOpenOwnLiveStage\(info\)/);
 assert.match(r,/autoStageAttemptedPrograms\.has\(programId\)/);
 assert.match(r,/if\(liveVideoState\.open\)return/);
 assert.match(r,/openLiveVideo\(programId,"popup"\)/);
 assert.match(r,/if\(ownLive\)void maybeOpenOwnLiveStage\(ownLive\)/);
 assert.match(r,/void maybeOpenOwnLiveStage\(info\)/);
 assert.match(m,/liveVideoDisplayMode==="popup"&&url\.protocol==="https:"/);
 assert.match(m,/executeJavaScript\(buildStagePlayerFocusScript\(\)\)/);
 assert.match(i,/<script src="stage-player-focus.js"><\/script>/);
});
