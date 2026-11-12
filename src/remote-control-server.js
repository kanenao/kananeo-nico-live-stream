"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const {
  RemoteRateLimiter,
  isLoopbackBindAddress,
  canExecuteRemoteCommand
} = require("./remote-control-security");

const MAX_BODY_BYTES = 16 * 1024;
const DEVICE_RATE_WINDOW_MS = 60 * 1000;
const DEVICE_RATE_LIMIT = 90;
const PAIR_RATE_LIMIT = 8;
const STATIC_FILES = Object.freeze({
  "/": ["remote-controller.html", "text/html; charset=utf-8"],
  "/controller": ["remote-controller.html", "text/html; charset=utf-8"],
  "/remote-controller.html": ["remote-controller.html", "text/html; charset=utf-8"],
  "/remote-controller.js": ["remote-controller.js", "text/javascript; charset=utf-8"],
  "/remote-controller.css": ["remote-controller.css", "text/css; charset=utf-8"]
});

function isLoopbackRemoteAddress(address) {
  if (typeof address !== "string") return false;
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

function parseLoopbackHostHeader(value, expectedPort) {
  if (typeof value !== "string" || value.length > 255) return false;
  try {
    const parsed = new URL("http://" + value);
    if (!isLoopbackBindAddress(parsed.hostname)) return false;
    const port = parsed.port ? Number(parsed.port) : 80;
    return port === expectedPort;
  } catch {
    return false;
  }
}

function isSameLoopbackOrigin(value, expectedPort) {
  if (typeof value !== "string" || value.length > 512) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" || !isLoopbackBindAddress(parsed.hostname)) return false;
    const port = parsed.port ? Number(parsed.port) : 80;
    return port === expectedPort && parsed.username === "" && parsed.password === "";
  } catch {
    return false;
  }
}

function sendJson(response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY"
  });
  response.end(body);
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!total) return {};
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("JSON object required");
    error.code = "INVALID_JSON";
    throw error;
  }
  return parsed;
}

function createRemoteControlServer({
  staticDirectory,
  onPair,
  resolveDevice,
  onSnapshot,
  onComments,
  onCommand
} = {}) {
  if (typeof staticDirectory !== "string" || !staticDirectory) {
    throw new TypeError("A static directory is required");
  }
  for (const [name, callback] of Object.entries({
    onPair, resolveDevice, onSnapshot, onComments, onCommand
  })) {
    if (typeof callback !== "function") throw new TypeError(name + " callback is required");
  }

  let server = null;
  let boundPort = 0;
  const ipLimiter = new RemoteRateLimiter({windowMs:DEVICE_RATE_WINDOW_MS,maxRequests:120,maxKeys:64});
  const pairingLimiter = new RemoteRateLimiter({windowMs:DEVICE_RATE_WINDOW_MS,maxRequests:PAIR_RATE_LIMIT,maxKeys:32});
  const deviceLimiter = new RemoteRateLimiter({windowMs:DEVICE_RATE_WINDOW_MS,maxRequests:DEVICE_RATE_LIMIT,maxKeys:64});

  async function authorize(request, permission) {
    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
    const token = authorization.slice(7).trim();
    if (token.length < 40 || token.length > 64) return null;
    const device = await resolveDevice(token);
    if (!device || device.revokedAt !== null || !canExecuteRemoteCommand(device, permission)) return null;
    const limited = deviceLimiter.consume(device.id);
    if (!limited.allowed) return {rateLimited:true,retryAfterMs:limited.retryAfterMs};
    return device;
  }

  async function handle(request, response) {
    const ip = request.socket?.remoteAddress || "";
    if (!isLoopbackRemoteAddress(ip)) {
      sendJson(response,403,{ok:false,code:"LOOPBACK_ONLY",message:"localhostからの接続だけ利用できます。"});
      return;
    }
    if (!parseLoopbackHostHeader(request.headers.host,boundPort)) {
      sendJson(response,403,{ok:false,code:"INVALID_HOST",message:"許可されていない接続先です。"});
      return;
    }
    const origin = request.headers.origin;
    if (origin && !isSameLoopbackOrigin(origin,boundPort)) {
      sendJson(response,403,{ok:false,code:"INVALID_ORIGIN",message:"異なる接続元からの要求は拒否しました。"});
      return;
    }
    const ipLimit = ipLimiter.consume(ip);
    if (!ipLimit.allowed) {
      sendJson(response,429,{ok:false,code:"RATE_LIMITED",message:"要求回数の上限に達しました。"});
      return;
    }

    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    if (request.method === "GET" && STATIC_FILES[pathname]) {
      const [filename,contentType] = STATIC_FILES[pathname];
      try {
        const filePath = path.join(staticDirectory,filename);
        const body = await fs.readFile(filePath);
        response.writeHead(200,{
          "Content-Type":contentType,
          "Content-Length":body.length,
          "Cache-Control":"no-store",
          "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          "X-Content-Type-Options":"nosniff",
          "X-Frame-Options":"DENY",
          "Referrer-Policy":"no-referrer"
        });
        response.end(body);
      } catch {
        sendJson(response,404,{ok:false,code:"NOT_FOUND",message:"画面を読み込めませんでした。"});
      }
      return;
    }

    if (request.method === "GET" && pathname === "/api/info") {
      sendJson(response,200,{ok:true,app:"kananeo nico live stream",transport:"HTTP localhost",pairingRequired:true,
        permissions:["status:read","comments:read","player:control","bgm:control"]});
      return;
    }

    if (request.method === "POST" && pathname === "/api/pair") {
      const pairLimit = pairingLimiter.consume(ip);
      if (!pairLimit.allowed) {
        sendJson(response,429,{ok:false,code:"PAIR_RATE_LIMITED",message:"ペアリング試行回数の上限に達しました。"});
        return;
      }
      let input;
      try { input = await readJsonBody(request); }
      catch (error) {
        sendJson(response,error.code==="BODY_TOO_LARGE"?413:400,{ok:false,code:error.code||"INVALID_JSON",message:"ペアリング情報を読み取れませんでした。"});
        return;
      }
      const result = await onPair(input);
      sendJson(response,result?.ok?200:result?.code==="PAIR_RATE_LIMITED"?429:400,result||{ok:false,code:"PAIR_FAILED"});
      return;
    }

    if (request.method === "GET" && pathname === "/api/status") {
      const device = await authorize(request,"status:read");
      if (!device) {sendJson(response,401,{ok:false,code:"UNAUTHORIZED",message:"端末認証が必要です。"});return;}
      if (device.rateLimited) {sendJson(response,429,{ok:false,code:"RATE_LIMITED",message:"端末の要求回数上限に達しました。"});return;}
      try { sendJson(response,200,{ok:true,status:await onSnapshot(device)}); }
      catch { sendJson(response,503,{ok:false,code:"STATUS_UNAVAILABLE",message:"アプリの状態を取得できませんでした。"}); }
      return;
    }

    if (request.method === "GET" && pathname === "/api/comments") {
      const device = await authorize(request,"comments:read");
      if (!device) {sendJson(response,401,{ok:false,code:"UNAUTHORIZED",message:"コメント閲覧権限がありません。"});return;}
      if (device.rateLimited) {sendJson(response,429,{ok:false,code:"RATE_LIMITED",message:"端末の要求回数上限に達しました。"});return;}
      const parsed = new URL(request.url || "/api/comments","http://127.0.0.1");
      const rawLimit = Number(parsed.searchParams.get("limit") || 30);
      const limit = Number.isFinite(rawLimit) ? Math.max(1,Math.min(100,Math.floor(rawLimit))) : 30;
      try { sendJson(response,200,{ok:true,comments:await onComments(device,limit)}); }
      catch { sendJson(response,503,{ok:false,code:"COMMENTS_UNAVAILABLE",message:"コメント一覧を取得できませんでした。"}); }
      return;
    }

    if (request.method === "POST" && pathname === "/api/command") {
      let input;
      try { input = await readJsonBody(request); }
      catch (error) {
        sendJson(response,error.code==="BODY_TOO_LARGE"?413:400,{ok:false,code:error.code||"INVALID_JSON",message:"操作内容を読み取れませんでした。"});
        return;
      }
      if (typeof input.command !== "string" || input.command.length > 64) {
        sendJson(response,400,{ok:false,code:"INVALID_COMMAND",message:"操作名を確認してください。"});
        return;
      }
      const device = await authorize(request,input.command);
      if (!device) {sendJson(response,401,{ok:false,code:"UNAUTHORIZED",message:"この端末には操作権限がありません。"});return;}
      if (device.rateLimited) {sendJson(response,429,{ok:false,code:"RATE_LIMITED",message:"端末の操作回数上限に達しました。"});return;}
      const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {};
      try {
        const result = await onCommand(device,input.command,payload);
        sendJson(response,result?.ok===false?409:200,result||{ok:true});
      } catch {
        sendJson(response,503,{ok:false,code:"COMMAND_FAILED",message:"操作を実行できませんでした。"});
      }
      return;
    }

    sendJson(response,404,{ok:false,code:"NOT_FOUND",message:"指定されたAPIはありません。"});
  }

  async function start(port = 18240) {
    if (server) return {ok:false,code:"ALREADY_STARTED",message:"リモート操作サーバーは既に起動しています。"};
    const selectedPort = Number(port);
    if (!Number.isInteger(selectedPort) || selectedPort < 1024 || selectedPort > 65535) {
      return {ok:false,code:"INVALID_PORT",message:"ポート番号は1024〜65535で指定してください。"};
    }
    if (!isLoopbackBindAddress("127.0.0.1")) {
      return {ok:false,code:"INVALID_BIND_ADDRESS",message:"localhost以外には接続を公開できません。"};
    }
    server = http.createServer((request,response) => {
      void handle(request,response).catch(() => {
        if (!response.headersSent) sendJson(response,500,{ok:false,code:"INTERNAL_ERROR",message:"リモート操作サーバーでエラーが発生しました。"});
        else response.destroy();
      });
    });
    server.requestTimeout = 10_000;
    server.headersTimeout = 5_000;
    server.keepAliveTimeout = 2_000;
    try {
      await new Promise((resolve,reject)=>{
        const onError=error=>{server?.removeListener("listening",onListening);reject(error);};
        const onListening=()=>{server?.removeListener("error",onError);resolve();};
        server.once("error",onError);
        server.once("listening",onListening);
        server.listen(selectedPort,"127.0.0.1");
      });
      boundPort = server.address().port;
      return {ok:true,host:"127.0.0.1",port:boundPort,url:"http://127.0.0.1:"+boundPort+"/"};
    } catch(error) {
      const code=error?.code||"LISTEN_FAILED";
      server=null;boundPort=0;
      return {ok:false,code,message:code==="EADDRINUSE"?"指定したポートは既に使用されています。別の番号を指定してください。":"リモート操作サーバーを起動できませんでした。"};
    }
  }

  async function stop() {
    if (!server) return {ok:true,stopped:false};
    const current=server;
    server=null;
    boundPort=0;
    ipLimiter.reset();pairingLimiter.reset();deviceLimiter.reset();
    await new Promise(resolve=>{
      try { current.close(()=>resolve());current.closeAllConnections?.(); }
      catch { resolve(); }
    });
    return {ok:true,stopped:true};
  }

  function address() {
    if(!server)return null;
    const current=server.address();
    return current&&typeof current==="object"?{host:"127.0.0.1",port:current.port,url:"http://127.0.0.1:"+current.port+"/"}:null;
  }

  return Object.freeze({start,stop,address});
}

module.exports = {
  MAX_BODY_BYTES,
  isLoopbackRemoteAddress,
  parseLoopbackHostHeader,
  isSameLoopbackOrigin,
  readJsonBody,
  createRemoteControlServer
};
