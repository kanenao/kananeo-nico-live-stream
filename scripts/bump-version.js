"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseVersion(value) {
  const match = String(value || "").match(/^(\\d+)\\.(\\d+)\\.(\\d+)-alpha\\.(\\d+)$/);
  if (!match) throw new Error("α版のバージョン形式 X.Y.Z-alpha.N が必要です。");
  return match.slice(1).map(Number);
}

function bumpVersion(current, kind = "patch") {
  const [major, minor, patch, alpha] = parseVersion(current);
  if (kind === "patch") {
    const nextPatch = major === 0 && minor === 1 && patch === 0 ? 1 : patch + 1;
    return `${major}.${minor}.${nextPatch}-alpha.${alpha + 1}`;
  }
  if (kind === "feature") return `${major}.${minor + 1}.0-alpha.${alpha + 1}`;
  throw new Error("更新種別は patch または feature を指定してください。");
}

function replaceVersion(content, current, next) {
  if (!content.includes(current)) throw new Error(`バージョン ${current} がファイル内に見つかりません。`);
  return content.split(current).join(next);
}

function run() {
  const kind = process.argv[2] || "patch";
  const root = path.resolve(__dirname, "..");
  const packagePath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const current = pkg.version;
  const next = bumpVersion(current, kind);
  const targets = ["README.md", "src/preload.js", "src/index.html", "docs/VERSIONING.md"];
  const updated = new Map();
  for (const relative of targets) {
    const file = path.join(root, relative);
    updated.set(file, replaceVersion(fs.readFileSync(file, "utf8"), current, next));
  }
  pkg.version = next;
  updated.set(packagePath, JSON.stringify(pkg, null, 2) + "\\n");
  for (const [file, content] of updated) fs.writeFileSync(file, content, "utf8");
  console.log(`バージョンを ${current} から ${next} に更新しました。`);
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseVersion, bumpVersion, replaceVersion };
