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
