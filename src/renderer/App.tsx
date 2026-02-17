import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TimeEntry, UpdateInfo } from './types';
import { entriesToMarkdown, markdownToEntries } from './utils/markdown';
import Timeline from './components/Timeline';

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function App() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const realToday = useMemo(() => new Date(), []);
  const isToday = isSameDay(selectedDate, realToday);

  // Update current time every 1s so back-to-back entries switch immediately at boundaries
  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Only compute active entry when viewing today
  const activeEntry = isToday
    ? entries.find(
        (e) => e.startMinutes <= currentMinutes && currentMinutes < e.endMinutes
      )
    : undefined;

  const [widgetOpen, setWidgetOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Check for updates on mount
  useEffect(() => {
    window.electronAPI?.checkForUpdate().then((info) => {
      if (info) setUpdateInfo(info);
    });
  }, []);

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

  // Load entries when selectedDate changes
  useEffect(() => {
    const dateStr = getDateStr(selectedDate);
    if (window.electronAPI) {
      window.electronAPI.loadDay(dateStr).then((md) => {
        if (md) {
          setEntries(markdownToEntries(md));
        } else {
          setEntries([]);
        }
      });
    } else {
      // Fallback: localStorage for browser dev
      const stored = localStorage.getItem(`day-${dateStr}`);
      if (stored) {
        setEntries(markdownToEntries(stored));
      } else {
        setEntries([]);
      }
    }
  }, [selectedDate]);

  // Auto-save with debounce
  const saveEntries = useCallback(
    (updated: TimeEntry[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const dateStr = getDateStr(selectedDate);
        const md = entriesToMarkdown(updated, selectedDate);
        if (window.electronAPI) {
          window.electronAPI.saveDay(dateStr, md);
        } else {
          localStorage.setItem(`day-${dateStr}`, md);
        }
      }, 300);
    },
    [selectedDate]
  );

  const updateEntries = useCallback(
    (updated: TimeEntry[]) => {
      setEntries(updated);
      saveEntries(updated);
    },
    [saveEntries]
  );

  const goToPrevDay = useCallback(() => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, []);

  const goToNextDay = useCallback(() => {
    if (isToday) return;
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, [isToday]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="date-nav">
          <button
            className="date-nav-btn"
            onClick={goToPrevDay}
            title="Previous day"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className={!isToday ? 'past-day' : ''}>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </h1>
          <button
            className="date-nav-btn"
            onClick={goToNextDay}
            disabled={isToday}
            title={isToday ? 'Already on today' : 'Next day'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="header-right">
          {updateInfo && (
            <button
              className="update-badge"
              onClick={() => window.electronAPI?.openExternal(updateInfo.releaseUrl)}
              title={`Update available: v${updateInfo.latestVersion} (current: v${updateInfo.currentVersion})`}
            >
              v{updateInfo.latestVersion} available
            </button>
          )}
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
        </div>
      </header>
      <Timeline entries={entries} onEntriesChange={updateEntries} isToday={isToday} />
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
