"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const svg=read("src/app-icon.svg");
const html=read("src/index.html");
const css=read("src/style.css");
const pkg=JSON.parse(read("package.json"));
test("app uses the same selected mascot in Windows executable and desktop shortcuts",()=>{
 assert.equal(pkg.build.win.icon,"src/app-icon.svg");
 assert.equal(pkg.build.appId,"jp.kanenao.nicolivestream");
 assert.equal(pkg.build.nsis.createDesktopShortcut,true);
 assert.equal(pkg.build.nsis.createStartMenuShortcut,true);
 assert.ok(pkg.build.files.includes("src/**/*"),"SVG must be present in packaged UI");
});
test("icon is a self-contained high-resolution white tile with black mascot",()=>{
 assert.match(svg,/<svg\s+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/viewBox="0 0 1024 1024"/);
 assert.match(svg,/<circle cx="503" cy="252" r="116"/);
 assert.match(svg,/<circle cx="503" cy="252" r="45"/);
 assert.match(svg,/<circle cx="358" cy="586" r="42"/);
 assert.match(svg,/<circle cx="598" cy="561" r="41"/);
 assert.match(svg,/<rect x="76" y="73" width="872" height="872"/);
 assert.match(svg,/<path d="M 474,630/);
 assert.doesNotMatch(svg,/<(?:script|image|foreignObject)\b|https?:\/\//i);
 assert.ok(Buffer.byteLength(svg,"utf8")<15000,"icon should remain small and self-contained");
});
test("app shell replaces old KN/K placeholders and shows the same icon in two visible places",()=>{
 assert.equal((html.match(/src="app-icon\.svg"/g)||[]).length,2);
 assert.match(html,/<div class="mark"><img src="app-icon\.svg" alt="kananeo マスコット"><\/div>/);
 assert.match(html,/<span class="avatar"><img src="app-icon\.svg"/);
 assert.doesNotMatch(html,/<div class="mark">kn<\/div>/);
 assert.doesNotMatch(html,/<span class="avatar">K<\/span>/);
 assert.match(css,/\.brand \.mark img\{/);
 assert.match(css,/\.topbar \.avatar img\{/);
});
