"use strict";

const { app, BrowserWindow, WebContentsView, shell, session, ipcMain, clipboard, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const {
  createPairingChallenge, verifyPairingCode, createDeviceCredential,
  verifyDeviceToken, revokeRemoteDevice, sanitizeRemoteDevice,
  normalizeDeviceName, normalizeDevicePermissions, DEVICE_PERMISSIONS
} = require("./remote-control-security");
const { createRemoteControlServer } = require("./remote-control-server");
const { pathToFileURL } = require("node:url");
const {
  createEmptyVideoLibrary, normalizeVideoLibrary, normalizeVideoEntry,
  mergeVideoEntries, mergeVideoHistory, prepareSelectedVideoEntries, addPlaybackHistory, removeVideoEntry, updateVideoEntry, clearVideoHistory,
  parseVideoImportText
} = require("./video-library");
const { buildNiconicoLibraryRequest, parseNiconicoLibraryResponse } = require("./niconico-library-api");

const {
  normalizeProgramId, inspectWatchPage, extractEmbeddedData, extractBroadcasterCommentToken, NiconicoPageError, isTrustedWebSocketEndpoint
} = require("./niconico-program");
const { normalizeComment, normalizeOperatorComment, normalizeNotification } = require("./comment-normalizer");
const { isTrustedNdgrUri } = require("./ndgr-security");
const { CommentRecorder } = require("./comment-recorder");
const { normalizeNiconicoVideoUrl, extractRequestCandidate, findNextQueueItem } = require("./video-queue");
const { normalizeLiveViewBounds } = require("./live-view-layout");
const { evaluateCommentRequest } = require("./request-policy");
const { decideEnqueteResult } = require("./poll-engine");
const { buildEnqueteRequest, mapEnqueteHttpError, parseEnqueteResultResponse } = require("./enquete-api");
const { buildStatisticsRequest, parseStatisticsResponse } = require("./program-api");
const { buildExtensionOptionsRequest, parseExtensionOptionsResponse } = require("./extension-api");
const {
  buildGetCurrentQuotationRequest, buildPlayQuotationRequest, buildStopQuotationRequest,
  parseCurrentQuotationResponse, parseQuotationMutationResponse
} = require("./quotation-api");
const { selectNextPlaybackCandidate } = require("./playback-scheduler");
const { buildBroadcasterCommentRequest, parseBroadcasterCommentResponse } = require("./broadcaster-comment-api");
const { buildUpdateCheckResult } = require("./update-checker");
const {
  ALLOWED_BGM_EXTENSIONS, MAX_BGM_TRACK_BYTES, MAX_BGM_TRACKS,
  createEmptyBgmLibrary, normalizeBgmLibrary, addBgmTrack, removeBgmTrack, moveBgmTrack
} = require("./bgm-library");

const NICONICO_HOME = "https://live.nicovideo.jp/";
const NICONICO_WATCH_BASE = "https://live2.nicovideo.jp/watch/";
const NICONICO_PARTITION = "persist:kananeo-niconico";
const REQUEST_TIMEOUT_MS = 15000;
const BROADCASTER_COMMENT_MIN_INTERVAL_MS = 5000;
let lastBroadcasterCommentAttemptAt = 0;
let mainWindow = null;
let loginWindow = null;
let broadcastWindow = null;
let liveVideoView = null;
let liveVideoProgramId = "";
let niconicoSession = null;
let commentProvider = null;
let commentProgramId = "";
let commentOperationId = 0;
let commentRecorder = null;
let commentRecordingEnabled = false;
let commentRecoveryTimer = null;
let commentRecoveryAttempts = 0;
let commentRecoveryActive = false;
let finalQuitInProgress = false;
let playerWindow = null;
let playerMonitorTimer = null;
let playerMonitorBusy = false;
let playerMonitorGeneration = 0;
let playerVideoId = "";
let playerVideoUrl = "";
let playerEndNotified = false;
const REMOTE_CONTROL_STORE_FILE_NAME = "remote-control-devices.json";
const REMOTE_CONTROL_MAX_DEVICES = 20;
let remoteControlDevices = [];
let remoteControlStoreLoaded = false;
let remoteControlStoreHealthy = true;
let remoteControlStoreError = "";
let remoteControlStoreQueue = Promise.resolve();
let remoteControlServer = null;
let remoteControlPairing = null;
const pendingRemoteRendererRequests = new Map();

function isNiconicoHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "nicovideo.jp" || host.endsWith(".nicovideo.jp");
}

function isTrustedNiconicoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isNiconicoHost(url.hostname);
  } catch { return false; }
}

async function getNiconicoSessionStatus() {
  if (!niconicoSession) return { authenticated:false, checkedAt:new Date().toISOString(), label:"未確認" };
  try {
    const cookies = await niconicoSession.cookies.get({ url:NICONICO_HOME });
    const now = Date.now()/1000;
    const present = cookies.some(c => c.name === "user_session" && (!c.expirationDate || c.expirationDate > now));
    return { authenticated:present, checkedAt:new Date().toISOString(), label:present ? "ログインCookieを確認" : "未ログイン / 再確認が必要" };
  } catch {
    return { authenticated:false, checkedAt:new Date().toISOString(), label:"状態を確認できません" };
  }
}

async function notifySessionStatus() {
  const status = await getNiconicoSessionStatus();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("niconico:session-changed", status);
}

function openNiconicoLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return { opened:true, reused:true };
  }
  loginWindow = new BrowserWindow({
    width:1080, height:820, minWidth:760, minHeight:600,
    title:"ニコニコ公式ログイン - kananeo nico live stream",
    autoHideMenuBar:true,
    webPreferences:{ session:niconicoSession, contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true }
  });
  loginWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isTrustedNiconicoUrl(url)) return {action:"allow"};
    try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {}
    return {action:"deny"};
  });
  loginWindow.webContents.on("will-navigate", (event,url) => {
    try { if (new URL(url).protocol !== "https:") event.preventDefault(); } catch { event.preventDefault(); }
  });
  loginWindow.on("closed", () => { loginWindow=null; void notifySessionStatus(); });
  loginWindow.loadURL(NICONICO_HOME).catch(() => {
    if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
  });
  return {opened:true,reused:false};
}

function openNiconicoBroadcastWindow(mode, input = "") {
  const navigation = require("./broadcast-navigation").buildBroadcastNavigationUrl(mode, input);
  if (!navigation.ok) return navigation;
  const targetUrl = navigation.url;

  if (broadcastWindow && !broadcastWindow.isDestroyed()) {
    broadcastWindow.focus();
    broadcastWindow.loadURL(targetUrl).catch(() => {});
    return {ok:true,reused:true,mode};
  }

  broadcastWindow = new BrowserWindow({
    width:1120,height:860,minWidth:820,minHeight:640,
    title:mode==="create"?"ニコニコ生放送・番組作成":"ニコニコ生放送・番組管理",
    autoHideMenuBar:true,
    webPreferences:{session:niconicoSession,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
  });
  broadcastWindow.webContents.setWindowOpenHandler(({url}) => {
    if (isTrustedNiconicoUrl(url)) return {action:"allow"};
    try { if (new URL(url).protocol==="https:") shell.openExternal(url); } catch {}
    return {action:"deny"};
  });
  broadcastWindow.webContents.on("will-navigate",(event,url) => {
    if (!isTrustedNiconicoUrl(url)) {
      event.preventDefault();
      try { if (new URL(url).protocol==="https:") shell.openExternal(url); } catch {}
    }
  });
  broadcastWindow.on("closed",()=>{broadcastWindow=null;});
  broadcastWindow.loadURL(targetUrl).catch(()=>{
    if(broadcastWindow&&!broadcastWindow.isDestroyed())broadcastWindow.close();
  });
  return {ok:true,reused:false,mode};
}

function notifyLiveVideoState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("niconico:live-video-state", state);
  }
}

function closeNiconicoLiveVideoView() {
  const view = liveVideoView;
  if (!view) return {ok:true,closed:false};
  liveVideoView = null;
  liveVideoProgramId = "";
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
  } catch {}
  try {
    if (view.webContents && !view.webContents.isDestroyed()) view.webContents.close();
  } catch {}
  notifyLiveVideoState({status:"closed",programId:"",message:"放送画面を閉じました。"});
  return {ok:true,closed:true};
}

function setNiconicoLiveVideoBounds(input) {
  if (!liveVideoView || !mainWindow || mainWindow.isDestroyed()) return {ok:false,code:"VIEW_NOT_OPEN"};
  const bounds = normalizeLiveViewBounds(input, mainWindow.getContentBounds());
  if (!bounds) return {ok:false,code:"INVALID_BOUNDS"};
  if (!bounds.visible) {
    liveVideoView.setVisible(false);
    return {ok:true,visible:false};
  }
  liveVideoView.setBounds({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height});
  liveVideoView.setVisible(true);
  return {ok:true,visible:true};
}

function openNiconicoLiveVideoView(input) {
  let programId;
  try { programId = normalizeProgramId(input); }
  catch (error) {
    return {ok:false,code:error.code || "INVALID_PROGRAM_ID",message:error.message || "放送IDを確認してください。"};
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {ok:false,code:"WINDOW_CLOSED",message:"アプリのメイン画面を確認できません。"};
  }

  const targetUrl = NICONICO_WATCH_BASE + encodeURIComponent(programId);
  if (!liveVideoView) {
    try {
      liveVideoView = new WebContentsView({
        webPreferences:{
          session:niconicoSession,
          contextIsolation:true,
          nodeIntegration:false,
          sandbox:true,
          webSecurity:true
        }
      });
      liveVideoView.setBackgroundColor("#070b14");
      liveVideoView.setBorderRadius(8);
      mainWindow.contentView.addChildView(liveVideoView);
      liveVideoView.setBounds({x:0,y:0,width:1,height:1});
      liveVideoView.setVisible(false);

      const contents = liveVideoView.webContents;
      contents.setWindowOpenHandler(({url}) => {
        if (isTrustedNiconicoUrl(url)) return {action:"allow"};
        try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {}
        return {action:"deny"};
      });
      contents.on("will-navigate",(event,url) => {
        if (!isTrustedNiconicoUrl(url)) {
          event.preventDefault();
          try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {}
        }
      });
      contents.on("did-fail-load",(_event,errorCode,errorDescription,validatedURL,isMainFrame) => {
        if (isMainFrame && errorCode !== -3 && liveVideoView?.webContents === contents) {
          notifyLiveVideoState({
            status:"error",programId:liveVideoProgramId,
            message:"放送画面を読み込めませんでした："+String(errorDescription || errorCode).slice(0,160)
          });
        }
      });
      contents.on("did-finish-load",() => {
        if (liveVideoView?.webContents === contents) {
          notifyLiveVideoState({
            status:"ready",programId:liveVideoProgramId,
            url:contents.getURL(),title:contents.getTitle() || "ニコニコ生放送"
          });
        }
      });
      contents.on("render-process-gone",(_event,details) => {
        if (liveVideoView?.webContents === contents) {
          notifyLiveVideoState({status:"error",programId:liveVideoProgramId,message:"放送画面の描画プロセスが終了しました："+String(details?.reason||"unknown")});
        }
      });
      contents.on("destroyed",() => {
        if (liveVideoView?.webContents === contents) {
          liveVideoView = null;
          liveVideoProgramId = "";
        }
      });
    } catch {
      liveVideoView = null;
      liveVideoProgramId = "";
      return {ok:false,code:"VIEW_CREATE_FAILED",message:"放送画面の表示領域を作成できませんでした。"};
    }
  }

  if (liveVideoProgramId !== programId || liveVideoView.webContents.getURL() !== targetUrl) {
    liveVideoProgramId = programId;
    notifyLiveVideoState({status:"loading",programId,message:"ニコニコ生放送の映像ページを読み込んでいます。"});
    liveVideoView.webContents.loadURL(targetUrl).catch(error => {
      if (liveVideoView && liveVideoProgramId === programId) {
        notifyLiveVideoState({
          status:"error",programId,
          message:"放送画面を開けませんでした："+String(error?.message || "通信エラー").slice(0,160)
        });
      }
    });
  }
  return {ok:true,programId,status:"loading",message:"放送画面を表示します。"};
}

async function checkNiconicoProgram(input) {
  let programId;
  try { programId=normalizeProgramId(input); }
  catch(error) {
    return {ok:false,code:error.code||"INVALID_PROGRAM_ID",message:error.message||"放送IDを確認してください。"};
  }
  const url=NICONICO_WATCH_BASE+encodeURIComponent(programId);
  let response;
  try {
    response=await niconicoSession.fetch(url,{
      method:"GET",credentials:"include",redirect:"follow",
      headers:{Accept:"text/html,application/xhtml+xml"},
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch(error) {
    const timeout=error&&(error.name==="TimeoutError"||error.name==="AbortError");
    return {ok:false,code:timeout?"REQUEST_TIMEOUT":"NETWORK_ERROR",programId,
      message:timeout?"番組ページの確認がタイムアウトしました。":"ニコニコ生放送へ接続できませんでした。ネットワークを確認してください。"};
  }
  if (!isTrustedNiconicoUrl(response.url||url)) return {ok:false,code:"UNTRUSTED_REDIRECT",programId,message:"安全確認できないURLへ転送されたため中止しました。"};
  const finalUrl=new URL(response.url||url);
  if (/\/(login|signin)(\/|\?|$)/i.test(finalUrl.pathname)) return {ok:false,code:"AUTH_REQUIRED",programId,message:"この番組ページを確認するにはニコニコへのログインが必要です。"};
  if (response.status===404) return {ok:false,code:"PROGRAM_NOT_FOUND",programId,message:"放送ページが見つかりません。放送IDを確認してください。"};
  if (response.status===401||response.status===403) return {ok:false,code:"ACCESS_DENIED",programId,message:"この番組ページへのアクセスが拒否されました。限定公開や合言葉の設定も確認してください。"};
  if (!response.ok) return {ok:false,code:"HTTP_ERROR",programId,message:`番組ページの取得に失敗しました（HTTP ${response.status}）。`};
  let html;
  try { html=await response.text(); } catch { return {ok:false,code:"READ_ERROR",programId,message:"番組ページの内容を読み取れませんでした。"}; }
  if (html.length>6*1024*1024) return {ok:false,code:"RESPONSE_TOO_LARGE",programId,message:"番組ページのサイズが想定より大きいため、安全のため中止しました。"};
  try {
    const info=inspectWatchPage(html,programId);
    return {ok:true,...info,message:info.watchingApiAvailable?"番組ページと視聴用API情報を確認しました。":"番組ページを確認しましたが、視聴用API情報は見つかりませんでした。"};
  } catch(error) {
    if (error instanceof NiconicoPageError) return {ok:false,code:error.code,programId,message:error.message};
    return {ok:false,code:"PARSE_ERROR",programId,message:"番組情報を解析できませんでした。"};
  }
}

async function sendNiconicoBroadcasterComment(input) {
  let programId;
  try { programId=normalizeProgramId(input?.programId); }
  catch(error) { return {ok:false,code:error.code||"INVALID_PROGRAM_ID",message:error.message||"放送IDを確認してください。"}; }

  const now=Date.now();
  const waitMs=BROADCASTER_COMMENT_MIN_INTERVAL_MS-(now-lastBroadcasterCommentAttemptAt);
  if(waitMs>0) return {ok:false,code:"BROADCASTER_RATE_LIMITED",retryAfterMs:waitMs,message:"コメントの連投を防ぐため、投稿間隔を空けています。"};
  if(!niconicoSession) return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};

  try {
    const cookies=await niconicoSession.cookies.get({url:NICONICO_HOME});
    const sessionCookie=cookies.some(cookie=>cookie.name==="user_session"&&(!cookie.expirationDate||cookie.expirationDate>Date.now()/1000));
    if(!sessionCookie) return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};

    const pageUrl=NICONICO_WATCH_BASE+encodeURIComponent(programId);
    const pageResponse=await niconicoSession.fetch(pageUrl,{
      method:"GET",credentials:"include",redirect:"follow",
      headers:{Accept:"text/html,application/xhtml+xml"},
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if(!isTrustedNiconicoUrl(pageResponse.url||pageUrl)) return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない番組ページへの転送を検出しました。"};
    if(!pageResponse.ok) return {ok:false,code:pageResponse.status===401||pageResponse.status===403?"AUTH_REQUIRED":"PROGRAM_PAGE_ERROR",message:"コメント送信前に番組ページを確認できませんでした（HTTP "+pageResponse.status+"）。"};
    const html=await pageResponse.text();
    if(html.length>6*1024*1024) return {ok:false,code:"RESPONSE_TOO_LARGE",message:"番組ページが大きすぎるため送信を中止しました。"};
    const pageInfo=inspectWatchPage(html,programId);
    if(!["onAir","ON_AIR"].includes(pageInfo.programStatus)) {
      return {ok:false,code:"PROGRAM_NOT_ON_AIR",message:"番組が放送中ではないため運営コメントを送信しませんでした。"};
    }
    const csrfToken=extractBroadcasterCommentToken(html);
    const request=buildBroadcasterCommentRequest({
      programId,
      csrfToken,
      text:input?.text,
      name:"",
      command:"",
      isPermanent:false
    });
    if(!request.ok) return request;
    if(!isTrustedNiconicoUrl(request.url)) return {ok:false,code:"UNTRUSTED_API_URL",message:"安全確認できない送信先のため中止しました。"};

    lastBroadcasterCommentAttemptAt=Date.now();
    const response=await niconicoSession.fetch(request.url,{
      method:request.method,credentials:"include",redirect:"error",
      headers:request.headers,body:request.body,
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if(!isTrustedNiconicoUrl(response.url||request.url)) return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない送信先への転送を検出しました。"};
    let responseText="";
    try { responseText=await response.text(); }
    catch { return {ok:false,code:"BROADCASTER_RESPONSE_INVALID",message:"運営コメントAPIの応答を読み取れませんでした。"}; }
    return parseBroadcasterCommentResponse(responseText,response.status);
  } catch(error) {
    const timeout=error&&(error.name==="TimeoutError"||error.name==="AbortError");
    return {ok:false,code:timeout?"REQUEST_TIMEOUT":"BROADCASTER_NETWORK_ERROR",message:timeout?"運営コメント送信がタイムアウトしました。":"運営コメントを送信できませんでした。ログイン状態と通信を確認してください。"};
  }
}

function sendCommentState(state,message="",programId=commentProgramId) {
  if (mainWindow&&!mainWindow.isDestroyed()) {
    mainWindow.webContents.send("niconico:comment-state",{state,message,programId:programId||"",recordingEnabled:commentRecordingEnabled,changedAt:new Date().toISOString()});
  }
}
function sendCommentEvent(event) {
  if (mainWindow&&!mainWindow.isDestroyed()) mainWindow.webContents.send("niconico:comment",event);
}
async function getCommentCookieHeader() {
  const cookies=await niconicoSession.cookies.get({url:NICONICO_HOME});
  const allowed=new Set(["user_session","user_session_secure"]);
  return cookies.filter(c=>allowed.has(c.name)&&c.value&&(!c.expirationDate||c.expirationDate>Date.now()/1000))
    .map(c=>`${c.name}=${c.value}`).join("; ");
}
function clearCommentRecoveryTimer() {
  if (commentRecoveryTimer) {
    clearTimeout(commentRecoveryTimer);
    commentRecoveryTimer = null;
  }
}

async function closeCommentRecorder() {
  const recorder = commentRecorder;
  commentRecorder = null;
  commentRecordingEnabled = false;
  if (recorder) {
    try { await recorder.close(); } catch {}
  }
}

function recordCommentEvent(entry) {
  const recorder = commentRecorder;
  if (!recorder) return;
  void recorder.write(entry).catch(async () => {
    if (commentRecorder !== recorder) return;
    commentRecorder = null;
    commentRecordingEnabled = false;
    try { await recorder.close(); } catch {}
    sendCommentState(
      "connected",
      "コメントは受信中ですが、自動保存でエラーが発生しました。保存先の空き容量とアクセス権を確認してください。",
      commentProgramId
    );
  });
}

function scheduleCommentRecovery(provider, attemptId, programId) {
  if (commentRecoveryTimer || commentRecoveryActive) return;
  commentRecoveryTimer = setTimeout(async () => {
    commentRecoveryTimer = null;
    if (commentProvider !== provider || attemptId !== commentOperationId) return;

    commentRecoveryActive = true;
    commentRecoveryAttempts++;
    sendCommentState(
      "recovering",
      "コメントストリームを再接続しています（" + commentRecoveryAttempts + "/5）。",
      programId
    );
    try {
      provider.disconnect();
      await provider.connect();
      if (commentProvider === provider && attemptId === commentOperationId) {
        commentRecoveryAttempts = 0;
        sendCommentState("connected", "コメント接続を再確立しました。受信を再開しています。", programId);
      }
    } catch {
      if (commentProvider !== provider || attemptId !== commentOperationId) return;
      if (commentRecoveryAttempts >= 5) {
        try { provider.disconnect(); } catch {}
        try { provider.removeAllListeners(); } catch {}
        commentProvider = null;
        commentProgramId = "";
        await closeCommentRecorder();
        sendCommentState("error", "コメントストリームを復旧できませんでした。放送IDを確認して再接続してください。", programId);
      } else {
        sendCommentState(
          "recovering",
          "再接続に失敗しました。再試行を続けます（" + commentRecoveryAttempts + "/5）。",
          programId
        );
      }
    } finally {
      commentRecoveryActive = false;
      if (commentProvider === provider && attemptId === commentOperationId && commentRecoveryAttempts > 0 && commentRecoveryAttempts < 5) {
        scheduleCommentRecovery(provider, attemptId, programId);
      }
    }
  }, 10000);
}

async function stopCommentStream(reason="コメント受信を停止しました。") {
  commentOperationId++;
  clearCommentRecoveryTimer();
  commentRecoveryAttempts = 0;
  commentRecoveryActive = false;
  const provider = commentProvider;
  commentProvider = null;
  commentProgramId = "";
  if (provider) {
    try { provider.disconnect(); } catch {}
    try { provider.removeAllListeners(); } catch {}
  }
  await closeCommentRecorder();
  sendCommentState("disconnected", reason, "");
  return {ok:true,message:reason};
}

async function startCommentStream(input, options={}) {
  const attemptId = ++commentOperationId;
  clearCommentRecoveryTimer();
  commentRecoveryAttempts = 0;
  commentRecoveryActive = false;

  const previousProvider = commentProvider;
  commentProvider = null;
  commentProgramId = "";
  if (previousProvider) {
    try { previousProvider.disconnect(); } catch {}
    try { previousProvider.removeAllListeners(); } catch {}
  }
  await closeCommentRecorder();
  if (attemptId !== commentOperationId) {
    return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
  }

  sendCommentState("connecting", "放送ページを確認しています。", "");
  const validation = await checkNiconicoProgram(input);
  if (attemptId !== commentOperationId) {
    return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
  }
  if (!validation.ok) {
    sendCommentState("error", validation.message, "");
    return {ok:false,code:validation.code,message:validation.message};
  }
  if (!validation.watchingApiAvailable) {
    const message = "番組ページから視聴用API情報を確認できませんでした。放送状態とページ仕様を確認してください。";
    sendCommentState("error", message, validation.programId);
    return {ok:false,code:"WATCH_API_NOT_FOUND",message};
  }

  let cookies = "";
  try {
    cookies = await getCommentCookieHeader();
  } catch {
    return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。再ログインしてください。"};
  }
  if (attemptId !== commentOperationId) {
    return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
  }
  if (!cookies.split(/;\s*/).some(part => part.startsWith("user_session="))) {
    const message = "ニコニコ公式ログインが必要です。先にアカウント接続を行ってください。";
    sendCommentState("error", message, validation.programId);
    return {ok:false,code:"AUTH_REQUIRED",message};
  }

  let recorderEnabled = false;
  if (options.saveComments !== false) {
    try {
      const recorder = new CommentRecorder(app.getPath("userData"), validation.programId);
      await recorder.open();
      if (attemptId !== commentOperationId) {
        await recorder.close();
        return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
      }
      commentRecorder = recorder;
      commentRecordingEnabled = true;
      recorderEnabled = true;
    } catch {
      commentRecorder = null;
      commentRecordingEnabled = false;
    }
  }

  commentProgramId = validation.programId;
  sendCommentState(
    "connecting",
    "ニコ生のコメントサーバーへ接続しています。",
    validation.programId
  );

  try {
    const module = await import("nicomget/niconico");
    if (attemptId !== commentOperationId) {
      return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    }
    const Provider = module.NiconicoProvider;
    if (typeof Provider !== "function") throw new Error("Comment provider unavailable");
    const provider = new Provider({
      liveId:validation.programId,
      cookies,
      maxRetries:8,
      retryIntervalMs:5000,
      fetchBacklog:options.fetchBacklog !== false,
      backlogEvents:["chat"]
    });

    if (typeof provider.fetchWebSocketUrl !== "function") {
      throw new Error("Unsupported provider implementation");
    }
    provider.fetchWebSocketUrl = async function() {
      const watchUrl = NICONICO_WATCH_BASE + encodeURIComponent(validation.programId);
      const response = await niconicoSession.fetch(watchUrl, {
        method:"GET",
        credentials:"include",
        redirect:"follow",
        headers:{Accept:"text/html,application/xhtml+xml"},
        signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!isTrustedNiconicoUrl(response.url || watchUrl) || !response.ok) {
        throw new Error("Nico Live watch page could not be verified");
      }
      const html = await response.text();
      if (html.length > 6 * 1024 * 1024) throw new Error("Nico Live page too large");
      const embedded = extractEmbeddedData(html);
      const props = embedded.props && typeof embedded.props === "object" ? embedded.props : embedded;
      const wsUrl = props.site?.relive?.webSocketUrl;
      if (!isTrustedWebSocketEndpoint(wsUrl)) throw new Error("Untrusted Nico Live WebSocket endpoint");
      const program = props.program || {};
      const stats = program.statistics || {};
      const supplier = program.supplier || {};
      const metadata = {
        title:typeof program.title === "string" ? program.title : validation.title,
        status:program.status,
        description:program.description,
        beginTime:program.beginTime != null ? new Date(program.beginTime * 1000) : undefined,
        endTime:program.endTime != null ? new Date(program.endTime * 1000) : undefined,
        watchCount:stats.watchCount,
        commentCount:stats.commentCount,
        broadcasterName:supplier.name
      };
      return {wsUrl,metadata};
    };

    for (const [method,kind] of [["startMessageStream","message"],["startSegmentStream","segment"],["startBackwardStream","backward"]]) {
      const original = provider[method];
      if (typeof original !== "function") throw new Error("Unsupported provider implementation");
      provider[method] = function(uri, ...args) {
        if (!isTrustedNdgrUri(uri, kind)) {
          this.emit("error", new Error("Untrusted NDGR URI"));
          return;
        }
        return original.call(this, uri, ...args);
      };
    }

    commentProvider = provider;
    const publish = entry => {
      if (commentProvider !== provider || attemptId !== commentOperationId) return;
      clearCommentRecoveryTimer();
      commentRecoveryAttempts = 0;
      recordCommentEvent(entry);
      sendCommentEvent(entry);
    };
    provider.on("comment",value => publish(normalizeComment(value)));
    provider.on("operatorComment",value => publish(normalizeOperatorComment(value)));
    provider.on("gift",value => publish(normalizeNotification(value,"gift")));
    provider.on("emotion",value => publish(normalizeNotification(value,"emotion")));
    provider.on("notification",value => publish(normalizeNotification(value,"notification")));
    provider.on("stateChange",state => {
      if (state === "connected") {
        clearCommentRecoveryTimer();
        commentRecoveryAttempts = 0;
      }
      const messages = {
        connecting:"コメント接続を準備しています。",
        connected:"視聴セッションに接続しました。コメントを待っています。",
        disconnected:"コメント接続が切断されました。",
        error:"コメント接続でエラーが発生しました。"
      };
      sendCommentState(state,messages[state] || "接続状態が変わりました。",validation.programId);
    });
    provider.on("error",() => {
      if (commentProvider !== provider || attemptId !== commentOperationId) return;
      sendCommentState("recovering","通信が不安定です。監視付き再接続を試みます。",validation.programId);
      scheduleCommentRecovery(provider,attemptId,validation.programId);
    });

    const metadata = await provider.connect();
    if (attemptId !== commentOperationId || commentProvider !== provider) {
      try { provider.disconnect(); } catch {}
      return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    }
    sendCommentState(
      "connected",
      metadata?.title
        ? "「" + String(metadata.title).slice(0,120) + "」の視聴セッションに接続しました。コメントを待っています。"
        : "視聴セッションに接続しました。コメントを待っています。",
      validation.programId
    );
    const message = recorderEnabled
      ? "コメント受信を開始しました。受信コメントをPC内に自動保存します。"
      : "コメント受信を開始しました。自動保存は無効です。";
    return {
      ok:true,
      programId:validation.programId,
      title:typeof metadata?.title === "string" ? metadata.title.slice(0,200) : validation.title || "",
      recordingEnabled:recorderEnabled,
      message
    };
  } catch {
    if (attemptId !== commentOperationId) {
      return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    }
    const provider = commentProvider;
    commentProvider = null;
    commentProgramId = "";
    if (provider) {
      try { provider.disconnect(); } catch {}
      try { provider.removeAllListeners(); } catch {}
    }
    await closeCommentRecorder();
    sendCommentState(
      "error",
      "コメントサーバーへの接続に失敗しました。ログイン状態・放送状態・通信環境を確認してください。",
      validation.programId
    );
    return {
      ok:false,
      code:"COMMENT_CONNECT_FAILED",
      message:"コメントサーバーへの接続に失敗しました。ログイン状態・放送状態・通信環境を確認してください。"
    };
  }
}

function sendPlayerState(state, details = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("niconico:player-state", {
      state,
      videoId:playerVideoId,
      url:playerVideoUrl,
      changedAt:new Date().toISOString(),
      ...details
    });
  }
}

function stopPlayerMonitor() {
  if (playerMonitorTimer) clearInterval(playerMonitorTimer);
  playerMonitorTimer = null;
  playerMonitorBusy = false;
  playerMonitorGeneration++;
}

function startPlayerMonitor() {
  stopPlayerMonitor();
  const generation = playerMonitorGeneration;
  playerMonitorTimer = setInterval(async () => {
    const win = playerWindow;
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
      stopPlayerMonitor();
      return;
    }
    if (playerMonitorBusy) return;
    const monitoredVideoId = playerVideoId;
    playerMonitorBusy = true;
    try {
      const media = await win.webContents.executeJavaScript(`(() => {
        const video = document.querySelector("video");
        if (!video) return { hasVideo:false, title:document.title || "" };
        return {
          hasVideo:true,
          currentTime:Number.isFinite(video.currentTime) ? video.currentTime : 0,
          duration:Number.isFinite(video.duration) ? video.duration : 0,
          paused:Boolean(video.paused),
          ended:Boolean(video.ended),
          readyState:Number(video.readyState || 0),
          title:document.title || ""
        };
      })()`, true);
      if (generation !== playerMonitorGeneration || monitoredVideoId !== playerVideoId || win !== playerWindow) return;
      if (!media || !media.hasVideo) {
        sendPlayerState("loading", { currentTime:0, duration:0, message:"動画プレイヤーを読み込んでいます。" });
        return;
      }
      const details = {
        currentTime:media.currentTime,
        duration:media.duration,
        title:String(media.title || "").slice(0,160),
        readyState:media.readyState
      };
      if (media.ended) {
        sendPlayerState("ended", details);
        if (!playerEndNotified) {
          playerEndNotified = true;
          sendPlayerState("ended", {...details, endedEvent:true});
        }
      } else {
        sendPlayerState(media.paused ? "paused" : "playing", details);
      }
    } catch {
      if (generation === playerMonitorGeneration && monitoredVideoId === playerVideoId) {
        sendPlayerState("loading", { message:"動画の再生状態を確認しています。" });
      }
    } finally {
      if (generation === playerMonitorGeneration) playerMonitorBusy = false;
    }
  }, 1000);
}

async function openVideoPlayer(input) {
  const validation = normalizeNiconicoVideoUrl(input);
  if (!validation.ok) return validation;

  stopPlayerMonitor();
  playerVideoId = validation.videoId;
  playerVideoUrl = validation.url;
  playerEndNotified = false;
  sendPlayerState("loading", { currentTime:0, duration:0, message:"公式動画ページを開いています。" });

  if (!playerWindow || playerWindow.isDestroyed()) {
    playerWindow = new BrowserWindow({
      width:1180,
      height:820,
      minWidth:760,
      minHeight:560,
      show:false,
      title:"kananeo 動画プレイヤー",
      backgroundColor:"#101827",
      autoHideMenuBar:true,
      webPreferences:{
        session:niconicoSession,
        contextIsolation:true,
        nodeIntegration:false,
        sandbox:true,
        webSecurity:true
      }
    });
    playerWindow.webContents.setWindowOpenHandler(({url}) => {
      if (isTrustedNiconicoUrl(url)) return {action:"allow"};
      try {
        if (new URL(url).protocol === "https:") shell.openExternal(url);
      } catch {}
      return {action:"deny"};
    });
    playerWindow.webContents.on("will-navigate", (event,url) => {
      if (!isTrustedNiconicoUrl(url)) {
        event.preventDefault();
        try {
          if (new URL(url).protocol === "https:") shell.openExternal(url);
        } catch {}
      }
    });
    playerWindow.webContents.on("did-start-loading", () => {
      playerEndNotified = false;
      sendPlayerState("loading", { currentTime:0, duration:0, message:"動画ページを読み込んでいます。" });
    });
    playerWindow.webContents.on("did-finish-load", () => {
      if (playerWindow && !playerWindow.isDestroyed()) {
        playerWindow.show();
        startPlayerMonitor();
      }
    });
    playerWindow.webContents.on("did-fail-load", (_event,code,description,_url,isMainFrame) => {
      if (isMainFrame) {
        sendPlayerState("error", { message:"動画ページを読み込めませんでした（" + String(code) + "）。" + String(description || "").slice(0,120) });
      }
    });
    playerWindow.on("closed", () => {
      stopPlayerMonitor();
      playerWindow = null;
      sendPlayerState("closed", { message:"プレイヤーウィンドウを閉じました。" });
    });
  } else {
    playerWindow.show();
    playerWindow.focus();
  }

  try {
    await playerWindow.loadURL(validation.url);
    if (playerWindow && !playerWindow.isDestroyed()) {
      playerWindow.setTitle("kananeo 動画プレイヤー | " + validation.videoId);
      playerWindow.show();
      playerWindow.focus();
    }
    return { ok:true, videoId:validation.videoId, url:validation.url, message:"ニコニコ動画をプレイヤーウィンドウで開きました。動画の再生は公式プレイヤー側で開始してください。" };
  } catch {
    sendPlayerState("error", { message:"動画ページを開けませんでした。ネットワークとログイン状態を確認してください。" });
    return { ok:false, code:"VIDEO_LOAD_FAILED", message:"動画ページを開けませんでした。ネットワークとログイン状態を確認してください。" };
  }
}

async function pauseVideoPlayer() {
  if (!playerWindow || playerWindow.isDestroyed() || playerWindow.webContents.isDestroyed()) {
    return {ok:false,code:"PLAYER_NOT_OPEN",message:"プレビューは開いていません。"};
  }
  try {
    const paused = await playerWindow.webContents.executeJavaScript(`(() => {
      const video = document.querySelector("video");
      if (!video) return false;
      video.pause();
      return true;
    })()`,true);
    return paused?{ok:true,message:"プレビューを一時停止しました。"}:{ok:false,code:"VIDEO_NOT_FOUND",message:"動画プレイヤーを確認できません。"};
  } catch {
    return {ok:false,code:"PAUSE_FAILED",message:"プレビューを一時停止できませんでした。"};
  }
}

function focusVideoPlayer() {
  if (!playerWindow || playerWindow.isDestroyed()) {
    return { ok:false, message:"プレイヤーウィンドウは開いていません。" };
  }
  playerWindow.show();
  playerWindow.focus();
  return { ok:true, message:"プレイヤーウィンドウを前面に表示しました。" };
}

function closeVideoPlayer() {
  stopPlayerMonitor();
  const win = playerWindow;
  playerWindow = null;
  if (win && !win.isDestroyed()) win.close();
  return { ok:true, message:"プレイヤーウィンドウを閉じました。" };
}

async function fetchQuotationRequest(request) {
  let response;
  try {
    response=await niconicoSession.fetch(request.url,{
      method:request.method,
      credentials:"include",
      redirect:"error",
      headers:{
        Accept:"application/json",
        ...(request.body!==undefined?{"Content-Type":"application/json"}:{})
      },
      ...(request.body!==undefined?{body:JSON.stringify(request.body)}:{}),
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch(error) {
    const timeout=error&&(error.name==="TimeoutError"||error.name==="AbortError");
    return {ok:false,code:timeout?"QUOTATION_TIMEOUT":"QUOTATION_NETWORK_ERROR",
      message:timeout?"引用再生APIがタイムアウトしました。":"引用再生APIへ接続できませんでした。"};
  }
  if(!isTrustedNiconicoUrl(response.url||request.url)) {
    return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない接続先へ転送されたため引用再生を中止しました。"};
  }
  return {ok:true,response};
}

async function requireNiconicoLogin() {
  let cookies;
  try { cookies=await niconicoSession.cookies.get({url:NICONICO_HOME}); }
  catch { return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。"}; }
  const valid=cookies.some(cookie=>
    (cookie.name==="user_session"||cookie.name==="user_session_secure") &&
    cookie.value &&
    (!cookie.expirationDate||cookie.expirationDate>Date.now()/1000)
  );
  return valid?{ok:true}:{ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};
}

async function getCurrentQuotation(input={}) {
  let programId;
  try { programId=normalizeProgramId(input.programId); }
  catch { return {ok:false,code:"INVALID_PROGRAM_ID",message:"放送IDを確認してください。"}; }
  const login=await requireNiconicoLogin();
  if(!login.ok)return login;
  const request=buildGetCurrentQuotationRequest(programId);
  if(!request.ok)return request;
  const fetched=await fetchQuotationRequest(request);
  if(!fetched.ok)return fetched;
  let responseText="";
  if(fetched.response.status!==404) {
    try { responseText=await fetched.response.text(); }
    catch { return {ok:false,code:"QUOTATION_RESPONSE_INVALID",message:"引用再生状態を読み取れませんでした。"}; }
  }
  const parsed=parseCurrentQuotationResponse(fetched.response.status,responseText);
  if(!parsed.ok)return parsed;
  return {ok:true,programId,...parsed,updatedAt:new Date().toISOString()};
}

async function playQuotedVideo(input={}) {
  let programId;
  try { programId=normalizeProgramId(input.programId); }
  catch { return {ok:false,code:"INVALID_PROGRAM_ID",message:"配信中の放送IDを確認してください。"}; }
  if(input.confirmed!==true) {
    return {ok:false,code:"CONFIRMATION_REQUIRED",message:"実配信への引用再生は明示確認が必要です。"};
  }
  const login=await requireNiconicoLogin();
  if(!login.ok)return login;

  const current=await getCurrentQuotation({programId});
  if(!current.ok)return current;
  const request=buildPlayQuotationRequest({
    programId,
    videoId:input.videoId,
    hasActiveQuotation:current.exists,
    mainVolume:input.mainVolume,
    subVolume:input.subVolume
  });
  if(!request.ok)return request;

  const fetched=await fetchQuotationRequest(request);
  if(!fetched.ok)return fetched;
  let responseText="";
  try { responseText=await fetched.response.text(); }
  catch { return {ok:false,code:"QUOTATION_RESPONSE_INVALID",message:"引用再生APIの応答を読み取れませんでした。"}; }
  const mutation=parseQuotationMutationResponse(fetched.response.status,responseText);
  if(!mutation.ok)return mutation;

  const verified=await getCurrentQuotation({programId});
  return {
    ok:true,
    programId,
    videoId:request.body.contents[0].id,
    method:request.method,
    verified:!!verified.ok&&verified.currentVideoId===request.body.contents[0].id,
    currentVideoId:verified.ok?verified.currentVideoId:"",
    message:verified.ok&&verified.currentVideoId===request.body.contents[0].id
      ?"ニコ生の引用再生状態を確認しました。"
      :"引用再生APIは受け付けました。現在の再生状態はまだ確認できていません。"
  };
}

async function stopQuotedVideo(input={}) {
  let programId;
  try { programId=normalizeProgramId(input.programId); }
  catch { return {ok:false,code:"INVALID_PROGRAM_ID",message:"放送IDを確認してください。"}; }
  if(input.confirmed!==true) {
    return {ok:false,code:"CONFIRMATION_REQUIRED",message:"ニコ生の引用再生停止には明示確認が必要です。"};
  }
  const login=await requireNiconicoLogin();
  if(!login.ok)return login;
  const current=await getCurrentQuotation({programId});
  if(!current.ok)return current;
  if(!current.exists)return {ok:true,programId,message:"引用再生は既に停止しています。"};
  const request=buildStopQuotationRequest(programId);
  if(!request.ok)return request;
  const fetched=await fetchQuotationRequest(request);
  if(!fetched.ok)return fetched;
  let responseText="";
  try { responseText=await fetched.response.text(); }
  catch { return {ok:false,code:"QUOTATION_RESPONSE_INVALID",message:"停止APIの応答を読み取れませんでした。"}; }
  const result=parseQuotationMutationResponse(fetched.response.status,responseText);
  if(!result.ok)return result;
  return {ok:true,programId,message:"引用再生の停止要求を送信しました。"};
}

function selectPlaybackCandidate(input={}) {
  if(!input||typeof input!=="object")return null;
  const requests=Array.isArray(input.requests)?input.requests.slice(0,1000):[];
  const stocks=Array.isArray(input.stocks)?input.stocks.slice(0,1000):[];
  return selectNextPlaybackCandidate({
    requests,
    stocks,
    playStyle:input.playStyle,
    randomStock:input.randomStock===true,
    remainingMs:input.remainingMs==null?NaN:Number(input.remainingMs)
  });
}

async function getProgramExtensionOptions(input = {}) {
  let programId;
  try {
    programId = normalizeProgramId(input.programId);
  } catch {
    return {ok:false,code:"INVALID_PROGRAM_ID",message:"放送IDを確認してください。"};
  }

  const request = buildExtensionOptionsRequest(programId);
  if (!request.ok) return request;

  let cookies;
  try {
    cookies = await niconicoSession.cookies.get({url:NICONICO_HOME});
  } catch {
    return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。"};
  }
  const sessionCookie = cookies.find(cookie =>
    cookie.name === "user_session" &&
    cookie.value &&
    (!cookie.expirationDate || cookie.expirationDate > Date.now()/1000)
  );
  if (!sessionCookie) return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};

  let response;
  try {
    response = await niconicoSession.fetch(request.url,{
      method:request.method,
      credentials:"include",
      redirect:"error",
      headers:{Accept:"application/json"},
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const timeout = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok:false,
      code:timeout ? "EXTENSION_TIMEOUT" : "EXTENSION_NETWORK_ERROR",
      message:timeout ? "延長方法の取得がタイムアウトしました。" : "延長APIへ接続できませんでした。"
    };
  }

  if (!isTrustedNiconicoUrl(response.url || request.url)) {
    return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない転送先のため延長情報の取得を中止しました。"};
  }
  if (response.status === 401) return {ok:false,code:"AUTH_REQUIRED",message:"ログインの有効期限が切れました。"};
  if (response.status === 403) return {ok:false,code:"EXTENSION_FORBIDDEN",message:"延長情報の取得が拒否されました。配信主アカウントか確認してください。"};
  if (response.status === 404) return {ok:false,code:"PROGRAM_NOT_FOUND",message:"番組が見つかりません。"};
  if (!response.ok) return {ok:false,code:"EXTENSION_HTTP_ERROR",message:"延長APIがエラーを返しました（HTTP "+response.status+"）。"};

  let responseText;
  try { responseText = await response.text(); }
  catch { return {ok:false,code:"EXTENSION_RESPONSE_INVALID",message:"延長方法を読み取れませんでした。"}; }
  const parsed = parseExtensionOptionsResponse(responseText);
  if (!parsed.ok) return parsed;
  return {ok:true,programId,methods:parsed.methods,updatedAt:new Date().toISOString()};
}

async function getProgramStatistics(input = {}) {
  let programId;
  try {
    programId = normalizeProgramId(input.programId);
  } catch {
    return {ok:false,code:"INVALID_PROGRAM_ID",message:"放送IDを確認してください。"};
  }

  const request = buildStatisticsRequest(programId);
  if (!request.ok) return request;

  let cookies;
  try {
    cookies = await niconicoSession.cookies.get({url:NICONICO_HOME});
  } catch {
    return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。"};
  }
  const sessionCookie = cookies.find(cookie =>
    cookie.name === "user_session" &&
    cookie.value &&
    (!cookie.expirationDate || cookie.expirationDate > Date.now()/1000)
  );
  if (!sessionCookie) return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};

  let response;
  try {
    response = await niconicoSession.fetch(request.url,{
      method:request.method,
      credentials:"include",
      redirect:"error",
      headers:{Accept:"application/json"},
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const timeout = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {ok:false,code:timeout ? "STATISTICS_TIMEOUT" : "STATISTICS_NETWORK_ERROR",
      message:timeout ? "番組統計の取得がタイムアウトしました。" : "番組統計APIへ接続できませんでした。"};
  }

  if (!isTrustedNiconicoUrl(response.url || request.url)) {
    return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない転送先のため統計取得を中止しました。"};
  }
  if (response.status === 401) return {ok:false,code:"AUTH_REQUIRED",message:"ログインの有効期限が切れました。"};
  if (response.status === 403) return {ok:false,code:"STATISTICS_FORBIDDEN",message:"番組統計の取得が拒否されました。"};
  if (response.status === 404) return {ok:false,code:"PROGRAM_NOT_FOUND",message:"番組ページが見つかりません。"};
  if (!response.ok) return {ok:false,code:"STATISTICS_HTTP_ERROR",message:"番組統計APIがエラーを返しました（HTTP "+response.status+"）。"};

  let responseText;
  try { responseText = await response.text(); }
  catch { return {ok:false,code:"STATISTICS_RESPONSE_INVALID",message:"番組統計を読み取れませんでした。"}; }
  const parsed = parseStatisticsResponse(responseText);
  if (!parsed.ok) return parsed;
  return {ok:true,programId,watchCount:parsed.watchCount,commentCount:parsed.commentCount,updatedAt:new Date().toISOString()};
}

async function callEnqueteApi(action, input = {}) {
  let programId;
  try {
    programId = normalizeProgramId(input.programId);
  } catch {
    return {ok:false,code:"INVALID_PROGRAM_ID",message:"配信中の放送ID（lvから始まるID）を確認してください。"};
  }

  const request = buildEnqueteRequest(action, programId, input);
  if (!request.ok) return request;

  let cookies;
  try {
    cookies = await niconicoSession.cookies.get({url:NICONICO_HOME});
  } catch {
    return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。"};
  }
  const sessionCookie = cookies.find(cookie =>
    cookie.name === "user_session" &&
    cookie.value &&
    (!cookie.expirationDate || cookie.expirationDate > Date.now()/1000)
  );
  if (!sessionCookie) {
    return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。"};
  }

  let response;
  try {
    response = await niconicoSession.fetch(request.url, {
      method:request.method,
      credentials:"include",
      redirect:"error",
      headers:{
        Accept:"application/json",
        "Content-Type":"application/json"
      },
      ...(request.body !== undefined ? {body:request.body} : {}),
      signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const timeout = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok:false,
      code:timeout ? "ENQUETE_TIMEOUT" : "ENQUETE_NETWORK_ERROR",
      message:timeout ? "アンケートAPIがタイムアウトしました。" : "アンケートAPIへ接続できませんでした。"
    };
  }

  if (!isTrustedNiconicoUrl(response.url || request.url)) {
    return {ok:false,code:"UNTRUSTED_REDIRECT",message:"安全確認できない転送先のためアンケート操作を中止しました。"};
  }
  if (!response.ok) return {ok:false,...mapEnqueteHttpError(response.status)};

  if (action !== "result") {
    return {ok:true,programId,message:action === "start" ? "アンケートを開始しました。" : "アンケートを終了しました。"};
  }

  let responseText;
  try { responseText = await response.text(); }
  catch { return {ok:false,code:"ENQUETE_RESPONSE_INVALID",message:"アンケート結果を読み取れませんでした。"}; }
  const parsed = parseEnqueteResultResponse(responseText);
  if (!parsed.ok) return parsed;
  return {
    ok:true,
    programId,
    title:parsed.title,
    items:parsed.items,
    message:"アンケート結果を取得しました。"
  };
}


const BGM_LIBRARY_FILE_NAME = "bgm-library.json";
const BGM_DIRECTORY_NAME = "bgm";
const BGM_IMPORT_MAX_FILES = 50;
let bgmLibraryCache = null;
let bgmLibraryQueue = Promise.resolve();

function getBgmLibraryFilePath() {
  return path.join(app.getPath("userData"),BGM_LIBRARY_FILE_NAME);
}

function getBgmDirectoryPath() {
  return path.join(app.getPath("userData"),BGM_DIRECTORY_NAME);
}

async function readBgmLibraryUnlocked() {
  if (bgmLibraryCache) return {ok:true,library:bgmLibraryCache};
  try {
    const content=await fs.readFile(getBgmLibraryFilePath(),"utf8");
    bgmLibraryCache=normalizeBgmLibrary(JSON.parse(content));
    return {ok:true,library:bgmLibraryCache};
  } catch(error) {
    if(error?.code==="ENOENT") {
      bgmLibraryCache=createEmptyBgmLibrary();
      return {ok:true,library:bgmLibraryCache};
    }
    return {ok:false,code:"BGM_LIBRARY_READ_ERROR",message:"BGMライブラリを読み取れませんでした。元データ保護のため上書きしていません。"};
  }
}

async function persistBgmLibraryUnlocked(input) {
  const library=normalizeBgmLibrary(input);
  const filePath=getBgmLibraryFilePath();
  const tempPath=filePath+".tmp";
  await fs.mkdir(app.getPath("userData"),{recursive:true,mode:0o700});
  try {
    await fs.writeFile(tempPath,JSON.stringify(library,null,2),{encoding:"utf8",mode:0o600});
    await fs.rename(tempPath,filePath);
    bgmLibraryCache=library;
    return {ok:true,library};
  } catch {
    try { await fs.rm(tempPath,{force:true}); } catch {}
    return {ok:false,code:"BGM_LIBRARY_WRITE_ERROR",message:"BGMライブラリを保存できませんでした。ディスク容量とアクセス権を確認してください。"};
  }
}

function withBgmLibraryLock(work) {
  const task=bgmLibraryQueue.then(work,work);
  bgmLibraryQueue=task.then(()=>undefined,()=>undefined);
  return task;
}

async function buildBgmLibraryResponse(library) {
  const tracks=[];
  for(const track of library.tracks) {
    const filePath=path.join(getBgmDirectoryPath(),track.id+track.extension);
    try {
      await fs.access(filePath);
      tracks.push({...track,url:pathToFileURL(filePath).href});
    } catch {}
  }
  return {ok:true,tracks,updatedAt:library.updatedAt};
}

async function getBgmLibraryForRenderer() {
  return withBgmLibraryLock(async()=>{
    const current=await readBgmLibraryUnlocked();
    if(!current.ok)return current;
    return buildBgmLibraryResponse(current.library);
  });
}

async function importBgmFilesFromDialog() {
  if(!mainWindow||mainWindow.isDestroyed()) return {ok:false,code:"WINDOW_UNAVAILABLE",message:"メイン画面を確認できません。"};
  const picked=await dialog.showOpenDialog(mainWindow,{
    title:"BGMに追加する音源ファイルを選択",
    properties:["openFile","multiSelections"],
    filters:[{name:"音声ファイル",extensions:ALLOWED_BGM_EXTENSIONS.map(item=>item.slice(1))}]
  });
  if(picked.canceled||!picked.filePaths.length) return {ok:true,canceled:true,added:0,skipped:0,tracks:[]};
  const selected=picked.filePaths.slice(0,BGM_IMPORT_MAX_FILES);
  let added=0,skipped=Math.max(0,picked.filePaths.length-selected.length);
  return withBgmLibraryLock(async()=>{
    const current=await readBgmLibraryUnlocked();
    if(!current.ok)return current;
    let library=current.library;
    await fs.mkdir(getBgmDirectoryPath(),{recursive:true,mode:0o700});
    const copiedPaths=[];
    for(const sourcePath of selected) {
      try {
        const extension=path.extname(sourcePath).toLowerCase();
        if(!ALLOWED_BGM_EXTENSIONS.includes(extension)) { skipped++; continue; }
        const stat=await fs.stat(sourcePath);
        if(!stat.isFile()||stat.size<1||stat.size>MAX_BGM_TRACK_BYTES) { skipped++; continue; }
        if(library.tracks.length>=MAX_BGM_TRACKS) { skipped++; continue; }
        const id=randomUUID();
        const destination=path.join(getBgmDirectoryPath(),id+extension);
        await fs.copyFile(sourcePath,destination);
        copiedPaths.push(destination);
        const candidate={
          id,
          name:path.basename(sourcePath,path.extname(sourcePath)).replace(/[\\/\\\\\u0000-\u001f\u007f]/g," ").slice(0,160)||"名称未設定",
          extension,
          size:stat.size,
          addedAt:new Date().toISOString()
        };
        const result=addBgmTrack(library,candidate);
        if(!result.ok) {
          await fs.rm(destination,{force:true});
          copiedPaths.pop();
          skipped++;
          continue;
        }
        library=result.library;
        added++;
      } catch {
        skipped++;
      }
    }
    if(added) {
      const saved=await persistBgmLibraryUnlocked(library);
      if(!saved.ok) {
        await Promise.all(copiedPaths.map(filePath=>fs.rm(filePath,{force:true}).catch(()=>{})));
        return saved;
      }
      library=saved.library;
    }
    const response=await buildBgmLibraryResponse(library);
    return {...response,added,skipped,canceled:false};
  });
}

async function removeBgmTrackFromLibrary(idInput) {
  return withBgmLibraryLock(async()=>{
    const current=await readBgmLibraryUnlocked();
    if(!current.ok)return current;
    const result=removeBgmTrack(current.library,idInput);
    if(!result.ok)return {ok:false,code:result.code,message:result.code==="NOT_FOUND"?"登録したBGMが見つかりません。":"BGM IDを確認してください。"};
    const saved=await persistBgmLibraryUnlocked(result.library);
    if(!saved.ok)return saved;
    const filePath=path.join(getBgmDirectoryPath(),result.track.id+result.track.extension);
    await fs.rm(filePath,{force:true}).catch(()=>{});
    return buildBgmLibraryResponse(saved.library);
  });
}

async function moveBgmTrackInLibrary(idInput,directionInput) {
  return withBgmLibraryLock(async()=>{
    const current=await readBgmLibraryUnlocked();
    if(!current.ok)return current;
    const result=moveBgmTrack(current.library,idInput,directionInput);
    if(!result.ok) {
      const messages={INVALID_ID:"BGM IDを確認してください。",INVALID_DIRECTION:"移動方向を確認してください。",NOT_FOUND:"登録したBGMが見つかりません。",BOUNDARY:"これ以上その方向へ移動できません。"};
      return {ok:false,code:result.code,message:messages[result.code]||"BGMの順番を変更できませんでした。"};
    }
    const saved=await persistBgmLibraryUnlocked(result.library);
    if(!saved.ok)return saved;
    return buildBgmLibraryResponse(saved.library);
  });
}

const VIDEO_LIBRARY_FILE_NAME = "video-library.json";
const VIDEO_LIBRARY_IMPORT_TIMEOUT_MS = 20000;
let videoLibraryCache = null;
let videoLibraryQueue = Promise.resolve();

function getVideoLibraryFilePath() {
  return path.join(app.getPath("userData"), VIDEO_LIBRARY_FILE_NAME);
}

async function readVideoLibraryUnlocked() {
  if (videoLibraryCache) return {ok:true,library:videoLibraryCache};
  const filePath = getVideoLibraryFilePath();
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    videoLibraryCache = normalizeVideoLibrary(parsed);
    return {ok:true,library:videoLibraryCache};
  } catch (error) {
    if (error && error.code === "ENOENT") {
      videoLibraryCache = createEmptyVideoLibrary();
      return {ok:true,library:videoLibraryCache};
    }
    return {ok:false,code:"VIDEO_LIBRARY_READ_ERROR",message:"動画ライブラリの保存データを読み取れませんでした。元データを保護するため上書きしていません。"};
  }
}

async function persistVideoLibraryUnlocked(libraryInput) {
  const library = normalizeVideoLibrary(libraryInput);
  const filePath = getVideoLibraryFilePath();
  const directory = path.dirname(filePath);
  const tempPath = filePath + ".tmp";
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  try {
    await fs.writeFile(tempPath,JSON.stringify(library,null,2),{encoding:"utf8",mode:0o600});
    await fs.rename(tempPath,filePath);
    videoLibraryCache = library;
    return {ok:true,library};
  } catch (error) {
    try { await fs.rm(tempPath,{force:true}); } catch {}
    return {ok:false,code:"VIDEO_LIBRARY_WRITE_ERROR",message:"動画ライブラリを保存できませんでした。ディスク容量とアクセス権を確認してください。"};
  }
}

function withVideoLibraryLock(work) {
  const task = videoLibraryQueue.then(work,work);
  videoLibraryQueue = task.then(()=>undefined,()=>undefined);
  return task;
}

async function updateVideoLibrary(work) {
  return withVideoLibraryLock(async()=>{
    const current = await readVideoLibraryUnlocked();
    if (!current.ok) return current;
    const result = work(current.library);
    if (!result || result.ok === false) return result || {ok:false,code:"VIDEO_LIBRARY_UPDATE_FAILED",message:"動画ライブラリを更新できませんでした。"};
    const saved = await persistVideoLibraryUnlocked(result.library || result);
    if (!saved.ok) return saved;
    const {library: _ignored, ...summary} = result;
    return {...summary,ok:true,library:saved.library};
  });
}

function isVideoLibrarySender(event) {
  return event.sender === mainWindow?.webContents;
}

async function fetchNiconicoLibraryVideos(input = {}) {
  const type = input.type;
  const firstRequest = buildNiconicoLibraryRequest(type,{listId:input.listId,url:input.url,page:1});
  if (!firstRequest.ok) return firstRequest;
  if (!niconicoSession) return {ok:false,code:"AUTH_REQUIRED",message:"先にニコニコ公式ログインを行ってください。"};

  try {
    const cookies = await niconicoSession.cookies.get({url:"https://www.nicovideo.jp/"});
    const sessionCookie = cookies.some(cookie=>cookie.name==="user_session"&&(!cookie.expirationDate||cookie.expirationDate>Date.now()/1000));
    if (!sessionCookie) return {ok:false,code:"AUTH_REQUIRED",message:"先にニコニコ公式ログインを行ってください。"};

    const headers = {
      Accept:"application/json",
      "X-Frontend-Id":"6",
      "X-Frontend-Version":"0",
      "X-Niconico-Language":"ja-jp",
      "X-Request-With":"https://www.nicovideo.jp",
      Origin:"https://www.nicovideo.jp",
      Referer:type==="watch-later"?"https://www.nicovideo.jp/my/watch-later":type==="mylist"?"https://www.nicovideo.jp/mylist/"+firstRequest.listId:"https://www.nicovideo.jp/series/"+firstRequest.listId
    };
    const entries = [];
    let sourceTitle = "";
    let totalCount = null;
    let responseHasMore = false;
    let seriesPageSize = 0;
    const maxPages = type==="watch-later" ? 10 : type==="mylist" ? 2 : 1;

    for (let page=1; page<=maxPages; page+=1) {
      const request = buildNiconicoLibraryRequest(type,{
        listId:input.listId,url:input.url,page,
        ...(type==="series"&&seriesPageSize?{pageSize:seriesPageSize}:{})
      });
      let response = await niconicoSession.fetch(request.url,{
        method:"GET",credentials:"include",redirect:"error",headers,
        signal:AbortSignal.timeout(VIDEO_LIBRARY_IMPORT_TIMEOUT_MS)
      });

      if (type==="mylist" && response.status===404 && request.fallbackUrl) {
        response = await niconicoSession.fetch(request.fallbackUrl,{
          method:"GET",credentials:"include",redirect:"error",headers,
          signal:AbortSignal.timeout(VIDEO_LIBRARY_IMPORT_TIMEOUT_MS)
        });
      }
      if (response.url && new URL(response.url).origin!=="https://nvapi.nicovideo.jp") {
        return {ok:false,code:"UNTRUSTED_API_REDIRECT",message:"安全確認できないAPI転送先のため取り込みを中止しました。"};
      }
      if (response.status===401 || response.status===403) {
        return {ok:false,code:"AUTH_REQUIRED",message:"一覧を取得できません。ログイン状態またはマイリストの閲覧権限を確認してください。"};
      }
      if (response.status===404) {
        return {ok:false,code:"LIST_NOT_FOUND",message:"指定したマイリストまたはシリーズが見つかりませんでした。"};
      }
      if (!response.ok) {
        return {ok:false,code:"LIST_API_ERROR",message:"ニコニコの一覧APIがエラーを返しました（HTTP "+response.status+"）。"};
      }
      const responseText = await response.text();
      if (responseText.length>8*1024*1024) return {ok:false,code:"LIST_RESPONSE_TOO_LARGE",message:"一覧データが大きすぎるため取り込みを中止しました。"};
      const parsed = parseNiconicoLibraryResponse(responseText,type);
      if (!parsed.ok) return parsed;
      if (!sourceTitle && parsed.listTitle) sourceTitle = parsed.listTitle;
      if (parsed.totalCount !== null) totalCount = parsed.totalCount;
      responseHasMore = parsed.hasMore === true;

      if (type==="series" && page===1 && seriesPageSize===0 &&
        parsed.totalCount !== null && parsed.totalCount>parsed.entries.length) {
        seriesPageSize=Math.min(1000,parsed.totalCount);
        entries.length=0;
        page=0;
        continue;
      }

      entries.push(...parsed.entries);
      if (!parsed.hasMore || entries.length>=1000) break;
    }

    const unique = new Map();
    for (const item of entries) {
      if (!unique.has(item.videoId)) unique.set(item.videoId,item);
      if (unique.size>=1000) break;
    }
    const limited=totalCount!==null?totalCount>unique.size:responseHasMore;
    return {ok:true,entries:[...unique.values()],sourceTitle,sourceType:type,limited,totalCount};
  } catch (error) {
    const timeout = error && (error.name==="TimeoutError"||error.name==="AbortError");
    return {ok:false,code:timeout?"LIST_IMPORT_TIMEOUT":"LIST_IMPORT_NETWORK_ERROR",message:timeout?"一覧の取り込みがタイムアウトしました。":"ニコニコの一覧を取得できませんでした。ログイン状態と通信を確認してください。"};
  }
}

const UPDATE_RELEASES_API_URL = "https://api.github.com/repos/kanenao/kananeo-nico-live-stream/releases?per_page=20";
const UPDATE_RELEASES_PAGE_URL = "https://github.com/kanenao/kananeo-nico-live-stream/releases";

async function checkApplicationUpdates() {
  const currentVersion=app.getVersion();
  try {
    const response=await fetch(UPDATE_RELEASES_API_URL,{
      method:"GET",
      redirect:"error",
      headers:{
        Accept:"application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":"kananeo-nico-live-stream"
      },
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok) {
      const rateLimited=response.status===403&&response.headers.get("x-ratelimit-remaining")==="0";
      return {
        ok:false,currentVersion,code:rateLimited?"RATE_LIMITED":"HTTP_ERROR",
        message:rateLimited
          ?"GitHub APIの確認回数上限に達しました。時間をおいて再確認してください。"
          :"GitHubのリリース情報を取得できませんでした。（HTTP "+response.status+"）",
        checkedAt:new Date().toISOString()
      };
    }
    const body=await response.text();
    if(body.length>2*1024*1024) {
      return {ok:false,currentVersion,code:"RESPONSE_TOO_LARGE",message:"リリース情報が大きすぎるため確認を中止しました。",checkedAt:new Date().toISOString()};
    }
    let releases;
    try { releases=JSON.parse(body); }
    catch { return {ok:false,currentVersion,code:"INVALID_JSON",message:"GitHubから受け取った情報を解析できませんでした。",checkedAt:new Date().toISOString()}; }
    const result=buildUpdateCheckResult(currentVersion,releases);
    return {...result,checkedAt:new Date().toISOString()};
  } catch(error) {
    const timeout=error?.name==="TimeoutError"||error?.name==="AbortError";
    return {
      ok:false,currentVersion,code:timeout?"TIMEOUT":"NETWORK_ERROR",
      message:timeout
        ?"GitHubへの接続がタイムアウトしました。ネットワークを確認してください。"
        :"GitHubに接続できませんでした。ネットワーク接続を確認してください。",
      checkedAt:new Date().toISOString()
    };
  }
}


function normalizeRemoteDeviceRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id)) return null;
  if (typeof input.tokenHash !== "string" || !/^[a-f0-9]{64}$/i.test(input.tokenHash)) return null;
  if (typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) return null;
  const optionalDate = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
  return {
    id:input.id,
    name:normalizeDeviceName(input.name),
    tokenHash:input.tokenHash.toLowerCase(),
    permissions:normalizeDevicePermissions(input.permissions),
    createdAt:input.createdAt,
    lastSeenAt:optionalDate(input.lastSeenAt),
    revokedAt:optionalDate(input.revokedAt)
  };
}

function getRemoteControlStorePath() {
  return path.join(app.getPath("userData"),REMOTE_CONTROL_STORE_FILE_NAME);
}

async function loadRemoteControlDeviceStore() {
  if (remoteControlStoreLoaded) return {ok:remoteControlStoreHealthy,message:remoteControlStoreError};
  remoteControlStoreLoaded = true;
  try {
    const content = await fs.readFile(getRemoteControlStorePath(),"utf8");
    if (content.length > 256 * 1024) throw new Error("STORE_TOO_LARGE");
    const parsed = JSON.parse(content);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.devices) || parsed.devices.length > 100) {
      throw new Error("STORE_INVALID");
    }
    remoteControlDevices = parsed.devices.map(normalizeRemoteDeviceRecord).filter(Boolean);
    remoteControlStoreHealthy = true;
    remoteControlStoreError = "";
    return {ok:true};
  } catch(error) {
    if (error?.code === "ENOENT") {
      remoteControlDevices = [];
      remoteControlStoreHealthy = true;
      return {ok:true};
    }
    remoteControlStoreHealthy = false;
    remoteControlStoreError = "リモート端末の保存データを読み取れません。元データ保護のため新規登録を停止しています。";
    return {ok:false,message:remoteControlStoreError};
  }
}

function persistRemoteControlDeviceStore(devices = remoteControlDevices) {
  const snapshot = devices.map(device => ({
    id:device.id,name:device.name,tokenHash:device.tokenHash,
    permissions:[...device.permissions],createdAt:device.createdAt,
    lastSeenAt:device.lastSeenAt||null,revokedAt:device.revokedAt||null
  }));
  const task = remoteControlStoreQueue.then(async()=>{
    if (!remoteControlStoreHealthy) return {ok:false,code:"STORE_UNAVAILABLE",message:remoteControlStoreError};
    const filePath = getRemoteControlStorePath();
    const tempPath = filePath + ".tmp";
    try {
      await fs.mkdir(app.getPath("userData"),{recursive:true,mode:0o700});
      await fs.writeFile(tempPath,JSON.stringify({version:1,devices:snapshot},null,2),{encoding:"utf8",mode:0o600});
      await fs.rename(tempPath,filePath);
      return {ok:true};
    } catch {
      try { await fs.rm(tempPath,{force:true}); } catch {}
      return {ok:false,code:"STORE_WRITE_FAILED",message:"リモート端末情報を保存できませんでした。"};
    }
  });
  remoteControlStoreQueue = task.then(()=>undefined,()=>undefined);
  return task;
}

function getRemoteControlStatus() {
  const address = remoteControlServer?.address() || null;
  return {
    ok:true,
    running:!!address,
    host:address?.host||"127.0.0.1",
    port:address?.port||0,
    url:address?.url||"",
    pairingExpiresAt:remoteControlPairing?.challenge?.expiresAt||null,
    storageHealthy:remoteControlStoreHealthy,
    storageMessage:remoteControlStoreError,
    devices:remoteControlDevices.map(sanitizeRemoteDevice)
  };
}

async function createRemotePairingChallenge(input = {}) {
  if (!remoteControlStoreLoaded) await loadRemoteControlDeviceStore();
  if (!remoteControlStoreHealthy) return {ok:false,code:"STORE_UNAVAILABLE",message:remoteControlStoreError};
  if (!remoteControlServer?.address()) return {ok:false,code:"SERVER_NOT_RUNNING",message:"先にリモート操作サーバーを起動してください。"};
  if (remoteControlDevices.filter(device=>!device.revokedAt).length >= REMOTE_CONTROL_MAX_DEVICES) {
    return {ok:false,code:"DEVICE_LIMIT",message:"登録できる有効端末は最大20台です。不要な端末を失効してください。"};
  }
  const requested = normalizeDevicePermissions(Array.isArray(input.permissions)?input.permissions:["status:read","comments:read"]);
  const permissions = [...new Set(["status:read",...requested])];
  const ttlMs = 5 * 60 * 1000;
  const created = createPairingChallenge(Date.now(),ttlMs);
  remoteControlPairing = {challenge:created.challenge,permissions};
  return {ok:true,code:created.code,expiresAt:created.challenge.expiresAt,permissions,message:"5分間有効なワンタイムコードを発行しました。"};
}

async function completeRemotePairing(input = {}) {
  if (!remoteControlPairing) return {ok:false,code:"NO_ACTIVE_PAIRING",message:"有効なペアリングコードがありません。アプリ側で新しいコードを発行してください。"};
  if (!input || typeof input.code !== "string" || input.code.length > 32) {
    return {ok:false,code:"INVALID_CODE",message:"ペアリングコードを確認してください。"};
  }
  if (remoteControlDevices.filter(device=>!device.revokedAt).length >= REMOTE_CONTROL_MAX_DEVICES) {
    return {ok:false,code:"DEVICE_LIMIT",message:"登録できる有効端末は最大20台です。不要な端末を失効してください。"};
  }
  const verified = verifyPairingCode(input.code,remoteControlPairing.challenge);
  remoteControlPairing.challenge = verified.challenge || remoteControlPairing.challenge;
  if (!verified.ok) {
    const messages = {
      INVALID_CHALLENGE:"ペアリングコードが無効です。",
      ALREADY_USED:"このペアリングコードは既に使用されています。",
      EXPIRED:"ペアリングコードの有効期限が切れました。",
      LOCKED:"試行回数の上限に達しました。新しいコードを発行してください。",
      BAD_CODE:"ペアリングコードが一致しません。"
    };
    return {ok:false,code:verified.reason,message:messages[verified.reason]||"ペアリングできませんでした。",attemptsRemaining:verified.attemptsRemaining};
  }
  const credential = createDeviceCredential({
    name:input.name,
    permissions:remoteControlPairing.permissions
  });
  const nextDevices = [...remoteControlDevices,credential.device];
  const saved = await persistRemoteControlDeviceStore(nextDevices);
  if (!saved.ok) return saved;
  remoteControlDevices = nextDevices;
  remoteControlPairing = null;
  return {
    ok:true,
    token:credential.token,
    device:sanitizeRemoteDevice(credential.device),
    message:"端末を登録しました。認証トークンはこの応答で一度だけ返します。"
  };
}

async function resolveRemoteDevice(token) {
  const device = remoteControlDevices.find(item=>verifyDeviceToken(token,item));
  if (!device) return null;
  const now = Date.now();
  if (!device.lastSeenAt || now-Date.parse(device.lastSeenAt)>=60_000) {
    device.lastSeenAt = new Date(now).toISOString();
    void persistRemoteControlDeviceStore();
  }
  return device;
}

async function revokeRemoteControlDevice(deviceId) {
  if (typeof deviceId !== "string" || deviceId.length > 64) return {ok:false,code:"INVALID_DEVICE",message:"端末IDを確認してください。"};
  const index = remoteControlDevices.findIndex(device=>device.id===deviceId);
  if (index < 0) return {ok:false,code:"NOT_FOUND",message:"登録端末が見つかりません。"};
  const revoked = revokeRemoteDevice(remoteControlDevices[index]);
  const nextDevices = [...remoteControlDevices];
  nextDevices[index] = revoked;
  const saved = await persistRemoteControlDeviceStore(nextDevices);
  if (!saved.ok) return saved;
  remoteControlDevices = nextDevices;
  if (remoteControlPairing) remoteControlPairing = null;
  return {ok:true,device:sanitizeRemoteDevice(revoked),message:"端末を失効しました。以後、この端末のトークンは使用できません。"};
}

function requestRendererRemoteAction(action,payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
    return Promise.resolve({ok:false,code:"APP_UNAVAILABLE",message:"アプリのメイン画面が利用できません。"});
  }
  const requestId = randomUUID();
  return new Promise(resolve=>{
    const timer = setTimeout(()=>{
      pendingRemoteRendererRequests.delete(requestId);
      resolve({ok:false,code:"RENDERER_TIMEOUT",message:"アプリ画面から応答がありませんでした。"});
    },7000);
    pendingRemoteRendererRequests.set(requestId,{resolve,timer});
    mainWindow.webContents.send("remote-control:request",{requestId,action,payload});
  });
}

function createRemoteControlHttpServer() {
  if (remoteControlServer) return remoteControlServer;
  remoteControlServer = createRemoteControlServer({
    staticDirectory:__dirname,
    onPair:completeRemotePairing,
    resolveDevice:resolveRemoteDevice,
    onSnapshot:async()=>{
      const result=await requestRendererRemoteAction("snapshot");
      if(!result?.ok)throw new Error(result?.message||"状態を取得できません。");
      return result.status||{};
    },
    onComments:async(_device,limit)=>{
      const result=await requestRendererRemoteAction("comments",{limit});
      if(!result?.ok)throw new Error(result?.message||"コメントを取得できません。");
      return Array.isArray(result.comments)?result.comments:[];
    },
    onCommand:(_device,command,payload)=>requestRendererRemoteAction("command",{command,payload})
  });
  return remoteControlServer;
}

async function startRemoteControlServer(port) {
  await loadRemoteControlDeviceStore();
  if (!remoteControlStoreHealthy) return {ok:false,code:"STORE_UNAVAILABLE",message:remoteControlStoreError};
  const server = createRemoteControlHttpServer();
  const result = await server.start(port);
  return result.ok?{...result,status:getRemoteControlStatus()}:result;
}

async function stopRemoteControlServer() {
  remoteControlPairing = null;
  if (!remoteControlServer) return {ok:true,stopped:false,status:getRemoteControlStatus()};
  const result = await remoteControlServer.stop();
  return {...result,status:getRemoteControlStatus()};
}

function registerIpcHandlers() {
  ipcMain.on("remote-control:response",(event,input)=>{
    if(event.sender!==mainWindow?.webContents||!input||typeof input.requestId!=="string") return;
    const pending=pendingRemoteRendererRequests.get(input.requestId);
    if(!pending)return;
    clearTimeout(pending.timer);
    pendingRemoteRendererRequests.delete(input.requestId);
    pending.resolve(input.result&&typeof input.result==="object"?input.result:{ok:false,code:"INVALID_RESPONSE",message:"アプリ画面から無効な応答が返されました。"});
  });
  ipcMain.handle("remote:get-status",event=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN"};
    return getRemoteControlStatus();
  });
  ipcMain.handle("remote:start",async(event,port)=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN"};
    return startRemoteControlServer(port);
  });
  ipcMain.handle("remote:stop",event=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN"};
    return stopRemoteControlServer();
  });
  ipcMain.handle("remote:create-pairing",async(event,input)=>{
    if(event.sender!==mainWindow?.webContents||!input||typeof input!=="object")return {ok:false,code:"FORBIDDEN"};
    if(JSON.stringify(input).length>2000)return {ok:false,code:"INVALID_INPUT",message:"権限設定を確認してください。"};
    return createRemotePairingChallenge(input);
  });
  ipcMain.handle("remote:revoke-device",async(event,deviceId)=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN"};
    return revokeRemoteControlDevice(deviceId);
  });
  ipcMain.handle("remote:open-controller",async event=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN"};
    const address=remoteControlServer?.address();
    if(!address)return {ok:false,code:"SERVER_NOT_RUNNING",message:"リモート操作サーバーは起動していません。"};
    try{await shell.openExternal(address.url);return {ok:true,message:"ローカルコントローラーをブラウザーで開きました。"};}
    catch{return {ok:false,code:"OPEN_FAILED",message:"ブラウザーで開けませんでした。"};}
  });
  ipcMain.handle("niconico:open-login",()=>openNiconicoLoginWindow());
  ipcMain.handle("niconico:open-broadcast-create",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return openNiconicoBroadcastWindow("create");
  });
  ipcMain.handle("niconico:open-broadcast-manage",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDを確認してください。"};
    return openNiconicoBroadcastWindow("manage",input);
  });
  ipcMain.handle("niconico:get-extension-options",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return getProgramExtensionOptions(input||{});
  });
  ipcMain.handle("niconico:get-program-statistics",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return getProgramStatistics(input||{});
  });
  ipcMain.handle("niconico:start-enquete",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object") return {ok:false,code:"INVALID_INPUT",message:"アンケート設定を確認してください。"};
    return callEnqueteApi("start",input);
  });
  ipcMain.handle("niconico:show-enquete-result",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return callEnqueteApi("result",input||{});
  });
  ipcMain.handle("niconico:decide-enquete",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {decision:"invalid",reason:"この操作は許可されていません。"};
    if(!input||typeof input!=="object") return {decision:"invalid",reason:"投票結果を確認できません。"};
    return decideEnqueteResult(input.items,input.choices,input.rules||{});
  });
  ipcMain.handle("niconico:finish-enquete",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return callEnqueteApi("finish",input||{});
  });
  ipcMain.handle("niconico:find-next-queue-item",(event,items,currentId)=>{
    if(event.sender!==mainWindow?.webContents||!Array.isArray(items)||items.length>1000||typeof currentId!=="string"||currentId.length>128) return null;
    const safeItems=items.map(item=>({id:typeof item?.id==="string"?item.id:"",status:typeof item?.status==="string"?item.status:"queued"}));
    return findNextQueueItem(safeItems,currentId);
  });
  ipcMain.handle("niconico:post-broadcaster-comment",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object"||typeof input.text!=="string"||input.text.length>200) return {ok:false,code:"INVALID_INPUT",message:"運営コメントの内容を確認してください。"};
    return sendNiconicoBroadcasterComment(input);
  });
  ipcMain.handle("niconico:evaluate-comment-request",(event,input)=>{
    if(event.sender!==mainWindow?.webContents||!input||typeof input!=="object") return {accepted:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(JSON.stringify(input).length>300000) return {accepted:false,code:"INVALID_INPUT",message:"リクエスト判定データが大きすぎます。"};
    return evaluateCommentRequest(input);
  });
  ipcMain.handle("niconico:extract-request",(event,input)=>{
    if(event.sender!==mainWindow?.webContents||typeof input!=="string"||input.length>4000) return "";
    return extractRequestCandidate(input);
  });
  ipcMain.handle("niconico:get-current-quotation",(event,input)=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return getCurrentQuotation(input||{});
  });
  ipcMain.handle("niconico:play-quoted-video",(event,input)=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object"||typeof input.videoId!=="string"||input.videoId.length>32)return {ok:false,code:"INVALID_INPUT",message:"動画IDを確認してください。"};
    return playQuotedVideo(input);
  });
  ipcMain.handle("niconico:stop-quoted-video",(event,input)=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return stopQuotedVideo(input||{});
  });
  ipcMain.handle("niconico:select-playback-candidate",(event,input)=>{
    if(event.sender!==mainWindow?.webContents)return null;
    return selectPlaybackCandidate(input||{});
  });
  ipcMain.handle("niconico:validate-video",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return normalizeNiconicoVideoUrl(input);
  });
  ipcMain.handle("niconico:open-video",(event,input)=>{
    if(event.sender!==mainWindow?.webContents||typeof input!=="string"||input.length>2048) return {ok:false,code:"INVALID_INPUT",message:"動画URLを確認してください。"};
    return openVideoPlayer(input);
  });
  ipcMain.handle("niconico:pause-video",event=>{
    if(event.sender!==mainWindow?.webContents)return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return pauseVideoPlayer();
  });
  ipcMain.handle("niconico:focus-video",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,message:"この操作は許可されていません。"};
    return focusVideoPlayer();
  });
  ipcMain.handle("niconico:close-video",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,message:"この操作は許可されていません。"};
    return closeVideoPlayer();
  });
  ipcMain.handle("niconico:get-session-status",()=>getNiconicoSessionStatus());
  ipcMain.handle("niconico:logout",async()=>{
    await stopCommentStream("ログアウトしたためコメント受信を停止しました。");
    closeVideoPlayer();
    try {
      if(broadcastWindow&&!broadcastWindow.isDestroyed())broadcastWindow.close();
      closeNiconicoLiveVideoView();
      await niconicoSession.clearStorageData({storages:["cookies","localstorage","indexdb","serviceworkers","cachestorage"]});
      await notifySessionStatus();
      return {ok:true,message:"このアプリ専用のニコニコセッションを削除しました。"};
    } catch { return {ok:false,message:"セッションを削除できませんでした。"}; }
  });
  ipcMain.handle("niconico:live-view-open",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDを確認してください。"};
    return openNiconicoLiveVideoView(input);
  });
  ipcMain.on("niconico:live-view-bounds",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return;
    setNiconicoLiveVideoBounds(input);
  });
  ipcMain.handle("niconico:live-view-close",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return closeNiconicoLiveVideoView();
  });
  ipcMain.handle("niconico:check-program",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDまたはURLを入力してください。"};
    return checkNiconicoProgram(input);
  });
  ipcMain.handle("niconico:start-comments",(event,input,options)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDまたはURLを入力してください。"};
    return startCommentStream(input,{fetchBacklog:options?.fetchBacklog!==false,saveComments:options?.saveComments!==false});
  });
  ipcMain.handle("niconico:stop-comments",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,message:"この操作は許可されていません。"};
    return stopCommentStream();
  });
  ipcMain.handle("app:open-comment-recordings",async event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,message:"この操作は許可されていません。"};
    const folder=path.join(app.getPath("userData"),"comment-recordings");
    try {
      const fs=require("node:fs/promises");
      await fs.mkdir(folder,{recursive:true,mode:0o700});
      const error=await shell.openPath(folder);
      return error?{ok:false,message:"保存先フォルダを開けませんでした。"}:{ok:true,message:"コメント保存先フォルダを開きました。"};
    } catch {
      return {ok:false,message:"保存先フォルダを開けませんでした。"};
    }
  });

  ipcMain.handle("app:bgm-get",async event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return getBgmLibraryForRenderer();
  });
  ipcMain.handle("app:bgm-add-files",async event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    try { return await importBgmFilesFromDialog(); }
    catch { return {ok:false,code:"BGM_IMPORT_FAILED",message:"音源ファイルを追加できませんでした。"}; }
  });
  ipcMain.handle("app:bgm-remove",async(event,id)=>{
    if(event.sender!==mainWindow?.webContents||typeof id!=="string"||id.length>64) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return removeBgmTrackFromLibrary(id);
  });
  ipcMain.handle("app:bgm-move",async(event,id,direction)=>{
    if(event.sender!==mainWindow?.webContents||typeof id!=="string"||id.length>64||typeof direction!=="string") return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return moveBgmTrackInLibrary(id,direction);
  });
  ipcMain.handle("app:video-library-get",async event=>{
    if(!isVideoLibrarySender(event)) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return withVideoLibraryLock(()=>readVideoLibraryUnlocked());
  });
  ipcMain.handle("app:video-library-add",async(event,input)=>{
    if(!isVideoLibrarySender(event)||!input||typeof input!=="object") return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    const entry=normalizeVideoEntry({...input,source:"manual"});
    if(!entry) return {ok:false,code:"INVALID_VIDEO",message:"ニコニコ動画のIDまたはURLを確認してください。"};
    return updateVideoLibrary(library=>mergeVideoEntries(library,[entry]));
  });
  ipcMain.handle("app:video-library-remove",async(event,input)=>{
    if(!isVideoLibrarySender(event)||typeof input?.videoId!=="string"||input.videoId.length>64) return {ok:false,code:"INVALID_INPUT",message:"動画IDを確認してください。"};
    return updateVideoLibrary(library=>removeVideoEntry(library,input.videoId));
  });
  ipcMain.handle("app:video-library-update",async(event,input)=>{
    if(!isVideoLibrarySender(event)) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object"||typeof input.videoId!=="string"||
      input.videoId.length>64||JSON.stringify(input).length>10000) {
      return {ok:false,code:"INVALID_INPUT",message:"動画の編集内容を確認してください。"};
    }
    return updateVideoLibrary(library=>updateVideoEntry(library,input.videoId,input));
  });
  ipcMain.handle("app:video-library-list",async(event,input)=>{
    if(!isVideoLibrarySender(event)) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object"||!["watch-later","mylist","series"].includes(input.type)||
      (input.type!=="watch-later"&&(typeof input.listId!=="string"||input.listId.length>2048))) {
      return {ok:false,code:"INVALID_LIST_ID",message:"取り込み元の種類と一覧URL・IDを確認してください。"};
    }
    const result=await fetchNiconicoLibraryVideos(input);
    if(!result.ok) return result;
    return {
      ok:true,sourceType:result.sourceType,sourceTitle:result.sourceTitle||"",
      entries:result.entries, count:result.entries.length, limited:result.limited===true,
      message:result.entries.length+" 件の動画一覧を取得しました。"
    };
  });
  ipcMain.handle("app:video-library-import-selected",async(event,input)=>{
    if(!isVideoLibrarySender(event)) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(!input||typeof input!=="object"||JSON.stringify(input).length>4*1024*1024) {
      return {ok:false,code:"INVALID_SELECTION",message:"選択した動画一覧を確認してください。"};
    }
    const prepared=prepareSelectedVideoEntries(input.entries,input.sourceType);
    if(!prepared.ok) return {
      ...prepared,
      message:prepared.code==="NO_VALID_VIDEOS"?"選択した動画に有効なIDがありません。":"選択した動画一覧を確認してください（最大1,000件）。"
    };
    const saved=await updateVideoLibrary(library=>mergeVideoEntries(library,prepared.entries));
    if(!saved.ok) return saved;
    return {...saved,imported:prepared.entries.length,skipped:prepared.skipped+saved.skipped,sourceType:prepared.sourceType};
  });
  ipcMain.handle("app:video-library-import",async(event,input)=>{
    if(!isVideoLibrarySender(event)||!input||typeof input!=="object") return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    let entries=[];
    let historyEntries=[];
    let sourceType=typeof input.type==="string"?input.type:"text";
    let skipped=0;
    if(sourceType==="text"||sourceType==="json"){
      if(typeof input.text!=="string"||input.text.length>16*1024*1024) return {ok:false,code:"INVALID_IMPORT_TEXT",message:"取り込みテキストは16MB以内にしてください。"};
      const parsed=parseVideoImportText(input.text,{source:sourceType==="json"?"json-import":"text-import"});
      if(!parsed.ok) return parsed;
      entries=parsed.entries;
      historyEntries=Array.isArray(parsed.history)?parsed.history:[];
      skipped=parsed.skipped;
    }else{
      if(typeof input.listId!=="string"&&typeof input.url!=="string") return {ok:false,code:"INVALID_LIST_ID",message:"マイリストまたはシリーズのURL・IDを入力してください。"};
      const imported=await fetchNiconicoLibraryVideos(input);
      if(!imported.ok) return imported;
      entries=imported.entries;
      sourceType=imported.sourceType;
      skipped=imported.skippedCount||0;
    }
    if(!entries.length&&!historyEntries.length) return {ok:false,code:"NO_VALID_VIDEOS",message:"取り込める動画または再生履歴がありませんでした。"};
    const tagged=entries.map(entry=>({...entry,source:sourceType}));
    const saved=await updateVideoLibrary(library=>{
      const merged=mergeVideoEntries(library,tagged);
      const withHistory=historyEntries.length?mergeVideoHistory(merged.library,historyEntries):{library:merged.library,addedHistory:0};
      return {...merged,library:withHistory.library,historyImported:withHistory.addedHistory};
    });
    if(!saved.ok) return saved;
    return {...saved,imported:entries.length,skipped:skipped+saved.skipped,sourceType};
  });
  ipcMain.handle("app:video-library-record-playback",async(event,input)=>{
    if(!isVideoLibrarySender(event)||!input||typeof input!=="object") return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return updateVideoLibrary(library=>addPlaybackHistory(library,input));
  });
  ipcMain.handle("app:video-library-clear-history",async event=>{
    if(!isVideoLibrarySender(event)) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return updateVideoLibrary(library=>({ok:true,library:clearVideoHistory(library)}));
  });
  ipcMain.handle("app:check-updates",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    return checkApplicationUpdates();
  });
  ipcMain.handle("app:open-releases",async event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    try {
      await shell.openExternal(UPDATE_RELEASES_PAGE_URL);
      return {ok:true};
    } catch {
      return {ok:false,code:"OPEN_FAILED",message:"GitHub Releasesのページを開けませんでした。"};
    }
  });
  ipcMain.handle("app:copy-text",(event,value)=>{
    if(event.sender!==mainWindow?.webContents||typeof value!=="string"||value.length>500000) return {ok:false};
    clipboard.writeText(value);
    return {ok:true};
  });
}

function createMainWindow() {
  mainWindow=new BrowserWindow({
    width:1510,height:960,minWidth:1080,minHeight:720,show:false,
    title:"kananeo nico live stream",backgroundColor:"#0a0f1d",autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}
  });
  mainWindow.loadFile(path.join(__dirname,"index.html"));
  mainWindow.once("ready-to-show",()=>mainWindow&&mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(isTrustedNiconicoUrl(url)) shell.openExternal(url);
    return {action:"deny"};
  });
  mainWindow.webContents.on("will-navigate",(event,url)=>{if(!url.startsWith("file://"))event.preventDefault();});
  mainWindow.on("closed",()=>{closeNiconicoLiveVideoView();mainWindow=null;});
}

app.whenReady().then(async()=>{
  await loadRemoteControlDeviceStore();
  app.setAppUserModelId("jp.kanenao.nicolivestream");
  niconicoSession=session.fromPartition(NICONICO_PARTITION);
  niconicoSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  niconicoSession.cookies.on("changed",()=>{void notifySessionStatus();});
  registerIpcHandlers();
  createMainWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
});
app.on("before-quit",event=>{
  if(finalQuitInProgress) return;
  event.preventDefault();
  closeNiconicoLiveVideoView();
  finalQuitInProgress=true;
  void Promise.all([
    stopCommentStream("アプリを終了しました。"),
    stopRemoteControlServer()
  ]).finally(()=>{
    for(const pending of pendingRemoteRendererRequests.values()){
      clearTimeout(pending.timer);
      pending.resolve({ok:false,code:"APP_SHUTDOWN",message:"アプリを終了しました。"});
    }
    pendingRemoteRendererRequests.clear();
    closeVideoPlayer();
    app.quit();
  });
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
