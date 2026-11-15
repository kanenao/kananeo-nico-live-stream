"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {sanitizeUiError,uiStatusLabel}=require("../src/ui-health");
test("hides credentials and private paths in UI errors",()=>{
 const value=sanitizeUiError(new Error("user_session=secretvalue https://example.com/?token=secret C:\\Users\\person\\file.txt"));
 assert.equal(value.name,"Error");
 assert.doesNotMatch(value.message,/secretvalue|example\.com|person/);
 assert.match(value.message,/\[非表示\]/);
});
test("reports renderer bootstrap and preload states",()=>{
 assert.match(uiStatusLabel(false,false),/初期化/);
 assert.match(uiStatusLabel(true,false),/Electron/);
 assert.match(uiStatusLabel(true,true),/認識/);
});
test("loads independent health checks before the event handlers",()=>{
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"src/index.html"),"utf8");
 const renderer=fs.readFileSync(path.join(root,"src/renderer.js"),"utf8");
 assert.ok(html.indexOf('src="ui-health.js"')>=0);
 assert.ok(html.indexOf('src="ui-health.js"')<html.indexOf('src="renderer.js"'));
 assert.match(html,/id="ui-health-check"/);
 assert.match(renderer,/KananeoUiHealth\?\.markReady\(\)/);
 assert.match(renderer,/handleUiClick\(e\)\.catch\(/);
 assert.match(renderer,/handleUiSubmit\(e\)\.catch\(/);
});
