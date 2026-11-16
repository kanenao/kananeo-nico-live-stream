"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {createHash}=require("node:crypto");
const {makeManifest,generate,channelsForVersion}=require("../scripts/generate-update-manifest");
const sha=createHash("sha512").update("installer").digest("base64");
test("alpha manifests include Setup installer and checksum",()=>{
 const m=makeManifest("0.2.0-alpha.65","kananeo.nico.live.stream-0.2.0-alpha.65-Setup-x64.exe",200,sha,"2026-11-16T00:00:00Z");
 assert.match(m,/version: 0\.2\.0-alpha\.65/);assert.match(m,/sha512: [A-Za-z0-9+/]{86}==/);
 assert.doesNotMatch(m,/Portable/);
});
test("beta and stable produce descriptors for older subscribed tracks",()=>{
 assert.deepEqual(channelsForVersion("1.0.0-beta.2"),["beta","alpha"]);
 assert.deepEqual(channelsForVersion("1.0.0"),["latest","beta","alpha"]);
 assert.match(makeManifest("1.0.0","app-1.0.0-Setup-x64.exe",200,sha,"2026-11-16T00:00:00Z"),/version: 1\.0\.0/);
});
test("does not allow path traversal or incorrect versions",()=>{
 assert.throws(()=>makeManifest("1.0.0-unknown.1","app-Setup-x64.exe",200,sha,new Date().toISOString()));
 assert.throws(()=>makeManifest("1.0.0","../app-Setup-x64.exe",200,sha,new Date().toISOString()));
});
test("all expected stage manifests are generated with the same signed checksum",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"kananeo-manifest-"));
 try{
  const binary="test installer payload";
  fs.writeFileSync(path.join(dir,"app-1.0.0-Setup-x64.exe"),binary);
  generate(dir,"1.0.0");
  for(const channel of ["latest","beta","alpha"]){
   const data=fs.readFileSync(path.join(dir,channel+".yml"),"utf8");
   assert.match(data,/version: 1\.0\.0/);
   assert.match(data,new RegExp(createHash("sha512").update(binary).digest("base64").replace(/[+]/g,"\\+")));
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
