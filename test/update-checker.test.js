"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  parseVersion,
  compareVersions,
  normalizeRelease,
  buildUpdateCheckResult
}=require("../src/update-checker");

test("parses beta and stable semantic versions",()=>{
  assert.deepEqual(parseVersion("v0.1.0-beta.23"),{
    major:0,minor:1,patch:0,prerelease:["beta","23"]
  });
  assert.deepEqual(parseVersion("1.2.3"),{
    major:1,minor:2,patch:3,prerelease:[]
  });
  assert.equal(parseVersion("01.2.3"),null);
  assert.equal(parseVersion("1.2.3-beta.01"),null);
  assert.equal(parseVersion("not-a-version"),null);
});

test("compares prerelease identifiers and stable releases by semantic version",()=>{
  assert.equal(compareVersions("0.1.0-beta.22","0.1.0-beta.23"),-1);
  assert.equal(compareVersions("0.1.0-beta.9","0.1.0-beta.10"),-1);
  assert.equal(compareVersions("0.1.0-beta.23","0.1.0"),-1);
  assert.equal(compareVersions("0.1.0","0.1.0"),0);
  assert.equal(compareVersions("0.2.0-beta.1","0.1.99"),1);
  assert.equal(compareVersions("1.0.0-beta.999999999999999999999","1.0.0-beta.1000000000000000000000"),-1);
  assert.equal(compareVersions("invalid","0.1.0"),null);
});

test("ignores draft and malformed releases and selects the newest valid version",()=>{
  const result=buildUpdateCheckResult("0.1.0-beta.22",[
    {tag_name:"v0.1.0-beta.21",draft:false,assets:[]},
    {tag_name:"v0.1.0-beta.24",draft:true,assets:[]},
    {tag_name:"latest",draft:false,assets:[]},
    {tag_name:"v0.1.0-beta.23",draft:false,name:"Beta 23",body:"更新内容",published_at:"2026-11-12T10:00:00Z",assets:[{name:"setup.exe"}]}
  ]);
  assert.equal(result.ok,true);
  assert.equal(result.latestVersion,"0.1.0-beta.23");
  assert.equal(result.updateAvailable,true);
  assert.equal(result.release.name,"Beta 23");
  assert.equal(result.release.assetsCount,1);
  assert.equal(result.release.releaseUrl,"https://github.com/kanenao/kananeo-nico-live-stream/releases/tag/v0.1.0-beta.23");
});

test("does not recommend alpha to stable users; beta can graduate to stable",()=>{
 const assets=[{name:"app-Setup-x64.exe"},{name:"latest.yml"},{name:"beta.yml"},{name:"alpha.yml"}];
 const entries=[
  {tag_name:"v1.1.0-alpha.100",assets},
  {tag_name:"v1.0.1",assets}
 ];
 const stable=buildUpdateCheckResult("1.0.0",entries);
 assert.equal(stable.latestVersion,"1.0.1");
 assert.equal(stable.automaticUpdateAvailable,true);
 const beta=buildUpdateCheckResult("1.0.0-beta.4",entries);
 assert.equal(beta.latestVersion,"1.0.1");
 const alpha=buildUpdateCheckResult("1.0.0-alpha.4",entries);
 assert.equal(alpha.latestVersion,"1.1.0-alpha.100");
});
test("missing installer manifest does not count as automatic installation ready",()=>{
 const r=buildUpdateCheckResult("0.2.0-alpha.10",[{tag_name:"v0.2.0-alpha.11",assets:[{name:"app-Setup-x64.exe"}]}]);
 assert.equal(r.updateAvailable,true);
 assert.equal(r.automaticUpdateAvailable,false);
 assert.match(r.message,/自動更新用ファイル/);
});
test("reports when no public releases are available",()=>{
  const result=buildUpdateCheckResult("0.1.0-beta.23",[]);
  assert.equal(result.ok,true);
  assert.equal(result.updateAvailable,false);
  assert.equal(result.latestVersion,null);
  assert.equal(result.release,null);
});

test("does not expose draft releases or accept invalid API response shapes",()=>{
  assert.equal(normalizeRelease({tag_name:"v1.0.0",draft:true}),null);
  assert.equal(normalizeRelease({tag_name:"not-semver",draft:false}),null);
  assert.equal(buildUpdateCheckResult("bad",[]).code,"INVALID_CURRENT_VERSION");
  assert.equal(buildUpdateCheckResult("1.0.0",{}).code,"INVALID_RELEASES");
});
