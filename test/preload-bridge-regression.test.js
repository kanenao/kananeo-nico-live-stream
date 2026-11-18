"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"..",p),"utf8");
const ui=read("src/renderer.js"),preload=read("src/preload.js"),main=read("src/main.js");

test("every renderer niconico bridge method is actually exposed by preload",()=>{
 const calls=[...new Set([...ui.matchAll(/window\.kananeoApp\.niconico\.([A-Za-z_]\w*)/g)].map(match=>match[1]))];
 assert.ok(calls.length>=40);
 const missing=calls.filter(name=>!new RegExp("\\b"+name+":").test(preload));
 assert.deepEqual(missing,[]);
});
test("own-broadcast and newly created broadcast events are wired end to end",()=>{
 assert.match(ui,/niconico\.getOwnBroadcast\(\)/);
 assert.match(preload,/getOwnBroadcast:\(\)=>ipcRenderer\.invoke\("niconico:own-broadcast"\)/);
 assert.match(main,/ipcMain\.handle\("niconico:own-broadcast"/);
 assert.match(main,/send\("niconico:created-broadcast"/);
 assert.match(preload,/ipcRenderer\.on\("niconico:created-broadcast"/);
 assert.match(ui,/onCreatedBroadcast\?\.\(/);
});
test("new live request auto-play preserves verified program ID and chosen candidate",()=>{
 const section=ui.slice(ui.indexOf("async function maybeAutoPlayOnOwnLive("),ui.indexOf("function applyOwnMonitorStatus("));
 assert.match(section,/getOwnBroadcast\(\)/);
 assert.match(section,/getCurrentQuotation\(\{programId:id\}\)/);
 assert.match(section,/selectedCandidate:selected/);
 assert.match(section,/programId:id/);
 assert.match(ui,/programId:options\.programId\|\|""/);
 assert.match(ui,/const programId=options\.programId\|\|state\.lastProgramId\|\|commentConnection\.programId/);
 assert.match(ui,/loaded\.requests=.*status:item\?\.status==="playing"\?"queued"/s);
});
test("automatic poll preflight is exclusive and cancellation aware",()=>{
 assert.match(ui,/let pollStartPending=false/);
 assert.match(ui,/if\(pollRuntime\.active\|\|pollStartPending\)/);
 assert.match(ui,/const setupGeneration=pollRunToken/);
 assert.match(ui,/if\(setupGeneration!==pollRunToken\)return/);
 assert.match(ui,/finally\{pollStartPending=false;\}/);
});