"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeLiveViewBounds } = require("../src/live-view-layout");

test("hides the live view when the slot is not visible", () => {
  assert.deepEqual(normalizeLiveViewBounds({visible:false,x:1,y:2,width:600,height:400}), {
    visible:false,x:0,y:0,width:0,height:0
  });
});

test("keeps valid bounds inside the main window content area", () => {
  assert.deepEqual(normalizeLiveViewBounds(
    {visible:true,x:20.4,y:30.6,width:800.2,height:500.3},
    {width:1200,height:800}
  ), {visible:true,x:20,y:31,width:800,height:500});
});

test("clips scrolled or partially hidden slots to the viewport", () => {
  assert.deepEqual(normalizeLiveViewBounds(
    {visible:true,x:-20,y:600,width:600,height:300},
    {width:1200,height:800}
  ), {visible:true,x:0,y:600,width:580,height:200});
});

test("rejects invalid or unreasonable input without exposing a view", () => {
  assert.equal(normalizeLiveViewBounds({visible:true,x:NaN,y:0,width:500,height:300},{width:1000,height:700}), null);
  assert.equal(normalizeLiveViewBounds({visible:true,x:0,y:0,width:14000,height:300},{width:15000,height:700}), null);
  assert.equal(normalizeLiveViewBounds({visible:true,x:0,y:0,width:100,height:90},{width:1000,height:700}).visible, false);
  assert.equal(normalizeLiveViewBounds({visible:true,x:0,y:0,width:500,height:300},{width:0,height:700}), null);
});
