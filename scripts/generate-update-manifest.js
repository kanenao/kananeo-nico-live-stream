"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");
const {channelsForVersion}=require("../src/update-channel");
function makeManifest(version,name,size,sha,date){
 if(!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(version)||!channelsForVersion(version).length)
  throw Error("Invalid release version");
 if(!/^[\w. -]+-Setup-x64\.exe$/.test(name))throw Error("Invalid installer name");
 if(!Number.isSafeInteger(size)||size<=0||!/^[A-Za-z0-9+/]{86}==$/.test(sha))
  throw Error("Invalid installer checksum");
 if(!Number.isFinite(Date.parse(date)))throw Error("Invalid release date");
 return ["version: "+version,"files:","  - url: "+JSON.stringify(name),"    sha512: "+sha,"    size: "+size,
  "path: "+JSON.stringify(name),"sha512: "+sha,"releaseDate: "+new Date(date).toISOString(),""].join("\n");
}
function generate(dist=path.resolve(__dirname,"..","dist"),version=require("../package.json").version){
 const names=fs.readdirSync(dist).filter(n=>n.endsWith("-Setup-x64.exe")&&n.includes("-"+version+"-"));
 if(names.length!==1)throw Error("Expected one Setup x64 installer for "+version);
 const channels=channelsForVersion(version);
 if(!channels.length)throw Error("Unsupported update channel");
 const name=names[0],binary=fs.readFileSync(path.join(dist,name));
 const text=makeManifest(version,name,binary.length,createHash("sha512").update(binary).digest("base64"),new Date().toISOString());
 for(const channel of channels)fs.writeFileSync(path.join(dist,channel+".yml"),text,"utf8");
 return {name,channels};
}
if(require.main===module){
 const result=generate();console.info("Generated "+result.channels.map(c=>c+".yml").join(", ")+" for "+result.name);
}
module.exports={makeManifest,generate,channelsForVersion};
