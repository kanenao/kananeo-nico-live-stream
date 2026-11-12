"use strict";

const DEFAULT_COMMENT_VIEW_SETTINGS = Object.freeze({
  version: 1,
  fontSize: 10,
  columns: Object.freeze({
    number: true,
    time: true,
    user: true,
    userId: true,
    content: true,
    type: true
  }),
  order: Object.freeze(["number", "time", "user", "userId", "content", "type"]),
  colors: Object.freeze({
    comment: "#d8dfed",
    operatorComment: "#ffd38a",
    gift: "#e6a8ff",
    emotion: "#8de4e0",
    notification: "#98b5ff"
  })
});

const COLUMN_KEYS = Object.freeze(["number", "time", "user", "userId", "content", "type"]);
const COLOR_KEYS = Object.freeze(["comment", "operatorComment", "gift", "emotion", "notification"]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCommentViewSettings(input) {
  const source = isPlainObject(input) ? input : {};
  const sourceColumns = isPlainObject(source.columns) ? source.columns : {};
  const sourceColors = isPlainObject(source.colors) ? source.colors : {};
  const rawFontSize = Number(source.fontSize);
  const fontSize = Number.isFinite(rawFontSize)
    ? Math.max(8, Math.min(18, Math.round(rawFontSize)))
    : DEFAULT_COMMENT_VIEW_SETTINGS.fontSize;

  const columns = {};
  for (const key of COLUMN_KEYS) {
    columns[key] = typeof sourceColumns[key] === "boolean"
      ? sourceColumns[key]
      : DEFAULT_COMMENT_VIEW_SETTINGS.columns[key];
  }
  // The comment body is essential; the other columns remain optional.
  columns.content = true;

  const order = [];
  if (Array.isArray(source.order)) {
    for (const key of source.order) {
      if (COLUMN_KEYS.includes(key) && !order.includes(key)) order.push(key);
    }
  }
  for (const key of COLUMN_KEYS) {
    if (!order.includes(key)) order.push(key);
  }

  const colors = {};
  for (const key of COLOR_KEYS) {
    const value = sourceColors[key];
    colors[key] = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase()
      : DEFAULT_COMMENT_VIEW_SETTINGS.colors[key];
  }

  return {version: 1, fontSize, columns, order, colors};
}

const api = Object.freeze({
  DEFAULT_COMMENT_VIEW_SETTINGS,
  COLUMN_KEYS,
  COLOR_KEYS,
  normalizeCommentViewSettings
});

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.KananeoCommentViewSettings = api;
