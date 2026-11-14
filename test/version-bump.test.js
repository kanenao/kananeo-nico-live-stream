"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseVersion, bumpVersion, replaceVersion } = require("../scripts/bump-version");

test("small changes bump the patch base and keep alpha sequence", () => {
  assert.equal(bumpVersion("0.1.0-alpha.41", "patch"), "0.1.1-alpha.42");
  assert.equal(bumpVersion("0.1.1-alpha.94", "patch"), "0.1.2-alpha.95");
});

test("feature changes bump the minor base without resetting alpha", () => {
  assert.equal(bumpVersion("0.1.1-alpha.94", "feature"), "0.2.0-alpha.95");
});

test("rejects release versions and unsupported bump kinds", () => {
  assert.throws(() => parseVersion("1.0.0"));
  assert.throws(() => bumpVersion("0.1.0-alpha.1", "release"));
});

test("replaces every matching version occurrence", () => {
  assert.equal(replaceVersion("v0.1.0-alpha.41 / 0.1.0-alpha.41", "0.1.0-alpha.41", "0.1.1-alpha.42"), "v0.1.1-alpha.42 / 0.1.1-alpha.42");
});
