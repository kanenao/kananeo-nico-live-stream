"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {MAX_HISTORY,normalizeHistory,appendHistory,historyEntryToken,removeHistoryEntry,clearHistory}=require("../src/stream-monitor-history");
test("normalizes monitor history and rejects malformed entries",()=>{
 const rows=normalizeHistory([{type:"live",programId:"LV123",message:"開始",at:"2026-11-14T00:00:00Z"},{type:"bad",programId:"https://evil",message:"x".repeat(400),at:"invalid"},null]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].programId,"lv123");
 assert.equal(rows[0].message,"開始");
 const bounded=normalizeHistory([{type:"info",programId:"",message:"x".repeat(400),at:"2026-11-14T00:00:00Z"}]);
 assert.equal(bounded[0].message.length,240);
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

test("removes one exact monitor history row without deleting adjacent events",()=>{
 const rows=[
  {type:"live",programId:"lv111",message:"放送開始",at:"2026-11-22T01:00:00.000Z"},
  {type:"error",programId:"lv222",message:"確認失敗",at:"2026-11-22T01:01:00.000Z"},
  {type:"stopped",programId:"",message:"監視停止",at:"2026-11-22T01:02:00.000Z"}
 ];
 const original=normalizeHistory(rows);
 const token=historyEntryToken(original[1]);
 const deleted=removeHistoryEntry(original,1,token);
 assert.equal(deleted.removed,true);
 assert.deepEqual(deleted.history,[original[0],original[2]]);
 assert.deepEqual(original,rows);
});
test("stale index/token does not delete another monitor event after automatic insertion",()=>{
 const first=appendHistory([],{type:"live",programId:"lv10",message:"開始",at:"2026-11-22T01:00:00Z"});
 const oldToken=historyEntryToken(first[0]);
 const updated=appendHistory(first,{type:"error",programId:"lv20",message:"取得失敗",at:"2026-11-22T01:00:01Z"});
 const stale=removeHistoryEntry(updated,0,oldToken);
 assert.equal(stale.removed,false);
 assert.deepEqual(stale.history,updated);
 const correct=removeHistoryEntry(updated,1,oldToken);
 assert.equal(correct.removed,true);
 assert.equal(correct.history.length,1);
 assert.equal(correct.history[0].programId,"lv20");
 assert.equal(removeHistoryEntry(updated,-1,oldToken).removed,false);
 assert.equal(removeHistoryEntry(updated,1,"").removed,false);
 assert.equal(removeHistoryEntry(updated,"1",oldToken).removed,false);
});
test("clear-all removes complete persisted history, not only latest twenty",()=>{
 let entries=[];
 for(let i=0;i<42;i++)entries=appendHistory(entries,{
  type:"info",programId:"lv101",message:"履歴 "+i,at:"2026-11-22T01:00:00Z"
 });
 assert.equal(entries.length,42);
 assert.deepEqual(clearHistory(entries),[]);
 assert.equal(entries.length,42);
 const newEvent=appendHistory(clearHistory(entries),{
  type:"live",programId:"lv101",message:"削除後の新しい放送",at:"2026-11-22T01:05:00Z"
 });
 assert.equal(newEvent.length,1);
 assert.equal(newEvent[0].message,"削除後の新しい放送");
});
