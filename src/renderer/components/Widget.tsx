import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimeEntry } from '../types';
import { formatTime } from '../utils/time';

function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '0s left';
  const h = Math.floor(remainingSeconds / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  const s = remainingSeconds % 60;
  if (h > 0 || m >= 60) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${s}s left`;
  return `${s}s left`;
}

const DRAG_THRESHOLD = 4;

export default function Widget() {
  const [entry, setEntry] = useState<TimeEntry | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [flashing, setFlashing] = useState(false);
  const prevEntryId = useRef<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.onActiveEntryUpdate) return;
    const cleanup = window.electronAPI.onActiveEntryUpdate((e: TimeEntry | null) => {
      setEntry(e);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    const newId = entry?.id ?? null;
    if (prevEntryId.current && newId && prevEntryId.current !== newId) {
      setFlashing(true);
      const timer = setTimeout(() => setFlashing(false), 1200);
      prevEntryId.current = newId;
      return () => clearTimeout(timer);
    }
    prevEntryId.current = newId;
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    const tick = () => {
      const now = new Date();
      const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      setRemainingSeconds(Math.max(0, entry.endMinutes * 60 - nowSeconds));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entry]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.screenX;
    const startY = e.screenY;
    let dragging = false;

    window.electronAPI?.widgetDragStart?.(startX, startY);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging && (Math.abs(ev.screenX - startX) > DRAG_THRESHOLD || Math.abs(ev.screenY - startY) > DRAG_THRESHOLD)) {
        dragging = true;
      }
      if (dragging) {
        window.electronAPI?.widgetDragMove?.(ev.screenX, ev.screenY);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      window.electronAPI?.widgetDragEnd?.();
      if (!dragging) {
        window.electronAPI?.focusMainWindow?.();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div className={`widget${flashing ? ' widget-flash' : ''}`} onMouseDown={handleMouseDown}>
      {entry ? (
        <>
          <div className="widget-accent" style={{ background: entry.color }} />
          <div className="widget-info">
            <div className="widget-title">{entry.title || 'Untitled'}</div>
            <div className="widget-time">
              <span>{formatTime(entry.startMinutes)} – {formatTime(entry.endMinutes)}</span>
              <span className="widget-countdown">{formatCountdown(remainingSeconds)}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="widget-empty">No active block</div>
      )}
    </div>
  );
}
