"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeLiveZoomSettings,calculateLivePageZoomFactor}=require("../src/live-page-zoom");
test("auto fits a wide Nico watch page into its app slot",()=>{
 assert.equal(calculateLivePageZoomFactor(550),0.5);assert.equal(calculateLivePageZoomFactor(770),0.7);
 assert.equal(calculateLivePageZoomFactor(1300),1);assert.equal(calculateLivePageZoomFactor(300),0.35);
});
test("manual zoom survives resize and is bounded",()=>{
 assert.equal(calculateLivePageZoomFactor(500,{zoomMode:"manual",zoomPercent:65}),0.65);
 assert.equal(calculateLivePageZoomFactor(1000,{zoomMode:"manual",zoomPercent:65}),0.65);
 assert.deepEqual(normalizeLiveZoomSettings({zoomMode:"manual",zoomPercent:250}),{zoomMode:"manual",zoomPercent:125});
});
test("invalid sizes and settings use safe defaults",()=>{
 assert.equal(calculateLivePageZoomFactor(NaN),0.7);
 assert.equal(calculateLivePageZoomFactor(400,{zoomMode:"manual",zoomPercent:"bad"}),0.7);
});
