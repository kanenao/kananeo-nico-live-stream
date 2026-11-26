"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const main=read("src/main.js"),preload=read("src/preload.js"),renderer=read("src/renderer.js");
const index=read("src/index.html"),css=read("src/style.css");
const pkg=JSON.parse(read("package.json"));

test("P2P quake module boots in renderer before application code",()=>{
 assert.match(index,/<script src="earthquake-notice\.js"><\/script>/);
 assert.ok(index.indexOf('src="earthquake-notice.js"')<index.indexOf('src="renderer.js"'));
 assert.match(main,/require\("\.\/earthquake-notice"\)/);
});
test("guarded Earthquake IPC never trusts arbitrary program IDs or user-submitted warnings",()=>{
 assert.match(main,/ipcMain\.handle\("niconico:earthquake-reports"/);
 assert.match(main,/ipcMain\.handle\("niconico:post-earthquake-notice"/);
 assert.match(main,/event\.sender!==mainWindow\?\.webContents/);
 assert.match(main,/earthquakeReportsCache\.get\(reportId\)/);
 assert.match(main,/isRecent\(report\)/);
 assert.match(main,/earthquakeAttemptedReportIds\.has\(reportId\)/);
 assert.match(main,/earthquakeAttemptedKeys\.has\(report\.key\)/);
 assert.match(main,/lastEarthquakeNoticeAttemptAt/);
 assert.match(main,/const own=await getOwnBroadcast\(\)/);
 assert.match(main,/code:"NOT_OWN_LIVE"/);
 assert.match(main,/return sendNiconicoBroadcasterComment\(\{programId,text\}\)/);
 assert.doesNotMatch(main,/ipcMain\.handle\("niconico:post-earthquake-notice"[\s\S]{0,2000}input\.text/);
});
test("earthquake read and verified post are exposed through the preload bridge",()=>{
 assert.match(preload,/getEarthquakeReports:\(\)=>ipcRenderer\.invoke\("niconico:earthquake-reports"\)/);
 assert.match(preload,/postEarthquakeNotice:input=>ipcRenderer\.invoke\("niconico:post-earthquake-notice",input\)/);
});
test("earthquake monitoring defaults OFF and only posts when explicitly enabled",()=>{
 assert.match(renderer,/earthquakeNotice:\{enabled:false,minScale:30,intervalSeconds:30/);
 assert.match(renderer,/loaded\.earthquakeNotice=window\.KananeoEarthquakeNotice\.normalizeNoticeSettings/);
 assert.match(renderer,/if\(state\.earthquakeNotice\.enabled\)void runEarthquakeNoticeCheck\(true,false\)/);
 assert.match(renderer,/if\(state\.earthquakeNotice\.enabled&&!earthquakeNoticeRuntime\.busy/);
 assert.match(renderer,/if\(!state\.earthquakeNotice\.enabled\|\|!allowPost\)/);
 assert.match(renderer,/runtime\.initialized=true/);
});
test("broadcast and monitor share one earthquake-settings panel",()=>{
 assert.match(renderer,/function earthquakeNoticeMarkup\(\)/);
 assert.match(renderer,/broadcast-earthquake-section/);
 assert.match(renderer,/panel\("地震情報の運営コメント自動通知"/);
 assert.match(renderer,/id="earthquake-notice-enabled"/);
 assert.match(renderer,/id="earthquake-notice-scale"/);
 assert.match(renderer,/id="earthquake-notice-interval"/);
 assert.match(renderer,/id="earthquake-notice-history"/);
 assert.match(renderer,/data-earthquake-check/);
 assert.match(renderer,/data-earthquake-history-clear/);
 assert.match(renderer,/renderEarthquakeNoticeUi\(\)/);
});
test("auto posting honors NicoLive's shared 5-second broadcaster comment queue",()=>{
 assert.match(renderer,/postAutomatedBroadcasterComment\(programId,text,/);
 assert.match(renderer,/window\.kananeoApp\.niconico\.postEarthquakeNotice\(\{programId,reportId:latest\.id\}\)/);
 assert.match(renderer,/5000-\(Date\.now\(\)-lastRequestReplySentAt\)/);
 assert.match(renderer,/MIN_POST_INTERVAL_MS/);
 assert.match(renderer,/runEarthquakeNoticeCheck\(true,false\)/);
});
test("UI clearly labels reports as post-quake information and not EEW",()=>{
 assert.match(renderer,/緊急地震速報（警報）ではありません/);
 assert.match(renderer,/地震情報・運営コメント自動通知/);
 assert.match(renderer,/気象庁の地震情報/);
 assert.match(css,/\.earthquake-notice-controls/);
 assert.match(css,/\.earthquake-notice-history/);
 assert.match(css,/@media\(max-width:700px\)/);
});
test("version bump advances alpha serial without declaring stable",()=>{
 assert.equal(pkg.version,"0.9.8-alpha.110");
 assert.match(preload,/version:"0\.9\.8-alpha\.110"/);
 assert.match(index,/ALPHA 110/);
});
