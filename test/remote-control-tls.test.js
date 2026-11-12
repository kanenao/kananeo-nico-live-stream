"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {isPrivateLanIpv4,validateLanTlsMaterial}=require("../src/remote-control-tls");
test("accepts only RFC1918 IPv4 LAN addresses",()=>{
 for(const ip of ["10.0.0.5","10.255.1.2","172.16.0.1","172.31.255.254","192.168.0.1","192.168.100.20"])assert.equal(isPrivateLanIpv4(ip),true,ip);
 for(const ip of ["127.0.0.1","0.0.0.0","8.8.8.8","169.254.1.2","172.15.0.1","172.32.0.1","192.167.1.2","224.0.0.1","::1","localhost"])assert.equal(isPrivateLanIpv4(ip),false,ip);
});
test("requires private LAN address and both bounded PEM files",()=>{
 assert.equal(validateLanTlsMaterial({bindAddress:"8.8.8.8",certificate:"cert",privateKey:"key"}).code,"INVALID_BIND_ADDRESS");
 assert.equal(validateLanTlsMaterial({bindAddress:"192.168.1.25"}).code,"TLS_FILES_REQUIRED");
 assert.equal(validateLanTlsMaterial({bindAddress:"192.168.1.25",certificate:"not a certificate",privateKey:"not a key"}).code,"TLS_INVALID_PEM");
});
