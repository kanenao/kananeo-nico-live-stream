"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const main=get("src/main.js"),renderer=get("src/renderer.js");
const moduleSource=get("src/registered-user-monitor.js");
test("the UI saves the Windows notification preference and passes it to the main process",()=>{
 assert.match(renderer,/id="stream-monitor-notify-live"/);
 assert.match(renderer,/state\.streamMonitor\.notifyOnLive=document\.getElementById/);
 assert.match(renderer,/notifyOnLive:config\.notifyOnLive===true/);
 assert.match(renderer,/registeredMonitorStatus\.failedUsers/);
 assert.match(renderer,/registeredMonitorStatus\.checkedUsers/);
});
test("only opted-in notifications are shown and an existing app can be focused",()=>{
 assert.match(main,/registeredUserMonitor\?\.status\(\)\.notifyOnLive&&Notification\.isSupported\(\)/);
 assert.match(main,/niconico:registered-user-live/);
 assert.match(main,/mainWindow\.focus\(\)/);
});
test("watcher stays bounded and does not reset on repeated identical configurations",()=>{
 assert.match(moduleSource,/MAX_CONCURRENT_CHECKS=3/);
 assert.match(moduleSource,/if\(unchanged\)return/);
 assert.match(moduleSource,/if\(token===generation\)/);
});
