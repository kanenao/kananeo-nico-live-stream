"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const renderer=fs.readFileSync(path.join(root,"src/renderer.js"),"utf8").replace(/\r\n/g,"\n");
const history=require("../src/stream-monitor-history");
const start=renderer.indexOf("function removeOneStreamMonitorHistory(");
const end=renderer.indexOf("async function maybeAutoPlayOnOwnLive(",start);
assert.ok(start>=0&&end>start,"monitor functions must be independently testable");
function fixture(){
 const host={innerHTML:""},calls={saves:[],renders:0};
 const config={enabled:true,ownAccount:true,intervalSeconds:60,targets:[
  {programId:"lv101",status:"onAir",title:"対象番組",lastCheckedAt:"2026-11-22T01:00:00Z"}
 ],userIds:["1234567"],autoComments:true,history:[
  {type:"live",programId:"lv101",message:"放送検知",at:"2026-11-22T01:00:00Z"},
  {type:"error",programId:"lv102",message:"取得失敗",at:"2026-11-22T01:01:00Z"}
 ]};
 const state={streamMonitor:config,otherSetting:"keep"};
 const context=vm.createContext({
  state,ownMonitorStatus:{running:true,message:"自分の番組監視中"},
  registeredMonitorStatus:{checkedUsers:1,failedUsers:0,message:"登録ユーザー監視中"},
  streamMonitorRuntime:{lastCheckAt:"",message:"定期確認中",busy:false},
  window:{KananeoStreamMonitorHistory:history,KananeoStreamMonitor:{statusLabel:s=>s}},
  document:{getElementById:id=>id==="stream-monitor-status"?host:null,querySelector:()=>null},
  esc:s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;"),
  save:()=>calls.saves.push(JSON.parse(JSON.stringify(state))),
  Date
 });
 vm.runInContext(renderer.slice(start,end),context);
 return {context,state,config,host,calls};
}
test("monitor page renders clear-all action and per-record buttons with guarded tokens",()=>{
 const f=fixture();vm.runInContext("renderStreamMonitorUi()",f.context);
 assert.match(f.host.innerHTML,/監視履歴/);
 assert.match(f.host.innerHTML,/保存 2 件・最新20件を表示/);
 assert.match(f.host.innerHTML,/data-stream-monitor-history-clear/);
 assert.match(f.host.innerHTML,/data-stream-monitor-history-delete="0"/);
 assert.match(f.host.innerHTML,/data-stream-monitor-history-delete="1"/);
 assert.match(f.host.innerHTML,/data-stream-monitor-history-token=/);
 assert.match(f.host.innerHTML,/監視履歴だけを削除します/);
});
test("individual history deletion persists immediately without changing monitoring",()=>{
 const f=fixture(),token=history.historyEntryToken(f.config.history[0]);
 const result=vm.runInContext("removeOneStreamMonitorHistory(0,"+JSON.stringify(token)+")",f.context);
 assert.equal(result,true);
 assert.equal(f.state.streamMonitor.history.length,1);
 assert.equal(f.state.streamMonitor.history[0].message,"取得失敗");
 assert.equal(f.state.streamMonitor.enabled,true);
 assert.equal(f.state.streamMonitor.autoComments,true);
 assert.equal(f.state.streamMonitor.targets.length,1);
 assert.equal(f.state.streamMonitor.userIds[0],"1234567");
 assert.equal(f.calls.saves.length,1);
 assert.match(f.host.innerHTML,/保存 1 件・最新20件を表示/);
 assert.equal(vm.runInContext("removeOneStreamMonitorHistory(0,"+JSON.stringify(token)+")",f.context),false);
 assert.equal(f.calls.saves.length,1);
});
test("clear-all deletes persisted history while keeping monitoring active and adds no reset event",()=>{
 const f=fixture();
 assert.equal(vm.runInContext("removeAllStreamMonitorHistory()",f.context),true);
 assert.equal(f.state.streamMonitor.history.length,0);
 assert.equal(f.calls.saves.length,1);
 assert.equal(f.calls.saves[0].streamMonitor.history.length,0);
 assert.equal(f.state.streamMonitor.enabled,true);
 assert.equal(f.state.streamMonitor.targets.length,1);
 assert.match(f.host.innerHTML,/監視履歴はありません/);
 assert.match(f.host.innerHTML,/data-stream-monitor-history-clear disabled/);
 assert.equal(vm.runInContext("removeAllStreamMonitorHistory()",f.context),false);
 assert.equal(f.calls.saves.length,1);
});
test("UI actions require confirmation and do not clear other app logs or registered targets",()=>{
 assert.match(renderer,/data-stream-monitor-history-clear/);
 assert.match(renderer,/data-stream-monitor-history-delete/);
 assert.match(renderer,/if\(b\.hasAttribute\("data-stream-monitor-history-delete"\)\)/);
 assert.match(renderer,/if\(b\.hasAttribute\("data-stream-monitor-history-clear"\)\)/);
 assert.match(renderer,/!confirm\("この監視履歴を1件削除しますか/);
 assert.match(renderer,/!confirm\("保存された監視履歴 "/);
 assert.doesNotMatch(renderer.slice(start,end),/state\.streamMonitor\.(?:targets|userIds|enabled)\s*=/);
});
