"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createRemoteControlAnomalyDetector}=require("../src/remote-control-anomaly");

test("detects five failures from one IP in a rolling minute",()=>{
 let time=1000;const detector=createRemoteControlAnomalyDetector({now:()=>time});
 for(let i=0;i<4;i++){assert.equal(detector.observe({type:"auth_failed",ip:"192.168.1.20"}),null);time+=1000;}
 const result=detector.observe({type:"peer_rejected",ip:"192.168.1.20"});
 assert.deepEqual(result,{type:"security_anomaly",ip:"192.168.1.20",command:"ip_burst"});
});
test("does not alert again during cooldown and alerts after cooldown",()=>{
 let time=1000;const detector=createRemoteControlAnomalyDetector({now:()=>time,cooldownMs:5000,globalThreshold:99});
 const burst=()=>{let result=null;for(let i=0;i<5;i++){const current=detector.observe({type:"auth_failed",ip:"10.0.0.8"});if(current)result=current;time+=1;}return result;};
 assert.equal(burst().command,"ip_burst");
 assert.equal(burst(),null);
 time+=5001;
 assert.equal(burst().command,"ip_burst");
});
test("detects aggregate connection bursts and ignores successful events and its own alert",()=>{
 let time=1000;const detector=createRemoteControlAnomalyDetector({now:()=>time,globalThreshold:3,ipThreshold:99});
 assert.equal(detector.observe({type:"pair_succeeded"}),null);
 detector.observe({type:"host_rejected",ip:"10.0.0.1"});time++;
 detector.observe({type:"origin_rejected",ip:"10.0.0.2"});time++;
 const result=detector.observe({type:"cross_site_rejected",ip:"10.0.0.3"});
 assert.deepEqual(result,{type:"security_anomaly",ip:"",command:"connection_burst"});
 assert.equal(detector.observe(result),null);
});
test("expires old failures outside the rolling window",()=>{
 let time=1000;const detector=createRemoteControlAnomalyDetector({now:()=>time,windowMs:1000});
 for(let i=0;i<4;i++){detector.observe({type:"auth_failed",ip:"10.0.0.4"});time+=300;}
 time+=1001;
 assert.equal(detector.observe({type:"auth_failed",ip:"10.0.0.4"}),null);
});
