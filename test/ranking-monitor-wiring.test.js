"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const main=read("src/main.js"),preload=read("src/preload.js"),renderer=read("src/renderer.js");
const index=read("src/index.html"),moduleSource=read("src/ranking-monitor.js");
const pkg=JSON.parse(read("package.json"));
test("ranking monitor is exposed through a guarded main-process IPC",()=>{
 assert.match(main,/require\("\.\/ranking-monitor"\)/);
 assert.match(main,/ipcMain\.handle\("niconico:ranking-monitor-check"/);
 assert.match(main,/event\.sender!==mainWindow\?\.webContents/);
 assert.match(main,/fetchOwnBroadcastRankings\(\{userId:own\.userId,programs:own\.programs\}\)/);
 assert.match(preload,/checkOwnRanking:\(\)=>ipcRenderer\.invoke\("niconico:ranking-monitor-check"\)/);
});
test("ranking monitor module loads before renderer and provides three source adapters",()=>{
 assert.ok(index.indexOf('src="ranking-monitor.js"')<index.indexOf('src="renderer.js"'));
 assert.match(moduleSource,/https:\/\/www\.chikuwachan\.com\/live\/NCU\//);
 assert.match(moduleSource,/https:\/\/nico-ran\.stream\//);
 assert.match(moduleSource,/https:\/\/live\.nicovideo\.jp\/ranking/);
});
test("ranking monitor UI shows all requested sites, status distinctions and settings",()=>{
 for(const selector of ["配信ランキング監視","ranking-monitor-enabled","ranking-monitor-interval",
  "ranking-monitor-cards","ranking-monitor-history","data-ranking-monitor-check",
  "data-ranking-monitor-history-clear","掲載なし","取得エラー"])
  assert.ok(renderer.includes(selector),selector);
 assert.match(renderer,/rankingMonitor:\{enabled:true,intervalSeconds:60/);
 assert.match(renderer,/runRankingMonitorCheck\(\)/);
 assert.match(renderer,/state\.rankingMonitor\.history/);
});
test("public ranking fetcher does not use or forward the Niconico login session",()=>{
 assert.doesNotMatch(moduleSource,/niconicoSession|user_session|Cookie\s*:/i);
 assert.doesNotMatch(moduleSource,/credentials\s*:\s*["']include["']/i);
 assert.match(moduleSource,/AbortSignal\.timeout/);
 assert.match(moduleSource,/MAX_PAGE_CHARS/);
 assert.match(moduleSource,/isAllowedRedirect/);
});
test("ranking monitor release version stays alpha and increments the base version",()=>{
 assert.equal(pkg.version,"0.6.0-alpha.99");
 assert.match(preload,/version:"0\.6\.0-alpha\.99"/);
 assert.match(index,/ALPHA 99/);
});
