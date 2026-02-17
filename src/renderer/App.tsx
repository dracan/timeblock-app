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

  // Update current time every 1s so back-to-back entries switch immediately at boundaries
  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 1_000);
    return () => clearInterval(id);
  }, []);

  const activeEntry = entries.find(
    (e) => e.startMinutes <= currentMinutes && currentMinutes < e.endMinutes
  );

  const [widgetOpen, setWidgetOpen] = useState(false);

  // Send active entry to widget whenever it changes
  useEffect(() => {
    if (window.electronAPI?.sendActiveEntry) {
      window.electronAPI.sendActiveEntry(activeEntry ?? null);
    }
  }, [activeEntry]);

  // Listen for widget toggled state from main process
  useEffect(() => {
    if (!window.electronAPI?.onWidgetToggled) return;
    const cleanup = window.electronAPI.onWidgetToggled((open: boolean) => {
      setWidgetOpen(open);
    });
    return cleanup;
  }, []);

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
        {window.electronAPI && (
          <button
            className={`widget-toggle-btn${widgetOpen ? ' active' : ''}`}
            onClick={() => window.electronAPI.toggleWidget()}
            title={widgetOpen ? 'Hide floating widget' : 'Show floating widget'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <rect x="4" y="4" width="8" height="5" rx="1" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
        )}
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
