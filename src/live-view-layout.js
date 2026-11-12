"use strict";

function normalizeLiveViewBounds(input, viewport) {
  if (!input || typeof input !== "object" || input.visible !== true) {
    return {visible:false,x:0,y:0,width:0,height:0};
  }

  const x = Number(input.x);
  const y = Number(input.y);
  const width = Number(input.width);
  const height = Number(input.height);
  const viewportWidth = Number(viewport?.width);
  const viewportHeight = Number(viewport?.height);

  if (![x,y,width,height,viewportWidth,viewportHeight].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;
  if (width > 12000 || height > 12000 || viewportWidth > 20000 || viewportHeight > 20000) return null;

  const left = Math.max(0, Math.min(viewportWidth, x));
  const top = Math.max(0, Math.min(viewportHeight, y));
  const right = Math.max(left, Math.min(viewportWidth, x + width));
  const bottom = Math.max(top, Math.min(viewportHeight, y + height));
  const clippedWidth = right - left;
  const clippedHeight = bottom - top;

  if (clippedWidth < 160 || clippedHeight < 120) {
    return {visible:false,x:0,y:0,width:0,height:0};
  }

  return {
    visible:true,
    x:Math.round(left),
    y:Math.round(top),
    width:Math.round(clippedWidth),
    height:Math.round(clippedHeight)
  };
}

module.exports = { normalizeLiveViewBounds };
