"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {editingMenus,editingContextMenu}=require("../src/editing-support");
test("supports editing shortcuts and text field right click",()=>{
 const roles=editingMenus()[0].submenu.map(x=>x.role);
 for(const role of ["cut","copy","paste","selectAll","undo","redo"])assert.ok(roles.includes(role));
 assert.ok(editingContextMenu({isEditable:true}).some(x=>x.role==="paste"));
 assert.deepEqual(editingContextMenu({}),[]);
});
