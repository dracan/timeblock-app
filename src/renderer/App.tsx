import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TimeEntry, DayColumn, UpdateInfo } from './types';
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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function App() {
  const [entriesMap, setEntriesMap] = useState<Record<string, TimeEntry[]>>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dayCount, setDayCount] = useState(() => {
    const stored = localStorage.getItem('dayCount');
    return stored ? Math.min(5, Math.max(1, parseInt(stored, 10) || 1)) : 1;
  });
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes);
  const saveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const realToday = useMemo(() => new Date(), []);
  const todayStr = getDateStr(realToday);

  // Compute visible dates (selectedDate is the leftmost day)
  const visibleDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < dayCount; i++) {
      dates.push(addDays(selectedDate, i));
    }
    return dates;
  }, [selectedDate, dayCount]);

  const visibleDateStrs = useMemo(() => visibleDates.map(getDateStr), [visibleDates]);

  // Update current time every 1s so back-to-back entries switch immediately at boundaries
  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Active entry always computed from today's entries
  const todayEntries = entriesMap[todayStr] || [];
  const activeEntry = todayEntries.find(
    (e) => e.startMinutes <= currentMinutes && currentMinutes < e.endMinutes
  );

  // Compute next upcoming entry (first entry starting at or after now that isn't the active one)
  const nextEntry = todayEntries
    .filter((e) => e.startMinutes >= currentMinutes && e !== activeEntry)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0] ?? null;

  const [widgetOpen, setWidgetOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // Check for updates on mount
  useEffect(() => {
    window.electronAPI?.checkForUpdate().then((info) => {
      if (info) setUpdateInfo(info);
    });
  }, []);

  // Send active entry and next entry to widget whenever they change
  useEffect(() => {
    if (window.electronAPI?.sendActiveEntry) {
      window.electronAPI.sendActiveEntry({ active: activeEntry ?? null, next: nextEntry });
    }
  }, [activeEntry, nextEntry]);

  // Listen for widget toggled state from main process
  useEffect(() => {
    if (!window.electronAPI?.onWidgetToggled) return;
    const cleanup = window.electronAPI.onWidgetToggled((open: boolean) => {
      setWidgetOpen(open);
    });
    return cleanup;
  }, []);

  // Load entries when visible dates change
  useEffect(() => {
    // Collect all date strings we need to load (visible + today for widget)
    const dateStrsToLoad = new Set(visibleDateStrs);
    dateStrsToLoad.add(todayStr);

    const loadAll = async () => {
      const loadPromises = Array.from(dateStrsToLoad).map(async (dateStr) => {
        let entries: TimeEntry[] = [];
        if (window.electronAPI) {
          const md = await window.electronAPI.loadDay(dateStr);
          if (md) entries = markdownToEntries(md);
        } else {
          const stored = localStorage.getItem(`day-${dateStr}`);
          if (stored) entries = markdownToEntries(stored);
        }
        return { dateStr, entries };
      });

      const results = await Promise.all(loadPromises);
      const newMap: Record<string, TimeEntry[]> = {};
      for (const { dateStr, entries } of results) {
        newMap[dateStr] = entries;
      }
      setEntriesMap(newMap);
    };

    loadAll();
  }, [visibleDateStrs, todayStr]);

  // Per-date debounced saving
  const saveForDate = useCallback((dateStr: string, entries: TimeEntry[]) => {
    const existing = saveTimeouts.current.get(dateStr);
    if (existing) clearTimeout(existing);

    saveTimeouts.current.set(dateStr, setTimeout(() => {
      // Parse the dateStr to create a Date for markdown header
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const md = entriesToMarkdown(entries, date);
      if (window.electronAPI) {
        window.electronAPI.saveDay(dateStr, md);
      } else {
        localStorage.setItem(`day-${dateStr}`, md);
      }
      saveTimeouts.current.delete(dateStr);
    }, 300));
  }, []);

  const handleEntriesChange = useCallback(
    (dateStr: string, entries: TimeEntry[]) => {
      setEntriesMap((prev) => ({ ...prev, [dateStr]: entries }));
      saveForDate(dateStr, entries);
    },
    [saveForDate]
  );

  // Key listener for 1-5 day count
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) {
        setDayCount(num);
        localStorage.setItem('dayCount', String(num));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const goToPrevDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
  }, []);

  // Build DayColumn[] for Timeline
  const dayColumns: DayColumn[] = useMemo(() => {
    return visibleDates.map((date) => {
      const dateStr = getDateStr(date);
      return {
        date,
        dateStr,
        entries: entriesMap[dateStr] || [],
        isToday: isSameDay(date, realToday),
      };
    });
  }, [visibleDates, entriesMap, realToday]);

  // Header date display
  const headerText = useMemo(() => {
    if (dayCount === 1) {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
    const first = visibleDates[0];
    const last = visibleDates[visibleDates.length - 1];
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(first)} – ${fmt(last)}`;
  }, [selectedDate, dayCount, visibleDates]);

  const isTodayVisible = dayColumns.some((d) => d.isToday);
  const headerClass = dayCount === 1
    ? (!isTodayVisible ? (selectedDate < realToday ? 'past-day' : 'future-day') : '')
    : (!isTodayVisible ? 'past-day' : '');

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
          <h1 className={headerClass}>
            {headerText}
          </h1>
          <button
            className="date-nav-btn"
            onClick={goToNextDay}
            title="Next day"
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
      {dayCount > 1 && (
        <div className="day-column-headers" style={{ marginLeft: 70 }}>
          {dayColumns.map((col) => (
            <div
              key={col.dateStr}
              className={`day-column-header${col.isToday ? ' today' : ''}`}
            >
              {col.date.toLocaleDateString('en-US', { weekday: 'short' })}{' '}
              {col.date.getDate()}
            </div>
          ))}
        </div>
      )}
      <Timeline days={dayColumns} onEntriesChange={handleEntriesChange} />
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
