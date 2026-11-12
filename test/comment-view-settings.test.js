"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_COMMENT_VIEW_SETTINGS,
  normalizeCommentViewSettings
} = require("../src/comment-view-settings");

test("returns safe defaults for missing or invalid settings", () => {
  assert.deepEqual(normalizeCommentViewSettings(null), normalizeCommentViewSettings({}));
  assert.deepEqual(normalizeCommentViewSettings({}), {
    version: 1,
    fontSize: 10,
    columns: {number:true,time:true,user:true,userId:true,content:true,type:true},
    order: ["number","time","user","userId","content","type"],
    colors: {
      comment: "#d8dfed",
      operatorComment: "#ffd38a",
      gift: "#e6a8ff",
      emotion: "#8de4e0",
      notification: "#98b5ff"
    }
  });
  assert.equal(DEFAULT_COMMENT_VIEW_SETTINGS.fontSize, 10);
});

test("clamps font size and forces the comment body column to remain visible", () => {
  const normalized = normalizeCommentViewSettings({
    fontSize: 100,
    columns: {number:false,content:false}
  });
  assert.equal(normalized.fontSize, 18);
  assert.equal(normalized.columns.number, false);
  assert.equal(normalized.columns.content, true);
  assert.equal(normalizeCommentViewSettings({fontSize: 1}).fontSize, 8);
});

test("normalizes column order, removes duplicates, and appends missing columns", () => {
  const normalized = normalizeCommentViewSettings({
    order: ["type","type","unknown","content","number"]
  });
  assert.deepEqual(normalized.order, ["type","content","number","time","user","userId"]);
});

test("accepts only six-digit hex colors and normalizes case", () => {
  const normalized = normalizeCommentViewSettings({
    colors: {comment:"#AABBCC",gift:"red",operatorComment:"#12345g"}
  });
  assert.equal(normalized.colors.comment, "#aabbcc");
  assert.equal(normalized.colors.gift, "#e6a8ff");
  assert.equal(normalized.colors.operatorComment, "#ffd38a");
});
