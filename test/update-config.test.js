"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {makeConfig}=require("../scripts/prepare-update-config");
test("embed correct publish channel for every release stage",()=>{
 assert.match(makeConfig("0.2.0-alpha.65"),/channel: alpha/);
 assert.match(makeConfig("1.0.0-beta.1"),/channel: beta/);
 assert.match(makeConfig("1.0.0"),/channel: latest/);
 assert.throws(()=>makeConfig("1.0.0-nightly.2"));
});
