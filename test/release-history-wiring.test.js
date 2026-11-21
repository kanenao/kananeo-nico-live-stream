"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const main=read("src/main.js"),preload=read("src/preload.js"),renderer=read("src/renderer.js");
const index=read("src/index.html"),releaseUi=read("src/release-history-ui.js"),pkg=JSON.parse(read("package.json"));
test("version history exists in the app navigation and shows actual release notes",()=>{
 assert.match(index,/data-page="changelog"/);
 assert.match(renderer,/changelog:"バージョン・更新情報"/);
 assert.match(renderer,/バージョン別の変更履歴/);
 assert.match(index,/release-history-ui\.js/);
 assert.match(renderer,/renderReleaseHistoryRows/);
 assert.match(renderer,/data-release-history-more/);
 assert.match(renderer,/release-history-search/);
 assert.match(renderer,/release-history-type/);
 assert.match(releaseUi,/data-release-history-open/);
});
test("history IPC is guarded and uses public GitHub release API",()=>{
 assert.match(main,/ipcMain\.handle\("app:release-history"/);
 assert.match(main,/event\.sender!==mainWindow\?\.webContents/);
 assert.match(main,/RELEASE_HISTORY_API_BASE/);
 assert.match(main,/normalizeHistoryPage/);
 assert.match(main,/ipcMain\.handle\("app:open-release"/);
 assert.match(main,/releaseHistoryUrl\(tag\)/);
 assert.match(preload,/history:\(page,refresh=false\)=>ipcRenderer\.invoke\("app:release-history"/);
 assert.match(preload,/openRelease:tag=>ipcRenderer\.invoke\("app:open-release"/);
});
test("version history release version increments and remains alpha",()=>{
 assert.match(pkg.version,/^\d+\.\d+\.\d+-alpha\.\d+$/);
 assert.equal(pkg.version,"0.2.10-alpha.87");
 assert.match(index,/ALPHA 87/);
});

test("version history displays bundled changes and distinguishes offline entries",()=>{
 assert.match(main,/loadBundledHistory/);
 assert.match(main,/attachBundledDetails/);
 assert.match(main,/localHistoryFallback/);
 assert.match(releaseUi,/アプリ同梱の詳細更新履歴/);
 assert.match(releaseUi,/公開情報未確認/);
 assert.match(releaseUi,/使用中/);
 assert.match(renderer,/releaseHistorySummary/);
});
