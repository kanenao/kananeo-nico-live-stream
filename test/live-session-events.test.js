"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  parseWatchControlMessage,
  isTerminalDisconnectReason,
  clampReconnectDelay,
  withAudienceToken,
  attachWatchControlBridge
}=require("../src/live-session-events");

test("parses viewer statistics and schedule messages with bounded values",()=>{
  assert.deepEqual(parseWatchControlMessage({type:"statistics",data:{viewers:123,comments:456}}),{
    type:"statistics",viewers:123,comments:456
  });
  assert.deepEqual(parseWatchControlMessage({type:"schedule",data:{begin:"2026-11-11T10:00:00+09:00",end:"2026-11-11T11:30:00+09:00"}}),{
    type:"schedule",begin:"2026-11-11T01:00:00.000Z",end:"2026-11-11T02:30:00.000Z"
  });
  assert.equal(parseWatchControlMessage({type:"statistics",data:{viewers:-1}}),null);
  assert.equal(parseWatchControlMessage({type:"schedule",data:{begin:"bad",end:"bad"}}),null);
});

test("parses ping, seat, reconnect and disconnect without leaking payloads",()=>{
  assert.deepEqual(parseWatchControlMessage({type:"ping"}),{type:"ping"});
  assert.deepEqual(parseWatchControlMessage({type:"seat",data:{keepIntervalSec:999}}),{type:"seat",keepIntervalSec:300});
  assert.deepEqual(parseWatchControlMessage({type:"reconnect",data:{audienceToken:"abc",waitTimeSec:12}}),{
    type:"reconnect",audienceToken:"abc",waitTimeSec:12
  });
  assert.equal(parseWatchControlMessage({type:"disconnect",data:{reason:"END_PROGRAM"}}).terminal,true);
  assert.equal(parseWatchControlMessage({type:"disconnect",data:{reason:"SERVICE_TEMPORARILY_UNAVAILABLE"}}).terminal,false);
  assert.equal(isTerminalDisconnectReason("TAKEOVER"),true);
  assert.equal(isTerminalDisconnectReason("UNKNOWN"),false);
});

test("bounds reconnect delay and rejects unsafe endpoints",()=>{
  assert.equal(clampReconnectDelay(12),12000);
  assert.equal(clampReconnectDelay(999),300000);
  assert.equal(clampReconnectDelay(-5),0);
  assert.equal(clampReconnectDelay(undefined,5000),5000);
  assert.equal(withAudienceToken("wss://a.live.nicovideo.jp/ws","abc").url,"wss://a.live.nicovideo.jp/ws?audience_token=abc");
  assert.equal(withAudienceToken("wss://evil.example/ws","abc").ok,false);
  assert.equal(withAudienceToken("https://live.nicovideo.jp/ws","abc").ok,false);
});

test("wraps a provider's existing watch socket and updates token on reconnect",async()=>{
  const events=[];
  let client;
  const provider={
    retryIntervalMs:5000,
    fetchWebSocketUrl:async()=>({wsUrl:"wss://a.live.nicovideo.jp/ws"}),
    async connectWebSocket(url){
      this.wsClient={
        handleMessage(message){events.push("original:"+message.type);},
        disconnect(){events.push("closed");}
      };
      client=this.wsClient;
      events.push("connect:"+url);
    }
  };
  const bridge=attachWatchControlBridge(provider,{onEvent:event=>events.push(event.type)});
  assert.equal(bridge.ok,true);
  await provider.connectWebSocket("wss://a.live.nicovideo.jp/ws");
  client.handleMessage({type:"statistics",data:{viewers:3}});
  client.handleMessage({type:"reconnect",data:{audienceToken:"new-token",waitTimeSec:2}});
  await new Promise(resolve=>setTimeout(resolve,5));
  const next=await provider.fetchWebSocketUrl();
  assert.match(next.wsUrl,/audience_token=new-token/);
  assert.equal(provider.retryIntervalMs,2000);
  assert.ok(events.includes("statistics"));
  assert.ok(events.includes("original:statistics"));
  assert.ok(events.includes("closed"));
  bridge.dispose();
});
