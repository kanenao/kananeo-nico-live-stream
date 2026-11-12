"use strict";
const net=require("node:net"),tls=require("node:tls");
const {createPrivateKey,createPublicKey,X509Certificate,timingSafeEqual}=require("node:crypto");
const MAX_PEM_BYTES=512*1024;
function isPrivateLanIpv4(value){
 if(typeof value!=="string"||net.isIP(value)!==4)return false;
 const octets=value.split(".").map(Number);
 if(octets.length!==4||octets.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
 const [a,b]=octets;
 return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
function validateLanTlsMaterial({bindAddress,certificate,privateKey,now=Date.now()}={}){
 if(!isPrivateLanIpv4(bindAddress))return {ok:false,code:"INVALID_BIND_ADDRESS",message:"LAN接続にはプライベートIPv4アドレスが必要です。"};
 if(typeof certificate!=="string"||!certificate.trim()||typeof privateKey!=="string"||!privateKey.trim()||Buffer.byteLength(certificate,"utf8")>MAX_PEM_BYTES||Buffer.byteLength(privateKey,"utf8")>MAX_PEM_BYTES)
  return {ok:false,code:"TLS_FILES_REQUIRED",message:"TLS証明書と秘密鍵（PEM形式）を選択してください。"};
 try{
  const x509=new X509Certificate(certificate),validFrom=Date.parse(x509.validFrom),validTo=Date.parse(x509.validTo);
  if(!Number.isFinite(validFrom)||!Number.isFinite(validTo)||now<validFrom||now>=validTo)return {ok:false,code:"TLS_CERT_EXPIRED",message:"証明書がまだ有効でないか、有効期限が切れています。"};
  const matchedIp=typeof x509.checkIP==="function"?x509.checkIP(bindAddress):undefined;
  if(!matchedIp)return {ok:false,code:"TLS_SAN_MISMATCH",message:"証明書のSANに選択したLAN IPアドレスが含まれていません。"};
  const keyObject=createPrivateKey(privateKey),certPublic=x509.publicKey.export({format:"der",type:"spki"}),keyPublic=createPublicKey(keyObject).export({format:"der",type:"spki"});
  if(certPublic.length!==keyPublic.length||!timingSafeEqual(certPublic,keyPublic))return {ok:false,code:"TLS_KEY_MISMATCH",message:"証明書と秘密鍵の組み合わせが一致しません。"};
  tls.createSecureContext({key:privateKey,cert:certificate,minVersion:"TLSv1.2"});
  return {ok:true,fingerprint256:x509.fingerprint256,validTo:x509.validTo,subject:x509.subject};
 }catch{return {ok:false,code:"TLS_INVALID_PEM",message:"TLS証明書または秘密鍵を読み取れません。未暗号化のPEM形式を選択してください。"};}
}
module.exports={MAX_PEM_BYTES,isPrivateLanIpv4,validateLanTlsMaterial};
