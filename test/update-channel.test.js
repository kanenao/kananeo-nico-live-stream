"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {getReleaseChannel,channelsForVersion,isAllowedReleaseTrack}=require("../src/update-channel");
test("detects alpha, beta, release-candidate and stable stages",()=>{
 assert.equal(getReleaseChannel("0.2.0-alpha.65"),"alpha");
 assert.equal(getReleaseChannel("v0.3.0-beta.10"),"beta");
 assert.equal(getReleaseChannel("0.3.0-rc.1"),"beta");
 assert.equal(getReleaseChannel("1.0.0"),"latest");
 assert.equal(getReleaseChannel("x.y.z"),null);
});
test("generates metadata for the current release and less stable subscribers",()=>{
 assert.deepEqual(channelsForVersion("0.2.0-alpha.65"),["alpha"]);
 assert.deepEqual(channelsForVersion("1.0.0-beta.1"),["beta","alpha"]);
 assert.deepEqual(channelsForVersion("1.0.0"),["latest","beta","alpha"]);
});
test("allows promotions but never stable to alpha or beta",()=>{
 assert.equal(isAllowedReleaseTrack("0.2.0-alpha.10","0.2.0-beta.1"),true);
 assert.equal(isAllowedReleaseTrack("0.2.0-beta.1","0.2.0-alpha.11"),false);
 assert.equal(isAllowedReleaseTrack("1.0.0","1.1.0-alpha.50"),false);
 assert.equal(isAllowedReleaseTrack("1.0.0","1.0.1"),true);
});
