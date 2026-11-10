"use strict";

const NDGR_HOST="mpn.live.nicovideo.jp";
const NDGR_PATHS=Object.freeze({
  message:"/api/view/v4/",
  segment:"/data/segment/v4/",
  backward:"/data/backward/v4/"
});
function isTrustedNdgrUri(value,kind){
  const prefix=NDGR_PATHS[kind];
  if(!prefix||typeof value!=="string")return false;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&url.hostname.toLowerCase()===NDGR_HOST&&url.pathname.startsWith(prefix);
  }catch{return false;}
}
module.exports={NDGR_HOST,NDGR_PATHS,isTrustedNdgrUri};
