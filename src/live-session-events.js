"use strict";

const TERMINAL_DISCONNECT_REASONS = new Set([
  "END_PROGRAM",
  "TAKEOVER",
  "NO_PERMISSION",
  "TOO_MANY_CONNECTIONS",
  "TOO_MANY_WATCHINGS"
]);

function boundedInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function parseWatchControlMessage(input) {
  let message=input;
  if (typeof input === "string") {
    if (input.length > 64 * 1024) return null;
    try { message=JSON.parse(input); } catch { return null; }
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) return null;
  const type=typeof message.type === "string" ? message.type : "";
  const data=message.data && typeof message.data === "object" && !Array.isArray(message.data) ? message.data : {};

  switch (type) {
    case "messageServer":
      return {type};
    case "statistics": {
      const count=value=>{
        const number=Number(value);
        if (!Number.isFinite(number) || number<0) return null;
        return boundedInteger(number,0,1000000000);
      };
      const viewers=count(data.viewers);
      const comments=count(data.comments ?? data.commentCount);
      if (viewers===null && comments===null) return null;
      return {type,viewers,comments};
    }
    case "schedule": {
      const begin=typeof data.begin === "string" ? data.begin.slice(0,64) : "";
      const end=typeof data.end === "string" ? data.end.slice(0,64) : "";
      const beginMs=Date.parse(begin),endMs=Date.parse(end);
      if (!Number.isFinite(beginMs) || !Number.isFinite(endMs) || endMs<=beginMs) return null;
      return {type,begin:new Date(beginMs).toISOString(),end:new Date(endMs).toISOString()};
    }
    case "seat":
      return {type,keepIntervalSec:boundedInteger(data.keepIntervalSec ?? 30,10,300) ?? 30};
    case "ping":
      return {type};
    case "reconnect": {
      const audienceToken=typeof data.audienceToken === "string" && data.audienceToken.length<=4096
        ? data.audienceToken : "";
      const waitTimeSec=Number.isFinite(Number(data.waitTimeSec))
        ? boundedInteger(data.waitTimeSec,0,300) : null;
      return {type,audienceToken,waitTimeSec};
    }
    case "disconnect": {
      const reason=typeof data.reason === "string" && /^[A-Z0-9_]{1,64}$/.test(data.reason)
        ? data.reason : "UNKNOWN";
      return {type,reason,terminal:TERMINAL_DISCONNECT_REASONS.has(reason)};
    }
    case "error": {
      const message=typeof data.message === "string" ? data.message.slice(0,200) : "WebSocket error";
      return {type,message};
    }
    default:
      return null;
  }
}

function isTerminalDisconnectReason(reason) {
  return TERMINAL_DISCONNECT_REASONS.has(String(reason || ""));
}

function clampReconnectDelay(waitTimeSec, fallbackMs=5000) {
  const seconds=Number(waitTimeSec);
  if (!Number.isFinite(seconds)) {
    const fallback=Number(fallbackMs);
    return Number.isFinite(fallback) ? Math.max(0,Math.min(300000,Math.floor(fallback))) : 5000;
  }
  return Math.max(0,Math.min(300000,Math.floor(seconds*1000)));
}

function withAudienceToken(webSocketUrl, audienceToken) {
  if (typeof webSocketUrl !== "string" || webSocketUrl.length>4096) {
    return {ok:false,code:"INVALID_WEBSOCKET_URL"};
  }
  let url;
  try { url=new URL(webSocketUrl); } catch { return {ok:false,code:"INVALID_WEBSOCKET_URL"}; }
  const host=url.hostname.toLowerCase();
  if (url.protocol!=="wss:" || url.username || url.password ||
      !(host==="nicovideo.jp" || host.endsWith(".nicovideo.jp"))) {
    return {ok:false,code:"UNTRUSTED_WEBSOCKET_URL"};
  }
  if (typeof audienceToken==="string" && audienceToken.length>0 && audienceToken.length<=4096) {
    url.searchParams.set("audience_token",audienceToken);
  }
  return {ok:true,url:url.toString()};
}

/**
 * Observe the already-open watch-control socket owned by the pinned nicomget provider.
 * It does not create a second WebSocket and therefore does not take a second viewing seat.
 */
function attachWatchControlBridge(provider, handlers={}) {
  if (!provider || typeof provider.connectWebSocket!=="function" ||
      typeof provider.fetchWebSocketUrl!=="function") {
    return {ok:false,code:"WATCH_CONTROL_UNAVAILABLE"};
  }

  let audienceToken="";
  const originalFetch=provider.fetchWebSocketUrl;
  provider.fetchWebSocketUrl=async function(...args) {
    const result=await originalFetch.apply(this,args);
    if (!result || typeof result.wsUrl!=="string") throw new Error("Watch WebSocket URL missing");
    const secured=withAudienceToken(result.wsUrl,audienceToken);
    if (!secured.ok) throw new Error("Untrusted watch WebSocket URL");
    return {...result,wsUrl:secured.url};
  };

  const originalConnect=provider.connectWebSocket;
  provider.connectWebSocket=async function(...args) {
    const pending=originalConnect.apply(this,args);
    const client=this.wsClient;
    if (client && typeof client.handleMessage==="function" && !client.__kananeoWatchBridge) {
      const originalHandle=client.handleMessage.bind(client);
      client.__kananeoWatchBridge=true;
      client.handleMessage=(message)=>{
        const event=parseWatchControlMessage(message);
        if (event) {
          try { handlers.onEvent?.(event); } catch {}
          if (event.type==="reconnect") {
            if (event.audienceToken) audienceToken=event.audienceToken;
            const delay=clampReconnectDelay(event.waitTimeSec,this.retryIntervalMs);
            this.retryIntervalMs=delay;
            const socketClient=client;
            setTimeout(()=>{
              if (this.wsClient===socketClient) {
                try { socketClient.disconnect(); } catch {}
              }
            },0);
          }
        }
        return originalHandle(message);
      };
    } else if (!client || typeof client.handleMessage!=="function") {
      try { handlers.onUnavailable?.(); } catch {}
    }
    await pending;
  };

  return {
    ok:true,
    get audienceTokenApplied(){return audienceToken.length>0;},
    dispose(){
      provider.fetchWebSocketUrl=originalFetch;
      provider.connectWebSocket=originalConnect;
    }
  };
}

module.exports = {
  parseWatchControlMessage,
  isTerminalDisconnectReason,
  clampReconnectDelay,
  withAudienceToken,
  attachWatchControlBridge
};
