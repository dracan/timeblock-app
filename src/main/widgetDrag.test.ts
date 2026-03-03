import { describe, it, expect } from 'vitest';
import { computeDragBounds, DragStartState } from './widgetDrag';

describe('computeDragBounds', () => {
  const start: DragStartState = {
    mouseX: 500,
    mouseY: 300,
    winX: 100,
    winY: 200,
    winW: 300,
    winH: 96,
  };

  it('computes correct position from mouse delta', () => {
    const bounds = computeDragBounds(start, 520, 310);
    expect(bounds.x).toBe(120);
    expect(bounds.y).toBe(210);
  });

  it('always preserves width and height from drag start', () => {
    const bounds = computeDragBounds(start, 800, 600);
    expect(bounds.width).toBe(300);
    expect(bounds.height).toBe(96);
  });

  it('handles negative deltas (dragging up-left)', () => {
    const bounds = computeDragBounds(start, 450, 250);
    expect(bounds.x).toBe(50);
    expect(bounds.y).toBe(150);
    expect(bounds.width).toBe(300);
    expect(bounds.height).toBe(96);
  });

  it('returns original position when mouse has not moved', () => {
    const bounds = computeDragBounds(start, 500, 300);
    expect(bounds.x).toBe(100);
    expect(bounds.y).toBe(200);
    expect(bounds.width).toBe(300);
    expect(bounds.height).toBe(96);
  });
});
