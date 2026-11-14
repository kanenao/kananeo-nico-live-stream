"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MAX_HISTORY,normalizeHistory,appendHistory}=require("../src/stream-monitor-history");
test("normalizes monitor history and rejects malformed entries",()=>{
 const rows=normalizeHistory([{type:"live",programId:"LV123",message:"開始",at:"2026-11-14T00:00:00Z"},{type:"bad",programId:"https://evil",message:"x".repeat(400),at:"invalid"},null]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].programId,"lv123");
 assert.equal(rows[0].message.length,240);
});
test("prepends newest history and caps retained records",()=>{
 let rows=[];
 for(let i=0;i<MAX_HISTORY+5;i++)rows=appendHistory(rows,{type:"info",programId:"lv123",message:"event "+i,at:"2026-11-14T00:00:00Z"});
 assert.equal(rows.length,MAX_HISTORY);
 assert.equal(rows[0].message,"event 104");
});
test("does not accept empty or invalid history events",()=>{
 assert.deepEqual(appendHistory([],null),[]);
 assert.deepEqual(appendHistory([],{type:"error",message:""}),[]);
});
