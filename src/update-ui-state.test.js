"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {inAppUpdateNotice}=require("./update-ui-state");

test("update banner remains visible even without an available release",()=>{
 for(const phase of ["idle","checking","error","unavailable","downloaded","downloading"]){
  const view=inAppUpdateNotice({supported:true,phase},null);
  assert.equal(view.visible,true,phase);
  assert.ok(view.title,phase);
 }
});
test("latest version remains visible and allows a manual check",()=>{
 const view=inAppUpdateNotice({supported:true,phase:"idle"},{ok:true,updateAvailable:false});
 assert.match(view.title,/最新版/);
 assert.equal(view.action,"check");
});
test("errors can be retried without hiding the banner",()=>{
 const view=inAppUpdateNotice({supported:true,phase:"error",message:"HTTP 404"});
 assert.equal(view.visible,true);
 assert.match(view.detail,/404/);
 assert.equal(view.action,"check");
});
test("downloaded updates retain the guarded apply action",()=>{
 const view=inAppUpdateNotice({supported:true,phase:"downloaded",version:"0.2.9-alpha.87"});
 assert.equal(view.action,"apply");
 assert.match(view.title,/0.2.9-alpha.87/);
});
test("portable/unsupported update still provides a releases route",()=>{
 const view=inAppUpdateNotice({supported:false,phase:"idle"});
 assert.equal(view.visible,true);
 assert.equal(view.action,"releases");
});
