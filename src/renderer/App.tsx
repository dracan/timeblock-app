import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimeEntry } from './types';
import { entriesToMarkdown, markdownToEntries } from './utils/markdown';
import Timeline from './components/Timeline';

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function App() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [today] = useState(() => new Date());
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update current time every 60s
  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const activeEntry = entries.find(
    (e) => e.startMinutes <= currentMinutes && currentMinutes < e.endMinutes
  );

  // Load entries on mount
  useEffect(() => {
    const dateStr = getDateStr(today);
    if (window.electronAPI) {
      window.electronAPI.loadDay(dateStr).then((md) => {
        if (md) {
          setEntries(markdownToEntries(md));
        }
      });
    } else {
      // Fallback: localStorage for browser dev
      const stored = localStorage.getItem(`day-${dateStr}`);
      if (stored) {
        setEntries(markdownToEntries(stored));
      }
    }
  }, [today]);

  // Auto-save with debounce
  const saveEntries = useCallback(
    (updated: TimeEntry[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const dateStr = getDateStr(today);
        const md = entriesToMarkdown(updated, today);
        if (window.electronAPI) {
          window.electronAPI.saveDay(dateStr, md);
        } else {
          localStorage.setItem(`day-${dateStr}`, md);
        }
      }, 300);
    },
    [today]
  );

  const updateEntries = useCallback(
    (updated: TimeEntry[]) => {
      setEntries(updated);
      saveEntries(updated);
    },
    [saveEntries]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          {today.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </h1>
      </header>
      <Timeline entries={entries} onEntriesChange={updateEntries} />
      {activeEntry && (
        <div className="now-panel">
          <div
            className="now-panel-accent"
            style={{ background: activeEntry.color }}
          />
          <span className="now-panel-title">{activeEntry.title || 'Untitled'}</span>
        </div>
      )}
    </div>
  );
}
