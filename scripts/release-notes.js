"use strict";

const {parseBundledChangelog}=require("../src/bundled-changelog");

function releaseBodyForVersion(version,changelog){
 const entries=parseBundledChangelog(changelog);
 const section=entries.find(item=>item.version===version);
 if(!section||!section.notes.length)throw Error("CHANGELOG.mdに対象バージョンの更新内容がありません: "+String(version));
 const stage=version.includes("-alpha.")?"α開発版":version.includes("-beta.")||version.includes("-rc.")?"βテスト版":"製品版";
 const intro=stage==="α開発版"
  ?"開発中のα版です。機能・動作は未完成で、Windows実機でのすべての操作は未検証です。"
  :stage==="βテスト版"
  ?"テスト用のβ版です。重要な設定とデータをバックアップしてから利用してください。"
  :"製品版です。更新時は既存の配信を終了してから適用してください。";
 return [
  intro,
  "",
  "Windows x64版はSetup（インストール用）またはPortable（インストール不要）を選択してください。",
  "",
  "## "+version+" の追加機能・変更・修正内容",
  ...section.notes.map(note=>"- "+note),
  "",
  "詳細な履歴はCHANGELOG.mdおよびアプリの「バージョン更新履歴」から確認できます。"
 ].join("\n");
}
module.exports={releaseBodyForVersion};
