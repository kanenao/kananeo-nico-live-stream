"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("nicomget exposes the Nico Live provider entry point",async t=>{
  const installed=fs.existsSync(path.join(process.cwd(),"node_modules","nicomget"));
  if(!installed){
    t.skip("nicomget is not installed in this local test environment");
    return;
  }
  const module=await import("nicomget/niconico");
  assert.equal(typeof module.NiconicoProvider,"function");
});
