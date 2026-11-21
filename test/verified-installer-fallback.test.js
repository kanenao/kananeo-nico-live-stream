"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {Readable}=require("node:stream");
const {createHash}=require("node:crypto");
const {verifiedInstallerInfo,trustedAssetResponse,downloadVerifiedInstaller}=require("../src/verified-installer-fallback");
const version="0.3.1-alpha.90",tag="v"+version,name="kananeo.nico.live.stream-"+version+"-Setup-x64.exe";
const installer=Buffer.from("legitimate installer bytes for tests");
const digest="sha256:"+createHash("sha256").update(installer).digest("hex");
const target={version,tag,installer:{name,size:installer.length,id:123456789,digest}};
const response=(url,buffer,status=200)=>({
 url,status,body:Readable.toWeb(Readable.from([buffer])),
 headers:{get:field=>field.toLowerCase()==="content-length"?String(buffer.length):"application/octet-stream"}
});
test("accepts only exact official release Setup metadata and cryptographic digest",()=>{
 const info=verifiedInstallerInfo(target);
 assert.equal(info.name,name);
 assert.equal(info.assetUrl,"https://api.github.com/repos/kanenao/kananeo-nico-live-stream/releases/assets/123456789");
 assert.equal(verifiedInstallerInfo({...target,installer:{...target.installer,digest:""}}),null);
 assert.equal(verifiedInstallerInfo({...target,installer:{...target.installer,name:"fake.exe"}}),null);
 assert.equal(verifiedInstallerInfo({...target,tag:"v0.3.0-alpha.89"}),null);
 assert.equal(trustedAssetResponse("https://evil.example/download"),false);
 assert.equal(trustedAssetResponse("http://github.com/download"),false);
 assert.equal(trustedAssetResponse("https://release-assets.githubusercontent.com/file"),true);
});
test("404 on browser download retries official release asset API and verifies complete SHA256",async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"kananeo-update-test-"));
 const urls=[];
 try{
  const result=await downloadVerifiedInstaller(target,{directory:dir,fetchImpl:async(url)=>{
   urls.push(url);
   return url.includes("/releases/download/")?response(url,Buffer.from("Not found"),404):
    response("https://release-assets.githubusercontent.com/file",installer);
  }});
  assert.equal(urls.length,2);
  assert.ok(urls[0].includes(name));
  assert.ok(urls[1].includes("/releases/assets/123456789"));
  assert.equal(result.source,"github-assets-api");
  assert.deepEqual(await fs.readFile(result.filePath),installer);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("checksum mismatch never produces an installable file and leaves no partial download",async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"kananeo-update-test-"));
 try{
  await assert.rejects(downloadVerifiedInstaller(target,{directory:dir,
   fetchImpl:async()=>response("https://release-assets.githubusercontent.com/file",
    Buffer.from("invalid same byte size bytes"))}),e=>e.code==="DOWNLOAD_SIZE_MISMATCH"||e.code==="DOWNLOAD_VERIFY_FAILED");
  assert.equal((await fs.readdir(dir)).length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("untrusted redirects never write an installer even if status is 200",async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"kananeo-update-test-"));
 try{
  await assert.rejects(downloadVerifiedInstaller(target,{directory:dir,
   fetchImpl:async()=>response("https://untrusted.invalid/setup.exe",installer)}),e=>e.code==="OFFICIAL_DOWNLOAD_UNAVAILABLE");
  assert.equal((await fs.readdir(dir)).length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
