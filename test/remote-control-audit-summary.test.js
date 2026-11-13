"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {summarizeRemoteAudit}=require("../src/remote-control-audit-summary");
test("summarizes totals, warnings, anomalies and distinct source IPs",()=>{
 const result=summarizeRemoteAudit([
  {type:"auth_failed",severity:"warning",ip:"192.168.1.2"},
  {type:"security_anomaly",severity:"warning",ip:"192.168.1.2"},
  {type:"pair_succeeded",severity:"info",ip:"192.168.1.3"},
  {type:"command_failed",severity:"warning",ip:""}
 ]);
 assert.deepEqual(result,{total:4,warnings:3,anomalies:1,uniqueSources:2});
});
test("returns zeroed summary for empty or invalid input",()=>{
 assert.deepEqual(summarizeRemoteAudit(null),{total:0,warnings:0,anomalies:0,uniqueSources:0});
 assert.deepEqual(summarizeRemoteAudit([null,{}, {type:"auth_failed",ip:4}]),{total:3,warnings:0,anomalies:0,uniqueSources:0});
});
test("counts only non-empty string IP addresses and does not expose them",()=>{
 const result=summarizeRemoteAudit([{ip:" 10.0.0.1 "},{ip:"10.0.0.1"},{ip:"10.0.0.2"}]);
 assert.equal(result.uniqueSources,2);
 assert.equal(Object.hasOwn(result,"ips"),false);
});
