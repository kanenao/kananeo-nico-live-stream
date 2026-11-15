"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");
const {makeManifest}=require("../scripts/generate-update-manifest");
const sha=createHash("sha512").update("fake installer").digest("base64");
test("alpha update descriptor references the Setup executable and SHA-512",()=>{
 const m=makeManifest("0.2.0-alpha.52","kananeo.nico.live.stream-0.2.0-alpha.52-Setup-x64.exe",123456,sha,"2026-11-16T00:00:00Z");
 assert.match(m,/version: 0\.2\.0-alpha\.52/);
 assert.match(m,/size: 123456/);
 assert.match(m,/sha512: [A-Za-z0-9+/]{86}==/);
 assert.doesNotMatch(m,/Portable/);
});
test("descriptor rejects an incorrect channel or unsafe filename",()=>{
 assert.throws(()=>makeManifest("0.2.0-beta.52","program-Setup-x64.exe",100,sha,new Date().toISOString()));
 assert.throws(()=>makeManifest("0.2.0-alpha.52","../program-Setup-x64.exe",100,sha,new Date().toISOString()));
});
