"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");
function makeManifest(version,name,size,sha,date){
 if(!/^\d+\.\d+\.\d+-alpha\.\d+$/.test(version))throw Error("Invalid prerelease version");
 if(!/^[\w. -]+-Setup-x64\.exe$/.test(name))throw Error("Invalid installer name");
 if(!Number.isSafeInteger(size)||size<=0||!/^[A-Za-z0-9+/]{86}==$/.test(sha))throw Error("Invalid installer checksum");
 if(!Number.isFinite(Date.parse(date)))throw Error("Invalid release date");
 return ["version: "+version,"files:","  - url: "+JSON.stringify(name),"    sha512: "+sha,"    size: "+size,"path: "+JSON.stringify(name),"sha512: "+sha,"releaseDate: "+new Date(date).toISOString(),""].join("\n");
}
function generate(dist=path.resolve(__dirname,"..","dist"),version=require("../package.json").version){
 const names=fs.readdirSync(dist).filter(n=>n.endsWith("-Setup-x64.exe")&&n.includes("-"+version+"-"));
 if(names.length!==1)throw Error("Expected one Setup x64 installer for "+version);
 const name=names[0],binary=fs.readFileSync(path.join(dist,name));
 const manifest=makeManifest(version,name,binary.length,createHash("sha512").update(binary).digest("base64"),new Date().toISOString());
 fs.writeFileSync(path.join(dist,"alpha.yml"),manifest);
 return name;
}
if(require.main===module)console.info("Generated alpha.yml for "+generate());
module.exports={makeManifest,generate};
