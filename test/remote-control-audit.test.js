"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createRemoteAuditLog}=require("../src/remote-control-audit");
test("audit history is bounded, newest first, and excludes sensitive fields",()=>{let t=Date.UTC(2026,0,1);const log=createRemoteAuditLog({limit:20,now:()=>t++});for(let i=0;i<25;i++)log.record({type:"auth_failed",ip:"192.168.1.2",method:"POST",path:"/api/pair",token:"secret",body:"private"});const rows=log.list({limit:50});assert.equal(rows.length,20);assert.equal(rows[0].id,25);assert.equal(rows[19].id,6);assert.equal(rows[0].severity,"warning");assert.equal(Object.hasOwn(rows[0],"token"),false);assert.equal(Object.hasOwn(rows[0],"body"),false);});
test("audit input is sanitized",()=>{const row=createRemoteAuditLog().record({type:"arbitrary",command:"Bearer secret",path:"bad"});assert.equal(row.type,"unknown");assert.equal(row.command,"");assert.equal(row.path,"");});
test("audit history can be cleared",()=>{const log=createRemoteAuditLog();log.record({type:"pair_succeeded"});log.clear();assert.deepEqual(log.list(),[]);});
