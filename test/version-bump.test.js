"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {
 parseVersion,bumpVersion,replaceVersion,classifyChangeMessages,
 isReleaseRelevantFile,prependReleaseNotes
}=require("../scripts/bump-version");

test("every released small change increments patch base and keeps alpha continuous",()=>{
 assert.equal(bumpVersion("0.1.0-alpha.41","patch"),"0.1.1-alpha.42");
 assert.equal(bumpVersion("0.1.1-alpha.94","patch"),"0.1.2-alpha.95");
 assert.equal(bumpVersion("0.2.0-alpha.77","patch"),"0.2.1-alpha.78");
 assert.equal(bumpVersion("0.2.1-alpha.78","patch"),"0.2.2-alpha.79");
});
test("feature-level changes advance minor base without resetting alpha",()=>{
 assert.equal(bumpVersion("0.1.1-alpha.94","feature"),"0.2.0-alpha.95");
 assert.equal(bumpVersion("0.2.1-alpha.78","feature"),"0.3.0-alpha.79");
 assert.equal(bumpVersion("0.9.9-alpha.1","feature"),"0.10.0-alpha.2");
});
test("auto classifications are driven by code changes, not arbitrary words in docs",()=>{
 assert.deepEqual(classifyChangeMessages(["fix: HTTP 406 duration"],["src/video-metadata.js"]).kind,"patch");
 assert.deepEqual(classifyChangeMessages(["feat: broadcaster dashboard"],["src/renderer.js"]).kind,"feature");
 assert.deepEqual(classifyChangeMessages(["feat(small): improve duration labels"],["src/renderer.js"]).kind,"patch");
 assert.deepEqual(classifyChangeMessages(["feat!: incompatible UI"],["src/main.js"]).kind,"feature");
 assert.deepEqual(classifyChangeMessages(["feat: tooling"],["scripts/bump-version.js"]).kind,"patch");
 assert.deepEqual(classifyChangeMessages(["fix: player"],["README.md","test/update-checker.test.js"]).kind,"none");
 assert.deepEqual(classifyChangeMessages([],["src/main.js"]).kind,"none");
 assert.equal(isReleaseRelevantFile("src/renderer.js"),true);
 assert.equal(isReleaseRelevantFile("README.md"),false);
});
test("release notes use recorded commit summaries rather than inventing changes",()=>{
 const next=prependReleaseNotes("# バージョン更新履歴\n\n## 0.2.0-alpha.77\n", "0.2.1-alpha.78",78,
  ["fix: resolve API HTTP 406"],"patch");
 assert.match(next,/## 0\.2\.1-alpha\.78\n- fix: resolve API HTTP 406/);
 assert.match(next,/## 0\.2\.0-alpha\.77/);
 assert.equal(prependReleaseNotes(next,"0.2.1-alpha.78",78,[],"patch"),next);
});
test("stable release is never generated automatically",()=>{
 assert.throws(()=>parseVersion("1.0.0"));
 assert.throws(()=>bumpVersion("0.1.0-alpha.1","release"));
 assert.equal(bumpVersion("0.9.9-alpha.99","feature"),"0.10.0-alpha.100");
});
test("replaces version strings in controlled app metadata",()=>{
 assert.equal(replaceVersion("v0.1.0-alpha.41 / 0.1.0-alpha.41","0.1.0-alpha.41","0.1.1-alpha.42"),
  "v0.1.1-alpha.42 / 0.1.1-alpha.42");
});
