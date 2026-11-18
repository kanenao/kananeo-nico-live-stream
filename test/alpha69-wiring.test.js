"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=file=>fs.readFileSync(path.join(root,file),"utf8");
const renderer=read("src/renderer.js"),main=read("src/main.js"),preload=read("src/preload.js");
test("in-app create form calls permission checked main-process API with explicit confirmation",()=>{
 assert.match(renderer,/data-create-program-in-app/);
 assert.match(renderer,/create-program-title/);
 assert.match(renderer,/create-program-description/);
 assert.match(renderer,/create-program-member-only/);
 assert.match(renderer,/createProgramInApp\(\{title,description,category,tags,isMemberOnly,confirmed:true\}\)/);
 assert.match(main,/ipcMain\.handle\("niconico:create-program-in-app"/);
 assert.match(main,/manualCreatePending/);
 assert.match(main,/manual-create-attempts\.json/);
 assert.match(main,/buildCreateProgramRequest\(checked\.payload,token\)/);
 assert.match(preload,/createProgramInApp:input=>ipcRenderer\.invoke/);
});
test("poll metadata is retrieved only for verified quotation and has a manual duration fallback",()=>{
 assert.match(renderer,/data-poll-duration-fetch/);
 assert.match(renderer,/data-poll-duration-set/);
 assert.match(renderer,/ensureCurrentQuoteDuration/);
 assert.match(renderer,/quotePlayback\.videoId!==id/);
 assert.match(renderer,/Never use the previous quoted video's duration/);
 assert.match(main,/ipcMain\.handle\("niconico:video-metadata"/);
 assert.match(preload,/getVideoMetadata:videoId=>ipcRenderer\.invoke/);
});
test("auto-start requests is opt-in and runs only on confirmed own ON_AIR status",()=>{
 assert.match(renderer,/autoPlayOnOwnLive:false/);
 assert.match(renderer,/id="request-auto-on-live"/);
 assert.match(renderer,/maybeAutoPlayOnOwnLive/);
 assert.match(renderer,/\["ON_AIR","ONAIR"\]/);
 assert.match(renderer,/state\.playback\.lastAutoPlayProgramId=id/);
 assert.match(renderer,/getCurrentQuotation\(\{programId:id\}\)/);
 assert.match(renderer,/triggeredByAuto:true,skipConfirmation:true,programId:id/);
 const own=read("src/own-broadcast-monitor.js");
 assert.match(own,/programStatus:String\(x\.programStatus/);
});
