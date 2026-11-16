"use strict";
const fs=require("node:fs"),path=require("node:path");
const {getReleaseChannel}=require("../src/update-channel");
function makeConfig(version) {
 const channel=getReleaseChannel(version);
 if(!channel)throw Error("Unsupported application update channel");
 return ["provider: github","owner: kanenao","repo: kananeo-nico-live-stream","channel: "+channel,""].join("\n");
}
function prepare(version=require("../package.json").version,file=path.resolve(__dirname,"..","config","app-update.yml")){
 const content=makeConfig(version);
 fs.writeFileSync(file,content,"utf8");
 return content;
}
if(require.main===module)console.info("Prepared app-update.yml for "+require("../package.json").version+"\n"+prepare());
module.exports={makeConfig,prepare};
