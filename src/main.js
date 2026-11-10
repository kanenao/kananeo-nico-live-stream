"use strict";

const { app, BrowserWindow, shell, session, ipcMain } = require("electron");
const path = require("node:path");
const { normalizeProgramId, inspectWatchPage, NiconicoPageError } = require("./niconico-program");

const NICONICO_HOME = "https://live.nicovideo.jp/";
const NICONICO_WATCH_BASE = "https://live2.nicovideo.jp/watch/";
const NICONICO_PARTITION = "persist:kananeo-niconico";
const REQUEST_TIMEOUT_MS = 15000;
let mainWindow = null;
let loginWindow = null;
let niconicoSession = null;

function isNiconicoHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "nicovideo.jp" || host.endsWith(".nicovideo.jp");
}

function isTrustedNiconicoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isNiconicoHost(url.hostname);
  } catch {
    return false;
  }
}

async function getNiconicoSessionStatus() {
  if (!niconicoSession) {
    return { authenticated: false, checkedAt: new Date().toISOString(), label: "未確認" };
  }
  try {
    const cookies = await niconicoSession.cookies.get({ url: NICONICO_HOME });
    const nowSeconds = Date.now() / 1000;
    const present = cookies.some(cookie =>
      cookie.name === "user_session" &&
      (!cookie.expirationDate || cookie.expirationDate > nowSeconds)
    );
    return {
      authenticated: present,
      checkedAt: new Date().toISOString(),
      label: present ? "ログインCookieを確認" : "未ログイン / 再確認が必要"
    };
  } catch {
    return { authenticated: false, checkedAt: new Date().toISOString(), label: "状態を確認できません" };
  }
}

async function notifySessionStatus() {
  const status = await getNiconicoSessionStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("niconico:session-changed", status);
  }
}

function openNiconicoLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return { opened: true, reused: true };
  }

  loginWindow = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    title: "ニコニコ公式ログイン - kananeo nico live stream",
    autoHideMenuBar: true,
    webPreferences: {
      session: niconicoSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  loginWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNiconicoUrl(url)) return { action: "allow" };
    try {
      const target = new URL(url);
      if (target.protocol === "https:") shell.openExternal(url);
    } catch {}
    return { action: "deny" };
  });
  loginWindow.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).protocol !== "https:") event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  loginWindow.on("closed", () => {
    loginWindow = null;
    void notifySessionStatus();
  });
  loginWindow.loadURL(NICONICO_HOME).catch(() => {
    if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
  });
  return { opened: true, reused: false };
}

async function checkNiconicoProgram(input) {
  let programId;
  try {
    programId = normalizeProgramId(input);
  } catch (error) {
    return {
      ok: false,
      code: error.code || "INVALID_PROGRAM_ID",
      message: error.message || "放送IDを確認してください。"
    };
  }

  const url = NICONICO_WATCH_BASE + encodeURIComponent(programId);
  let response;
  try {
    response = await niconicoSession.fetch(url, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      code: timedOut ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      programId,
      message: timedOut
        ? "番組ページの確認がタイムアウトしました。"
        : "ニコニコ生放送へ接続できませんでした。ネットワークを確認してください。"
    };
  }

  if (!isTrustedNiconicoUrl(response.url || url)) {
    return { ok: false, code: "UNTRUSTED_REDIRECT", programId, message: "安全確認できないURLへ転送されたため中止しました。" };
  }
  const finalUrl = new URL(response.url || url);
  if (/\/(login|signin)(\/|\?|$)/i.test(finalUrl.pathname)) {
    return { ok: false, code: "AUTH_REQUIRED", programId, message: "この番組ページを確認するにはニコニコへのログインが必要です。" };
  }
  if (response.status === 404) {
    return { ok: false, code: "PROGRAM_NOT_FOUND", programId, message: "放送ページが見つかりません。放送IDを確認してください。" };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: "ACCESS_DENIED", programId, message: "この番組ページへのアクセスが拒否されました。限定公開や合言葉の設定も確認してください。" };
  }
  if (!response.ok) {
    return { ok: false, code: "HTTP_ERROR", programId, message: `番組ページの取得に失敗しました（HTTP ${response.status}）。` };
  }

  let html;
  try {
    html = await response.text();
  } catch {
    return { ok: false, code: "READ_ERROR", programId, message: "番組ページの内容を読み取れませんでした。" };
  }
  if (html.length > 6 * 1024 * 1024) {
    return { ok: false, code: "RESPONSE_TOO_LARGE", programId, message: "番組ページのサイズが想定より大きいため、安全のため中止しました。" };
  }

  try {
    const info = inspectWatchPage(html, programId);
    return {
      ok: true,
      ...info,
      message: info.watchingApiAvailable
        ? "番組ページと視聴用API情報を確認しました。コメント接続は次の段階で実装します。"
        : "番組ページを確認しましたが、視聴用API情報は見つかりませんでした。"
    };
  } catch (error) {
    if (error instanceof NiconicoPageError) {
      return { ok: false, code: error.code, programId, message: error.message };
    }
    return { ok: false, code: "PARSE_ERROR", programId, message: "番組情報を解析できませんでした。" };
  }
}

function registerIpcHandlers() {
  ipcMain.handle("niconico:open-login", () => openNiconicoLoginWindow());
  ipcMain.handle("niconico:get-session-status", () => getNiconicoSessionStatus());
  ipcMain.handle("niconico:logout", async () => {
    try {
      await niconicoSession.clearStorageData({
        storages: ["cookies", "localstorage", "indexdb", "serviceworkers", "cachestorage"]
      });
      await notifySessionStatus();
      return { ok: true, message: "このアプリ専用のニコニコセッションを削除しました。" };
    } catch {
      return { ok: false, message: "セッションを削除できませんでした。" };
    }
  });
  ipcMain.handle("niconico:check-program", (_event, input) => {
    if (typeof input !== "string" || input.length > 512) {
      return { ok: false, code: "INVALID_INPUT", message: "放送IDまたはURLを入力してください。" };
    }
    return checkNiconicoProgram(input);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1510,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: "kananeo nico live stream",
    backgroundColor: "#0a0f1d",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedNiconicoUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) event.preventDefault();
  });
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  niconicoSession = session.fromPartition(NICONICO_PARTITION);
  niconicoSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  niconicoSession.cookies.on("changed", () => { void notifySessionStatus(); });
  registerIpcHandlers();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
