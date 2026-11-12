"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isLoopbackRemoteAddress,
  parseLoopbackHostHeader,
  isSameLoopbackOrigin,
  createRemoteControlServer
} = require("../src/remote-control-server");

test("accepts only loopback peer addresses", () => {
  assert.equal(isLoopbackRemoteAddress("127.0.0.1"), true);
  assert.equal(isLoopbackRemoteAddress("::1"), true);
  assert.equal(isLoopbackRemoteAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackRemoteAddress("192.168.1.10"), false);
  assert.equal(isLoopbackRemoteAddress("::ffff:192.168.1.10"), false);
});

test("validates loopback host headers and exact server port", () => {
  assert.equal(parseLoopbackHostHeader("127.0.0.1:18240",18240), true);
  assert.equal(parseLoopbackHostHeader("localhost:18240",18240), true);
  assert.equal(parseLoopbackHostHeader("[::1]:18240",18240), true);
  assert.equal(parseLoopbackHostHeader("127.0.0.1:18241",18240), false);
  assert.equal(parseLoopbackHostHeader("192.168.1.10:18240",18240), false);
  assert.equal(parseLoopbackHostHeader("evil.example:18240",18240), false);
});

test("rejects cross-origin requests even when they target localhost", () => {
  assert.equal(isSameLoopbackOrigin("http://127.0.0.1:18240",18240), true);
  assert.equal(isSameLoopbackOrigin("http://localhost:18240",18240), true);
  assert.equal(isSameLoopbackOrigin("https://127.0.0.1:18240",18240), false);
  assert.equal(isSameLoopbackOrigin("http://127.0.0.1:18241",18240), false);
  assert.equal(isSameLoopbackOrigin("http://attacker.example:18240",18240), false);
});

test("requires callbacks to be explicitly supplied", () => {
  assert.throws(() => createRemoteControlServer(), /static directory/i);
  assert.throws(() => createRemoteControlServer({
    staticDirectory:".",onPair:()=>{},resolveDevice:()=>{},onSnapshot:()=>{},onComments:()=>{}
  }), /onCommand callback/i);
});

test("serves authenticated status, comments, and only permissioned commands", async t => {
  const {createDeviceCredential,verifyDeviceToken} = require("../src/remote-control-security");
  const {token,device} = createDeviceCredential({
    name:"CI test device",
    permissions:["status:read","comments:read","bgm:control"]
  });
  const calls=[];
  const server=createRemoteControlServer({
    staticDirectory:require("node:path").join(__dirname,"../src"),
    onPair:async input=>({ok:true,receivedName:input.name}),
    resolveDevice:async candidate=>verifyDeviceToken(candidate,device)?device:null,
    onSnapshot:async()=>({programId:"lv123",comment:{stateLabel:"接続済み"}}),
    onComments:async(_device,limit)=>[{content:"test",limit}],
    onCommand:async(_device,command,payload)=>{calls.push({command,payload});return {ok:true,message:"done"}}
  });
  const net=require("node:net");
  const probe=net.createServer();
  await new Promise((resolve,reject)=>{probe.once("error",reject);probe.listen(0,"127.0.0.1",resolve);});
  const port=probe.address().port;
  await new Promise(resolve=>probe.close(resolve));
  const started=await server.start(port);
  assert.equal(started.ok,true);
  t.after(async()=>{await server.stop();});
  const base="http://127.0.0.1:"+port;
  const info=await fetch(base+"/api/info");
  assert.equal(info.status,200);
  assert.equal((await info.json()).pairingRequired,true);

  const noAuth=await fetch(base+"/api/status");
  assert.equal(noAuth.status,401);
  const auth={Authorization:"Bearer "+token};
  const status=await fetch(base+"/api/status",{headers:auth});
  assert.equal(status.status,200);
  assert.equal((await status.json()).status.programId,"lv123");

  const comments=await fetch(base+"/api/comments?limit=7",{headers:auth});
  assert.equal(comments.status,200);
  assert.equal((await comments.json()).comments[0].limit,7);

  const denied=await fetch(base+"/api/command",{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({command:"player:next"})});
  assert.equal(denied.status,401);

  const allowed=await fetch(base+"/api/command",{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({command:"bgm:volume",payload:{value:0.4}})});
  assert.equal(allowed.status,200);
  assert.deepEqual(calls,[{command:"bgm:volume",payload:{value:0.4}}]);

  const crossOrigin=await fetch(base+"/api/status",{headers:{...auth,Origin:"http://attacker.example"}});
  assert.equal(crossOrigin.status,403);
});
