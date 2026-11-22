"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const base=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8").replace(/\r\n/g,"\n");
const renderer=read("src/renderer.js"),main=read("src/main.js"),preload=read("src/preload.js"),html=read("src/index.html"),style=read("src/style.css");
const start=renderer.indexOf("function updateLiveVideoBounds(){");
const end=renderer.indexOf("function hideBroadcastCommentContextMenu(){",start);
assert.ok(start>=0&&end>start);
function fixture(){
 const calls={main:[],second:[]};
 const state={liveVideoZoom:{zoomMode:"auto",zoomPercent:70},broadcastView:{mode:"dual",videoShare:60,theater:false,secondaryProgramId:"lv22",secondaryAudio:false}};
 const nodes={
  "broadcast-video-slot":{getBoundingClientRect:()=>({x:30,left:30,top:220,width:420,height:280})},
  "broadcast-second-video-slot":{getBoundingClientRect:()=>({x:470,left:470,top:220,width:420,height:280})}
 };
 const context=vm.createContext({
  page:"broadcast",state,document:{getElementById:id=>nodes[id]||null},
  liveVideoState:{open:true},secondLiveVideoState:{open:true},
  lastLiveVideoBoundsKey:"",lastSecondLiveVideoBoundsKey:"",
  window:{kananeoApp:{niconico:{
   setLiveVideoBounds:bounds=>calls.main.push(bounds),
   setSecondLiveVideoBounds:bounds=>calls.second.push(bounds)
  }}},
  JSON
 });
 vm.runInContext(renderer.slice(start,end),context);
 return {context,state,calls};
}
test("two streams receive separate verified native bounds without duplicate calls",()=>{
 const {context,calls}=fixture();
 vm.runInContext("updateLiveVideoBounds()",context);
 assert.equal(calls.main.length,1);
 assert.equal(calls.second.length,1);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.main[0])),{visible:true,x:30,y:220,width:420,height:280,zoomMode:"auto",zoomPercent:70});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.second[0])),{visible:true,x:470,y:220,width:420,height:280,zoomMode:"auto",zoomPercent:70});
 vm.runInContext("updateLiveVideoBounds()",context);
 assert.equal(calls.main.length,1);
 assert.equal(calls.second.length,1);
});
test("leaving dual mode hides secondary native video; changing pages hides both",()=>{
 const {context,state,calls}=fixture();
 vm.runInContext("updateLiveVideoBounds()",context);
 state.broadcastView.mode="wide";
 vm.runInContext("updateLiveVideoBounds()",context);
 assert.equal(calls.main.length,1);
 assert.equal(calls.second.length,2);
 assert.equal(calls.second[1].visible,false);
 context.page="settings";
 vm.runInContext("updateLiveVideoBounds()",context);
 assert.equal(calls.main.at(-1).visible,false);
 assert.equal(calls.second.at(-1).visible,false);
});
test("secondary stream is isolated with strict IPC access, trusted Nico origin, and default muted sound",()=>{
 assert.match(main,/new WebContentsView\(\{webPreferences:\{/);
 assert.match(main,/session:niconicoSession,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true/);
 assert.match(main,/contents\.setAudioMuted\(true\)/);
 assert.match(main,/if\(!isTrustedNiconicoUrl\(url\)\)/);
 for(const name of ["second-live-view-open","second-live-view-bounds","second-live-view-close","second-live-view-audio"]){
  assert.ok(main.includes("niconico:"+name),name);
  assert.ok(preload.includes("niconico:"+name),name);
 }
 assert.match(main,/return openNiconicoSecondLiveVideoView\(input\)/);
 assert.match(main,/return setNiconicoSecondLiveVideoAudio\(enabled\)/);
 assert.match(main,/event\.sender!==mainWindow\?\.webContents/);
 assert.match(main,/closeNiconicoSecondLiveVideoView\(\);/);
});
test("workspace buttons, saved settings and responsive layouts are wired without reloads",()=>{
 assert.match(html,/src="broadcast-view-mode\.js"/);
 assert.ok(html.indexOf('src="broadcast-view-mode.js"')<html.indexOf('src="renderer.js"'));
 assert.match(renderer,/loaded\.broadcastView=window\.KananeoBroadcastView\.normalizeBroadcastView/);
 assert.match(renderer,/id="broadcast-view-mode"/);
 assert.match(renderer,/id="broadcast-view-ratio"/);
 assert.match(renderer,/data-broadcast-theater-toggle/);
 assert.match(renderer,/id="broadcast-second-video-slot"/);
 assert.match(renderer,/id="broadcast-secondary-id"/);
 assert.match(renderer,/data-second-live-open/);
 assert.match(renderer,/data-second-live-close/);
 assert.match(renderer,/data-second-live-audio/);
 assert.match(renderer,/if\(state\.slot==="secondary"\)/);
 assert.match(renderer,/if\(e\.target\.id==="broadcast-view-mode"\)/);
 assert.match(renderer,/if\(e\.target\.id==="broadcast-view-ratio"\)/);
 assert.match(style,/\.broadcast-mode-video>\.broadcast-comments-panel\{display:none\}/);
 assert.match(style,/\.broadcast-mode-dual \.broadcast-video-grid\{grid-template-columns:repeat\(2/);
 assert.match(style,/\.broadcast-theater>\.hero/);
});
