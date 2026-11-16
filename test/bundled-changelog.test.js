"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {parseBundledChangelog,attachBundledDetails,localHistoryFallback}=require("../src/bundled-changelog");

test("parses bundled changelog without fabricating missing sections",()=>{
 const source="# バージョン更新履歴\n## 0.2.0-alpha.67\n- 追加：履歴を改善\n- 修正：ネットワーク切断時の表示\n## 0.2.0-alpha.66\n- 追加：更新履歴ページ\nこの他の文字は説明にしない";
 const rows=parseBundledChangelog(source);
 assert.deepEqual(rows,[
  {version:"0.2.0-alpha.67",notes:["追加：履歴を改善","修正：ネットワーク切断時の表示"]},
  {version:"0.2.0-alpha.66",notes:["追加：更新履歴ページ"]}
 ]);
 assert.deepEqual(parseBundledChangelog("## not-a-version\n- 架空の追加"),[]);
});

test("attaches bundled details to confirmed releases without changing their published metadata",()=>{
 const result={ok:true,page:1,items:[{tag:"v0.2.0-alpha.66",version:"0.2.0-alpha.66",publishedAt:"2026-11-16T16:12:05Z",notes:["PRの説明"]}]};
 const local=[{version:"0.2.0-alpha.66",notes:["追加：検索","修正：UI"]}];
 const merged=attachBundledDetails(result,local);
 assert.equal(merged.items[0].publishedAt,"2026-11-16T16:12:05Z");
 assert.deepEqual(merged.items[0].notes,["PRの説明"]);
 assert.deepEqual(merged.items[0].details,["追加：検索","修正：UI"]);
 assert.equal(merged.items[0].localOnly,false);
 assert.deepEqual(result.items[0].notes,["PRの説明"]);
});

test("offline fallback never invents published dates or confirmed assets",()=>{
 const local=[{version:"0.2.0-alpha.67",notes:["追加：機能"]}];
 const res=localHistoryFallback(local,1,"ネットワーク未接続");
 assert.equal(res.offline,true);assert.equal(res.items[0].localOnly,true);
 assert.equal(res.items[0].publishedAt,"");
 assert.equal(res.items[0].releaseUrl,"");
 assert.equal(res.items[0].setupAvailable,false);
 assert.equal(localHistoryFallback(local,2,"error"),null);
 assert.equal(localHistoryFallback([],1,"error"),null);
});

test("includes real authored entries in the packaged changelog",()=>{
 const pkg=require("../package.json");
 const doc=fs.readFileSync(path.resolve(__dirname,"..","CHANGELOG.md"),"utf8");
 const entries=parseBundledChangelog(doc);
 assert.ok(entries.length>=9,"At least alpha59-alpha67 must have documented notes");
 assert.equal(entries[0].version,pkg.version,"the bundled changelog must start with the current version");
 assert.ok(entries[0].notes.length>0);
 assert.ok(pkg.build.files.includes("CHANGELOG.md"),"bundled notes must ship inside the installer");
});
