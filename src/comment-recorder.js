"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const ALLOWED_TYPES = new Set(["comment", "operatorComment", "gift", "emotion", "notification"]);

function boundedString(value, maxLength) {
  if (value === null || value === undefined) return "";
  return String(value).slice(0, maxLength);
}

class CommentRecorder {
  constructor(userDataDirectory, programId) {
    if (typeof programId !== "string" || !/^lv\\d+$/i.test(programId)) {
      throw new TypeError("A valid Nico Live program ID is required.");
    }
    this.directory = path.join(userDataDirectory, "comment-recordings");
    this.programId = programId.toLowerCase();
    this.filePath = null;
    this.writeQueue = Promise.resolve();
    this.closed = false;
  }

  async open() {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const suffix = crypto.randomBytes(3).toString("hex");
    this.filePath = path.join(this.directory, this.programId + "-" + stamp + "-" + suffix + ".jsonl");
    const handle = await fs.open(this.filePath, "wx", 0o600);
    await handle.close();
    return this.filePath;
  }

  write(entry) {
    if (!this.filePath || this.closed || !entry || !ALLOWED_TYPES.has(entry.type)) {
      return Promise.reject(new Error("Comment recorder is not available."));
    }
    const safeEntry = {
      id: boundedString(entry.id, 128),
      type: entry.type,
      timestamp: boundedString(entry.timestamp, 40),
      userName: boundedString(entry.userName, 128),
      userId: boundedString(entry.userId, 128),
      content: boundedString(entry.content, 4000),
      isHistory: Boolean(entry.isHistory)
    };
    const line = JSON.stringify(safeEntry) + "\\n";
    this.writeQueue = this.writeQueue.then(() => fs.appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 }));
    return this.writeQueue;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.writeQueue;
  }

  get folderPath() {
    return this.directory;
  }
}

module.exports = { CommentRecorder };
