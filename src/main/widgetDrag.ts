export interface DragStartState {
  mouseX: number;
  mouseY: number;
  winX: number;
  winY: number;
  winW: number;
  winH: number;
}

export interface DragBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeDragBounds(
  start: DragStartState,
  currentMouseX: number,
  currentMouseY: number
): DragBounds {
  return {
    x: start.winX + currentMouseX - start.mouseX,
    y: start.winY + currentMouseY - start.mouseY,
    width: start.winW,
    height: start.winH,
  };
}
