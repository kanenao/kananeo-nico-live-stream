"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");
const renderer=read("src/renderer.js"),css=read("src/style.css"),preload=read("src/preload.js");
const ranking=read("src/ranking-monitor.js"),pkg=JSON.parse(read("package.json"));
const broadcast=renderer.slice(renderer.indexOf('}else if(page==="broadcast"){'),renderer.indexOf('}else if(page==="programs"){'));
test("broadcast management shows original stage with live native-video container",()=>{
 assert.ok(broadcast.includes("STREAM STAGE")||broadcast.includes("STAGE / 01"));
 assert.ok(broadcast.includes('id="broadcast-video-slot"'));
 assert.ok(broadcast.includes('data-live-video-open'));
 assert.ok(broadcast.includes('data-live-video-reload'));
 assert.ok(broadcast.includes('data-live-video-mute'));
 assert.ok(broadcast.includes('data-live-video-close'));
 assert.ok(broadcast.includes('broadcast-stage-visual'));
 assert.ok(broadcast.includes('broadcast-stage-footer'));
 assert.doesNotMatch(broadcast,/LIVE WINDOW/);
});
test("comment composer is inside the comment panel and has only one send button",()=>{
 const aside=broadcast.indexOf('<aside class="broadcast-comments-panel"');
 const form=broadcast.indexOf('<form id="broadcast-comment-send-form"');
 const commentList=broadcast.indexOf('<div id="broadcast-comments-list"');
 const end=broadcast.indexOf('</aside>');
 assert.ok(aside>=0&&form>commentList&&form<end);
 assert.equal((broadcast.match(/id="broadcast-comment-send-form"/g)||[]).length,1);
 assert.equal((broadcast.match(/type="submit" class="btn broadcast-send-button"/g)||[]).length,1);
 assert.ok(!broadcast.includes("data-broadcast-emoji"));
 assert.ok(!broadcast.includes("broadcast-icon-button emoji"));
 assert.match(renderer,/postBroadcasterComment\(\{programId,text\}\)/);
});
test("broadcast and monitor pages share a single ranking data source",()=>{
 for(const marker of ['id="broadcast-ranking-monitor-cards"','id="broadcast-ranking-monitor-status"',
  'id="ranking-monitor-cards"','id="ranking-monitor-status"','data-ranking-monitor-check',
  'data-go="monitor"','配信ランキング監視'])assert.ok(renderer.includes(marker),marker);
 assert.match(renderer,/document\.querySelectorAll\("#ranking-monitor-cards, #broadcast-ranking-monitor-cards"\)/);
 assert.match(renderer,/for\(const host of cards\)host\.innerHTML=rankingMarkup/);
 assert.match(renderer,/if\(page==="monitor"\|\|page==="broadcast"\)renderRankingMonitorUi\(\)/);
 assert.match(renderer,/if\(page==="broadcast"\)\{renderBroadcastToolsUi\(\);renderBroadcastCommentSettingsControls\(\);renderBroadcastComments\(\);updateBroadcastLivePanel\(\);renderRankingMonitorUi\(\);updateBroadcastOverview\(\);\}/);
 assert.match(renderer,/window\.kananeoApp\.niconico\.checkOwnRanking\(\)/);
 assert.match(ranking,/const SOURCES = Object\.freeze\(\[/);
});
test("broadcast info displays real program and stats without fabricated ranks",()=>{
 for(const id of ["broadcast-overview-title","broadcast-overview-status","broadcast-overview-viewers","broadcast-overview-comments","broadcast-overview-remaining"])assert.ok(renderer.includes(id),id);
 assert.match(renderer,/function updateBroadcastOverview\(\)/);
 assert.match(renderer,/dashboardStats\.watchCount==null\?"—"/);
 assert.match(renderer,/dashboardStats\.commentCount==null\?"—"/);
 assert.match(renderer,/formatRemainingTime\(\)/);
 assert.doesNotMatch(broadcast,/12位|8位|21位/);
});
test("comment controls, user filters and safety remain wired",()=>{
 for(const marker of ["data-broadcast-comment-start","data-broadcast-comment-stop","data-broadcast-ng-toggle",
 "data-broadcast-comment-clear","data-broadcast-comments-copy","data-broadcast-comment-clear-user",
 "broadcast-comment-type","broadcast-comment-search","data-broadcast-font-decrease","data-broadcast-font-increase",
 "data-broadcast-user","data-broadcast-read-through"])assert.ok(renderer.includes(marker),marker);
 assert.match(renderer,/nicoStatus\.authenticated&&!broadcastCommentSending/);
 assert.match(renderer,/Array\.from\(text\)\.length>200/);
});
test("redesigned screen has responsive readable CSS",()=>{
 for(const marker of [".broadcast-stage-visual",".broadcast-comments-header",".broadcast-comment-compose-row",
 ".broadcast-overview-grid",".broadcast-ranking-cards",".broadcast-overview-details",
 ".broadcast-stage-footer",".broadcast-video-placeholder",".broadcast-comment-item"])assert.ok(css.includes(marker),marker);
 assert.match(css,/@media\(max-width:1130px\)/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/\.broadcast-comment-compose-row\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
});
test("the alpha98 stage redesign remains available in the newer alpha release",()=>{
 assert.equal(pkg.version,"0.6.0-alpha.99");
 assert.match(preload,/version:"0\.6\.0-alpha\.99"/);
});
