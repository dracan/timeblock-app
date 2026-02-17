import React, { useState, useEffect, useRef } from 'react';
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

  return (
    <div className={`widget${flashing ? ' widget-flash' : ''}`} onClick={() => window.electronAPI?.focusMainWindow?.()}>
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
