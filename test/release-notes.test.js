"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {releaseBodyForVersion}=require("../scripts/release-notes");
test("uses the exact target version's written changes in the release body",()=>{
 const source="# バージョン更新履歴\n## 0.2.0-alpha.67\n- 追加：履歴の強化\n- 修正：オフライン表示\n## 0.2.0-alpha.66\n- 旧版の変更";
 const result=releaseBodyForVersion("0.2.0-alpha.67",source);
 assert.match(result,/追加：履歴の強化/);
 assert.match(result,/修正：オフライン表示/);
 assert.doesNotMatch(result,/旧版の変更/);
 assert.match(result,/Setup/);
});
test("missing or empty release notes prevent publishing incomplete release",()=>{
 assert.throws(()=>releaseBodyForVersion("0.2.0-alpha.67","## 0.2.0-alpha.66\n- 改善"));
 assert.throws(()=>releaseBodyForVersion("0.2.0-alpha.67","## 0.2.0-alpha.67\n説明だけ"));
});
test("current project version has a complete change list",()=>{
 const root=path.resolve(__dirname,"..");
 const version=require("../package.json").version;
 const source=fs.readFileSync(path.join(root,"CHANGELOG.md"),"utf8");
 const body=releaseBodyForVersion(version,source);
 assert.match(body,new RegExp(version.replace(/[.]/g,"\\.")));
 assert.match(body,/^- /m);
});
