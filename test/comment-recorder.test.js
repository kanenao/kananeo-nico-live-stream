"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { CommentRecorder } = require("../src/comment-recorder");

test("records safe JSONL entries and flushes them on close", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "kananeo-recorder-"));
  const recorder = new CommentRecorder(temp, "lv123456789");
  const file = await recorder.open();
  await recorder.write({
    id: "11",
    type: "comment",
    timestamp: "2026-11-11T00:00:00.000Z",
    userName: "viewer",
    userId: "user-id",
    content: "こんにちは",
    isHistory: false,
    raw: { cookie: "must-not-be-saved" }
  });
  await recorder.write({
    id: "12",
    type: "operatorComment",
    timestamp: "2026-11-11T00:00:01.000Z",
    userName: "運営",
    userId: "",
    content: "番組からのお知らせ",
    isHistory: true
  });
  await recorder.close();
  const rows = (await fs.readFile(file, "utf8")).trim().split("\\n").map(JSON.parse);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].content, "こんにちは");
  assert.equal(rows[1].type, "operatorComment");
  assert.equal(Object.hasOwn(rows[0], "raw"), false);
  assert.equal(JSON.stringify(rows).includes("must-not-be-saved"), false);
});

test("rejects unsafe IDs and unsupported event types", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "kananeo-recorder-"));
  assert.throws(() => new CommentRecorder(temp, "../../secret"), TypeError);
  const recorder = new CommentRecorder(temp, "lv123");
  await recorder.open();
  await assert.rejects(recorder.write({ type: "raw", content: "x" }), /not available/i);
  await recorder.close();
});
