"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildExtensionOptionsRequest,
  parseExtensionOptionsResponse
} = require("../src/extension-api");

test("builds read-only extension options request for a valid program", () => {
  assert.deepEqual(buildExtensionOptionsRequest("lv123"),{
    ok:true,
    url:"https://live2.nicovideo.jp/watch/lv123/extension",
    method:"GET"
  });
  assert.equal(buildExtensionOptionsRequest("../lv123").ok,false);
});

test("parses available extension options without attempting to extend", () => {
  const result=parseExtensionOptionsResponse(JSON.stringify({
    data:{methods:[{type:"free",minutes:30},{type:"point",minutes:30}]}
  }));
  assert.equal(result.ok,true);
  assert.deepEqual(result.methods,[{type:"free",minutes:30},{type:"point",minutes:30}]);
});

test("rejects malformed extension methods", () => {
  assert.equal(parseExtensionOptionsResponse("invalid").ok,false);
  assert.equal(parseExtensionOptionsResponse(JSON.stringify({data:{methods:[{type:"free",minutes:0}]}})).code,"EXTENSION_METHODS_INVALID");
  assert.equal(parseExtensionOptionsResponse(JSON.stringify({data:{methods:"free"}})).ok,false);
});
