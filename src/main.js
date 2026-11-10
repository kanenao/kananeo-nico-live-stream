"use strict";

const { app, BrowserWindow, shell, session, ipcMain, clipboard } = require("electron");
const path = require("node:path");
const {
  normalizeProgramId, inspectWatchPage, extractEmbeddedData, NiconicoPageError, isTrustedWebSocketEndpoint
} = require("./niconico-program");
const { normalizeComment, normalizeOperatorComment, normalizeNotification } = require("./comment-normalizer");
const { isTrustedNdgrUri } = require("./ndgr-security");

const NICONICO_HOME = "https://live.nicovideo.jp/";
const NICONICO_WATCH_BASE = "https://live2.nicovideo.jp/watch/";
const NICONICO_PARTITION = "persist:kananeo-niconico";
const REQUEST_TIMEOUT_MS = 15000;
let mainWindow = null;
let loginWindow = null;
let niconicoSession = null;
let commentProvider = null;
let commentProgramId = "";
let commentOperationId = 0;

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

function sendCommentState(state,message="",programId=commentProgramId) {
  if (mainWindow&&!mainWindow.isDestroyed()) {
    mainWindow.webContents.send("niconico:comment-state",{state,message,programId:programId||"",changedAt:new Date().toISOString()});
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
function stopCommentStream(reason="コメント受信を停止しました。") {
  commentOperationId++;
  if (commentProvider) {
    try { commentProvider.removeAllListeners(); } catch {}
    try { commentProvider.disconnect(); } catch {}
  }
  commentProvider=null;
  commentProgramId="";
  sendCommentState("disconnected",reason,"");
  return {ok:true,message:reason};
}

async function startCommentStream(input,options={}) {
  const validation=await checkNiconicoProgram(input);
  if (!validation.ok) return {ok:false,code:validation.code,message:validation.message};
  if (!validation.watchingApiAvailable) return {ok:false,code:"WATCH_API_NOT_FOUND",message:"番組ページから視聴用API情報を確認できませんでした。放送状態とページ仕様を確認してください。"};
  let cookies="";
  try { cookies=await getCommentCookieHeader(); }
  catch { return {ok:false,code:"COOKIE_READ_FAILED",message:"ログインセッションを確認できませんでした。再ログインしてください。"}; }
  if (!cookies.split(/;\s*/).some(part=>part.startsWith("user_session="))) {
    return {ok:false,code:"AUTH_REQUIRED",message:"ニコニコ公式ログインが必要です。先にアカウント接続を行ってください。"};
  }

  stopCommentStream("新しい放送への接続を準備しています。");
  const attemptId=commentOperationId;
  sendCommentState("connecting","ニコ生のコメントサーバーへ接続しています。",validation.programId);
  try {
    const module=await import("nicomget/niconico");
    if (attemptId!==commentOperationId) return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    const Provider=module.NiconicoProvider;
    if (typeof Provider!=="function") throw new Error("Comment provider unavailable");
    const provider=new Provider({
      liveId:validation.programId,cookies,maxRetries:8,retryIntervalMs:5000,
      fetchBacklog:options.fetchBacklog!==false,backlogEvents:["chat"]
    });

    if (typeof provider.fetchWebSocketUrl!=="function") throw new Error("Unsupported provider implementation");
    // Use our HTML parser for the watch page instead of depending on the provider's
    // attribute-order-sensitive embedded-data expression. The resulting socket URL is allowlisted.
    provider.fetchWebSocketUrl=async function() {
      const watchUrl=NICONICO_WATCH_BASE+encodeURIComponent(validation.programId);
      const response=await niconicoSession.fetch(watchUrl,{
        method:"GET",credentials:"include",redirect:"follow",
        headers:{Accept:"text/html,application/xhtml+xml"},
        signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if(!isTrustedNiconicoUrl(response.url||watchUrl)||!response.ok) throw new Error("Nico Live watch page could not be verified");
      const html=await response.text();
      if(html.length>6*1024*1024) throw new Error("Nico Live page too large");
      const embedded=extractEmbeddedData(html);
      const props=embedded.props&&typeof embedded.props==="object"?embedded.props:embedded;
      const wsUrl=props.site?.relive?.webSocketUrl;
      if(!isTrustedWebSocketEndpoint(wsUrl)) throw new Error("Untrusted Nico Live WebSocket endpoint");
      const program=props.program||{};
      const stats=program.statistics||{};
      const supplier=program.supplier||{};
      const metadata={
        title:typeof program.title==="string"?program.title:validation.title,
        status:program.status,
        description:program.description,
        beginTime:program.beginTime!=null?new Date(program.beginTime*1000):undefined,
        endTime:program.endTime!=null?new Date(program.endTime*1000):undefined,
        watchCount:stats.watchCount,
        commentCount:stats.commentCount,
        broadcasterName:supplier.name
      };
      return {wsUrl,metadata};
    };
    for (const [method,kind] of [["startMessageStream","message"],["startSegmentStream","segment"],["startBackwardStream","backward"]]) {
      const original=provider[method];
      if (typeof original!=="function") throw new Error("Unsupported NDGR stream method");
      provider[method]=function(uri,...args) {
        if (!isTrustedNdgrUri(uri,kind)) {
          this.emit("error",new Error("Untrusted NDGR URI"));
          return;
        }
        return original.call(this,uri,...args);
      };
    }

    commentProvider=provider;
    commentProgramId=validation.programId;
    provider.on("comment",value=>sendCommentEvent(normalizeComment(value)));
    provider.on("operatorComment",value=>sendCommentEvent(normalizeOperatorComment(value)));
    provider.on("gift",value=>sendCommentEvent(normalizeNotification(value,"gift")));
    provider.on("emotion",value=>sendCommentEvent(normalizeNotification(value,"emotion")));
    provider.on("notification",value=>sendCommentEvent(normalizeNotification(value,"notification")));
    provider.on("stateChange",state=>{
      const messages={connecting:"コメント接続を準備しています。",connected:"視聴セッションに接続しました。コメントを待っています。",disconnected:"コメント接続が切断されました。",error:"コメント接続でエラーが発生しました。"};
      sendCommentState(state,messages[state]||"接続状態が変わりました。",validation.programId);
    });
    provider.on("error",()=>{
      sendCommentState("recovering","通信が不安定です。自動再接続を試みています。",validation.programId);
    });

    const metadata=await provider.connect();
    if (attemptId!==commentOperationId||commentProvider!==provider) {
      try { provider.disconnect(); } catch {}
      return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    }
    sendCommentState("connected",metadata?.title?`「${String(metadata.title).slice(0,120)}」の視聴セッションに接続しました。コメントを待っています。`:"視聴セッションに接続しました。コメントを待っています。",validation.programId);
    return {ok:true,programId:validation.programId,title:typeof metadata?.title==="string"?metadata.title.slice(0,200):validation.title||"",message:"コメント受信を開始しました。"};
  } catch {
    if (attemptId!==commentOperationId) return {ok:false,code:"CANCELLED",message:"接続処理はキャンセルされました。"};
    if (commentProvider) { try { commentProvider.disconnect(); } catch {} }
    commentProvider=null;
    commentProgramId="";
    sendCommentState("error","コメントサーバーへの接続に失敗しました。ログイン状態・放送状態・通信環境を確認してください。",validation.programId);
    return {ok:false,code:"COMMENT_CONNECT_FAILED",message:"コメントサーバーへの接続に失敗しました。ログイン状態・放送状態・通信環境を確認してください。"};
  }
}

function registerIpcHandlers() {
  ipcMain.handle("niconico:open-login",()=>openNiconicoLoginWindow());
  ipcMain.handle("niconico:get-session-status",()=>getNiconicoSessionStatus());
  ipcMain.handle("niconico:logout",async()=>{
    stopCommentStream("ログアウトしたためコメント受信を停止しました。");
    try {
      await niconicoSession.clearStorageData({storages:["cookies","localstorage","indexdb","serviceworkers","cachestorage"]});
      await notifySessionStatus();
      return {ok:true,message:"このアプリ専用のニコニコセッションを削除しました。"};
    } catch { return {ok:false,message:"セッションを削除できませんでした。"}; }
  });
  ipcMain.handle("niconico:check-program",(event,input)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDまたはURLを入力してください。"};
    return checkNiconicoProgram(input);
  });
  ipcMain.handle("niconico:start-comments",(event,input,options)=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,code:"FORBIDDEN",message:"この操作は許可されていません。"};
    if(typeof input!=="string"||input.length>512) return {ok:false,code:"INVALID_INPUT",message:"放送IDまたはURLを入力してください。"};
    return startCommentStream(input,{fetchBacklog:options?.fetchBacklog!==false});
  });
  ipcMain.handle("niconico:stop-comments",event=>{
    if(event.sender!==mainWindow?.webContents) return {ok:false,message:"この操作は許可されていません。"};
    return stopCommentStream();
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
  mainWindow.on("closed",()=>{mainWindow=null;});
}

app.whenReady().then(()=>{
  niconicoSession=session.fromPartition(NICONICO_PARTITION);
  niconicoSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
  niconicoSession.cookies.on("changed",()=>{void notifySessionStatus();});
  registerIpcHandlers();
  createMainWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
});
app.on("before-quit",()=>{if(commentProvider){try{commentProvider.disconnect();}catch{}commentProvider=null;}});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
