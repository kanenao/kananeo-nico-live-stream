"use strict";
function editingMenus(){
 const editItems=[{label:"元に戻す",role:"undo"},{label:"やり直す",role:"redo"},{type:"separator"},
 {label:"切り取り",role:"cut"},{label:"コピー",role:"copy"},{label:"貼り付け",role:"paste"},{label:"削除",role:"delete"},
 {type:"separator"},{label:"すべて選択",role:"selectAll"}];
 return [{label:"編集",submenu:editItems}];
}
function editingContextMenu(params){
 if(params?.isEditable)return editingMenus()[0].submenu;
 if(params?.selectionText)return [{label:"コピー",role:"copy"},{label:"すべて選択",role:"selectAll"}];
 return [];
}
module.exports={editingMenus,editingContextMenu};
