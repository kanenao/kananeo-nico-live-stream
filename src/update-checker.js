"use strict";

const RELEASE_PAGE_BASE = "https://github.com/kanenao/kananeo-nico-live-stream/releases/tag/";

function parseVersion(input) {
  const value = String(input ?? "").trim();
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major,minor,patch].every(Number.isSafeInteger)) return null;
  return {
    major,minor,patch,
    prerelease:match[4] ? match[4].split(".") : []
  };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length,right.length);
  for (let i=0;i<length;i++) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    if (left[i] === right[i]) continue;
    const leftNumeric = /^\d+$/.test(left[i]);
    const rightNumeric = /^\d+$/.test(right[i]);
    if (leftNumeric && rightNumeric) {
      const a = Number(left[i]), b = Number(right[i]);
      if (a !== b) return a < b ? -1 : 1;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else {
      return left[i] < right[i] ? -1 : 1;
    }
  }
  return 0;
}

function compareVersions(leftInput, rightInput) {
  const left = parseVersion(leftInput);
  const right = parseVersion(rightInput);
  if (!left || !right) return null;
  for (const key of ["major","minor","patch"]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease,right.prerelease);
}

function normalizeRelease(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || input.draft === true) return null;
  const tagName = String(input.tag_name ?? "").trim().slice(0,100);
  if (!parseVersion(tagName)) return null;
  const version = tagName.replace(/^v/i,"");
  const publishedAt = typeof input.published_at === "string" && Number.isFinite(Date.parse(input.published_at))
    ? new Date(input.published_at).toISOString() : "";
  const assets = Array.isArray(input.assets) ? input.assets : [];
  return {
    tagName,
    version,
    name:String(input.name || tagName).replace(/[\r\n]+/g," ").trim().slice(0,160),
    body:String(input.body || "").slice(0,10000),
    publishedAt,
    prerelease:input.prerelease === true,
    assetsCount:assets.length,
    releaseUrl:RELEASE_PAGE_BASE+encodeURIComponent(tagName)
  };
}

function buildUpdateCheckResult(currentVersion, releasesInput) {
  const current = String(currentVersion ?? "").trim();
  if (!parseVersion(current)) {
    return {ok:false,code:"INVALID_CURRENT_VERSION",message:"現在のアプリバージョンを判定できません。"};
  }
  if (!Array.isArray(releasesInput)) {
    return {ok:false,code:"INVALID_RELEASES",message:"GitHubから取得したリリース情報の形式が正しくありません。"};
  }
  const releases = releasesInput.map(normalizeRelease).filter(Boolean);
  if (!releases.length) {
    return {
      ok:true,currentVersion:current,latestVersion:null,updateAvailable:false,
      release:null,message:"GitHub Releasesに公開済みのリリースはまだありません。"
    };
  }
  releases.sort((a,b)=>compareVersions(a.version,b.version));
  const release = releases[releases.length-1];
  const comparison = compareVersions(release.version,current);
  return {
    ok:true,
    currentVersion:current,
    latestVersion:release.version,
    updateAvailable:comparison > 0,
    release,
    message:comparison > 0 ? "新しいバージョンが公開されています。"
      : comparison === 0 ? "このアプリは公開されている最新版です。"
      : "公開リリースより新しいバージョンを利用しています。"
  };
}

module.exports = Object.freeze({
  parseVersion,
  compareVersions,
  normalizeRelease,
  buildUpdateCheckResult
});
