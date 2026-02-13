import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimeEntry } from './types';
import { entriesToMarkdown, markdownToEntries } from './utils/markdown';
import Timeline from './components/Timeline';

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function App() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [today] = useState(() => new Date());
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    </div>
  );
}
