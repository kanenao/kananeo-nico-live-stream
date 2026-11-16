"use strict";
// Release-channel hierarchy: stable never silently installs prerelease builds.
// Alpha can graduate to beta/stable, beta to stable; never to a lower stability tier.
function getReleaseChannel(version) {
 const text=String(version||"").trim().replace(/^v/i,"");
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text))return null;
 const suffix=text.split("-").slice(1).join("-").split(".")[0]?.toLowerCase();
 if(!suffix)return "latest";
 if(suffix==="alpha")return "alpha";
 if(suffix==="beta"||suffix==="rc")return "beta";
 return null;
}
function channelsForVersion(version) {
 const channel=getReleaseChannel(version);
 if(channel==="alpha")return ["alpha"];
 if(channel==="beta")return ["beta","alpha"];
 if(channel==="latest")return ["latest","beta","alpha"];
 return [];
}
function isAllowedReleaseTrack(currentVersion,targetVersion) {
 const current=getReleaseChannel(currentVersion),target=getReleaseChannel(targetVersion);
 if(!current||!target)return false;
 return (current==="alpha"||current==="beta"&&target!=="alpha"||current==="latest"&&target==="latest");
}
module.exports={getReleaseChannel,channelsForVersion,isAllowedReleaseTrack};
