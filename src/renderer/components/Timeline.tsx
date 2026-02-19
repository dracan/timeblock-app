import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { TimeEntry, DayColumn } from '../types';
import TimeBlock from './TimeBlock';
import ColorMenu from './ColorMenu';
import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  DEFAULT_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  ZOOM_STEP,
  getTotalHeight,
  minutesToPixels,
  pixelsToMinutes,
  snapToGrid,
  formatTime,
  formatDuration,
  generateId,
} from '../utils/time';
import { computeOverlapLayout } from '../utils/overlap';

interface TimelineProps {
  days: DayColumn[];
  onEntriesChange: (dateStr: string, entries: TimeEntry[]) => void;
  todayStr: string;
  todayEntries: TimeEntry[];
}

type DragMode =
  | { type: 'none' }
  | { type: 'creating'; dayIndex: number; startY: number; currentY: number }
  | { type: 'moving'; dayIndex: number; entryId: string; offsetY: number; startMinutesMap: Map<string, number> }
  | { type: 'resizing'; dayIndex: number; entryId: string; edge: 'top' | 'bottom' };

const DEFAULT_COLOR = '#4a9eff';

export default function Timeline({ days, onEntriesChange, todayStr, todayEntries }: TimelineProps) {
  const [dragMode, setDragMode] = useState<DragMode>({ type: 'none' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number; entryId: string; dayIndex: number } | null>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const timelineRef = useRef<HTMLDivElement>(null);
  const dayColumnsRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<{ timeAtCursor: number; cursorOffsetInContainer: number } | null>(null);

  const hours = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    hours.push(h);
  }

  const getTimelineY = useCallback((clientY: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    return clientY - rect.top + timelineRef.current.scrollTop;
  }, []);

  // Determine which day column was clicked based on clientX
  const getColumnIndex = useCallback((clientX: number): number => {
    if (!dayColumnsRef.current || days.length <= 1) return 0;
    const rect = dayColumnsRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const colWidth = rect.width / days.length;
    return Math.max(0, Math.min(days.length - 1, Math.floor(x / colWidth)));
  }, [days.length]);

  // --- Click-drag to create ---
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start creation on left-click directly on the timeline (not on blocks)
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('.time-block')) return;

      // Clear selection if not ctrl-clicking
      if (!e.ctrlKey) {
        setSelectedIds(new Set());
      }

      const y = getTimelineY(e.clientY);
      const dayIndex = getColumnIndex(e.clientX);
      setDragMode({ type: 'creating', dayIndex, startY: y, currentY: y });
      setColorMenu(null);
    },
    [getTimelineY, getColumnIndex]
  );

  // --- Mouse move handler (all drag modes) ---
  useEffect(() => {
    if (dragMode.type === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      const y = getTimelineY(e.clientY);

      if (dragMode.type === 'creating') {
        setDragMode((prev) =>
          prev.type === 'creating' ? { ...prev, currentY: y } : prev
        );
      } else if (dragMode.type === 'moving') {
        const currentDayIndex = getColumnIndex(e.clientX);
        const deltaY = y - dragMode.offsetY;
        const deltaMinutes = snapToGrid(pixelsToMinutes(deltaY, hourHeight) - DAY_START_HOUR * 60);

        const applyDelta = (entry: TimeEntry): TimeEntry => {
          const origStart = dragMode.startMinutesMap.get(entry.id);
          if (origStart === undefined) return entry;
          const duration = entry.endMinutes - entry.startMinutes;
          const newStart = snapToGrid(origStart + deltaMinutes);
          return {
            ...entry,
            startMinutes: Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - duration, newStart)),
            endMinutes: Math.max(DAY_START_HOUR * 60 + duration, Math.min(DAY_END_HOUR * 60, newStart + duration)),
          };
        };

        if (currentDayIndex === dragMode.dayIndex) {
          // Same-day move
          const dayEntries = days[dragMode.dayIndex]?.entries || [];
          const updated = dayEntries.map(applyDelta);
          onEntriesChange(days[dragMode.dayIndex].dateStr, updated);
        } else {
          // Cross-day transfer
          const movingIds = dragMode.startMinutesMap;
          const sourceDayEntries = days[dragMode.dayIndex]?.entries || [];
          const targetDayEntries = days[currentDayIndex]?.entries || [];

          const remaining = sourceDayEntries.filter((e) => !movingIds.has(e.id));
          const movedEntries = sourceDayEntries
            .filter((e) => movingIds.has(e.id))
            .map(applyDelta);

          onEntriesChange(days[dragMode.dayIndex].dateStr, remaining);
          onEntriesChange(days[currentDayIndex].dateStr, [...targetDayEntries, ...movedEntries]);
          setDragMode((prev) => prev.type === 'moving' ? { ...prev, dayIndex: currentDayIndex } : prev);
        }
      } else if (dragMode.type === 'resizing') {
        const dayEntries = days[dragMode.dayIndex]?.entries || [];
        const minutes = snapToGrid(pixelsToMinutes(y, hourHeight));
        const updated = dayEntries.map((entry) => {
          if (entry.id !== dragMode.entryId) return entry;
          if (dragMode.edge === 'top') {
            const newStart = Math.min(minutes, entry.endMinutes - 15);
            return { ...entry, startMinutes: Math.max(DAY_START_HOUR * 60, newStart) };
          } else {
            const newEnd = Math.max(minutes, entry.startMinutes + 15);
            return { ...entry, endMinutes: Math.min(DAY_END_HOUR * 60, newEnd) };
          }
        });
        onEntriesChange(days[dragMode.dayIndex].dateStr, updated);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragMode.type === 'creating') {
        const y1 = dragMode.startY;
        const y2 = dragMode.currentY;
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        // Only create if dragged at least a bit
        if (maxY - minY > 5) {
          const startMin = snapToGrid(pixelsToMinutes(minY, hourHeight));
          const endMin = snapToGrid(pixelsToMinutes(maxY, hourHeight));
          if (endMin > startMin) {
            const dayEntries = days[dragMode.dayIndex]?.entries || [];
            const newEntry: TimeEntry = {
              id: generateId(),
              title: 'New Block',
              startMinutes: Math.max(DAY_START_HOUR * 60, startMin),
              endMinutes: Math.min(DAY_END_HOUR * 60, endMin),
              color: DEFAULT_COLOR,
            };
            onEntriesChange(days[dragMode.dayIndex].dateStr, [...dayEntries, newEntry]);
            setEditingId(newEntry.id);
          }
        }
      }
      setDragMode({ type: 'none' });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, days, onEntriesChange, getTimelineY, getColumnIndex, hourHeight]);

  // --- Entry interactions ---
  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string, dayIndex: number) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setColorMenu(null);

      let newSelected: Set<string>;
      if (e.ctrlKey) {
        newSelected = new Set(selectedIds);
        if (newSelected.has(entryId)) {
          newSelected.delete(entryId);
        } else {
          newSelected.add(entryId);
        }
        setSelectedIds(newSelected);
        return;
      }

      // If entry isn't selected, select only it
      if (!selectedIds.has(entryId)) {
        newSelected = new Set([entryId]);
        setSelectedIds(newSelected);
      } else {
        newSelected = selectedIds;
      }

      // Start moving
      const y = getTimelineY(e.clientY);
      const dayEntries = days[dayIndex]?.entries || [];
      const idsToMove = newSelected.size > 0 ? newSelected : new Set([entryId]);
      const startMinutesMap = new Map<string, number>();
      dayEntries.forEach((entry) => {
        if (idsToMove.has(entry.id)) {
          startMinutesMap.set(entry.id, entry.startMinutes);
        }
      });

      setDragMode({
        type: 'moving',
        dayIndex,
        entryId,
        offsetY: y,
        startMinutesMap,
      });
    },
    [selectedIds, days, getTimelineY]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, entryId: string, edge: 'top' | 'bottom', dayIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      setColorMenu(null);
      setDragMode({ type: 'resizing', dayIndex, entryId, edge });
    },
    []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entryId: string, dayIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedIds.has(entryId)) {
        setSelectedIds(new Set([entryId]));
      }
      setColorMenu({ x: e.clientX, y: e.clientY, entryId, dayIndex });
    },
    [selectedIds]
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!colorMenu) return;
      const idsToUpdate = selectedIds.size > 0 ? selectedIds : new Set([colorMenu.entryId]);
      // Apply across all days (selection can span days)
      for (const day of days) {
        const hasAny = day.entries.some((e) => idsToUpdate.has(e.id));
        if (hasAny) {
          const updated = day.entries.map((entry) =>
            idsToUpdate.has(entry.id) ? { ...entry, color } : entry
          );
          onEntriesChange(day.dateStr, updated);
        }
      }
      setColorMenu(null);
    },
    [colorMenu, selectedIds, days, onEntriesChange]
  );

  const handleTitleChange = useCallback(
    (entryId: string, title: string, dayIndex: number) => {
      const dayEntries = days[dayIndex]?.entries || [];
      const updated = dayEntries.map((entry) =>
        entry.id === entryId ? { ...entry, title } : entry
      );
      onEntriesChange(days[dayIndex].dateStr, updated);
    },
    [days, onEntriesChange]
  );

  const handleToggleDone = useCallback(
    (entryId: string, dayIndex: number) => {
      const dayEntries = days[dayIndex]?.entries || [];
      const updated = dayEntries.map((entry) =>
        entry.id === entryId ? { ...entry, done: !entry.done } : entry
      );
      onEntriesChange(days[dayIndex].dateStr, updated);
    },
    [days, onEntriesChange]
  );

  const handleDuplicate = useCallback(
    (entryId: string, dayIndex: number) => {
      const dayEntries = days[dayIndex]?.entries || [];
      const entry = dayEntries.find((e) => e.id === entryId);
      if (!entry) return;
      const newEntry: TimeEntry = {
        ...entry,
        id: generateId(),
      };
      onEntriesChange(days[dayIndex].dateStr, [...dayEntries, newEntry]);
      setSelectedIds(new Set([newEntry.id]));
      setColorMenu(null);
    },
    [days, onEntriesChange]
  );

  const handleDelete = useCallback(
    (entryId: string, dayIndex: number) => {
      const idsToDelete = selectedIds.size > 0 && selectedIds.has(entryId)
        ? selectedIds
        : new Set([entryId]);
      // Delete across all days
      for (const day of days) {
        const hasAny = day.entries.some((e) => idsToDelete.has(e.id));
        if (hasAny) {
          const updated = day.entries.filter((entry) => !idsToDelete.has(entry.id));
          onEntriesChange(day.dateStr, updated);
        }
      }
      setSelectedIds(new Set());
      setColorMenu(null);
    },
    [selectedIds, days, onEntriesChange]
  );

  const handleSendToToday = useCallback(
    () => {
      if (!colorMenu) return;
      const idsToMove = selectedIds.size > 0 && selectedIds.has(colorMenu.entryId)
        ? selectedIds
        : new Set([colorMenu.entryId]);
      // Collect entries to move and remove them from source days
      const entriesToMove: TimeEntry[] = [];
      for (const day of days) {
        const matched = day.entries.filter((e) => idsToMove.has(e.id));
        if (matched.length > 0) {
          entriesToMove.push(...matched);
          const remaining = day.entries.filter((e) => !idsToMove.has(e.id));
          onEntriesChange(day.dateStr, remaining);
        }
      }
      // Append to today
      onEntriesChange(todayStr, [...todayEntries, ...entriesToMove]);
      setSelectedIds(new Set());
      setColorMenu(null);
    },
    [colorMenu, selectedIds, days, onEntriesChange, todayStr, todayEntries]
  );

  // Global keydown for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.size > 0 && !editingId) {
        // Delete across all days
        for (const day of days) {
          const hasAny = day.entries.some((entry) => selectedIds.has(entry.id));
          if (hasAny) {
            const updated = day.entries.filter((entry) => !selectedIds.has(entry.id));
            onEntriesChange(day.dateStr, updated);
          }
        }
        setSelectedIds(new Set());
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setEditingId(null);
        setColorMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, editingId, days, onEntriesChange]);

  // Current time updater
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  // Ctrl+mousewheel zoom
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const rect = el.getBoundingClientRect();
      const cursorYInContainer = e.clientY - rect.top;
      const cursorYInContent = cursorYInContainer + el.scrollTop;
      const timeAtCursor = pixelsToMinutes(cursorYInContent, hourHeight);

      setHourHeight((prev) => {
        const next = e.deltaY < 0
          ? Math.min(MAX_HOUR_HEIGHT, prev * ZOOM_STEP)
          : Math.max(MIN_HOUR_HEIGHT, prev / ZOOM_STEP);
        return next;
      });

      pendingScrollRef.current = { timeAtCursor, cursorOffsetInContainer: cursorYInContainer };
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [hourHeight]);

  // Scroll anchoring after zoom
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !timelineRef.current) return;
    pendingScrollRef.current = null;

    const newPixelY = minutesToPixels(pending.timeAtCursor, hourHeight);
    timelineRef.current.scrollTop = newPixelY - pending.cursorOffsetInContainer;
  }, [hourHeight]);

  // Set initial zoom to fit 9AM–6PM in viewport and scroll to 9AM
  useLayoutEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const visibleHeight = el.clientHeight;
    const newHourHeight = Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, visibleHeight / 9));
    setHourHeight(newHourHeight);
    el.scrollTop = minutesToPixels(9 * 60, newHourHeight);
  }, []);

  // Build per-day layout maps and creation preview
  const CREATION_PREVIEW_ID = '__creation_preview__';
  const isMultiDay = days.length > 1;

  const perDayData = useMemo(() => {
    return days.map((day, dayIndex) => {
      let previewStartMin = 0;
      let previewEndMin = 0;
      if (dragMode.type === 'creating' && dragMode.dayIndex === dayIndex) {
        const minY = Math.min(dragMode.startY, dragMode.currentY);
        const maxY = Math.max(dragMode.startY, dragMode.currentY);
        if (maxY - minY > 5) {
          previewStartMin = Math.max(DAY_START_HOUR * 60, snapToGrid(pixelsToMinutes(minY, hourHeight)));
          previewEndMin = Math.min(DAY_END_HOUR * 60, snapToGrid(pixelsToMinutes(maxY, hourHeight)));
        }
      }

      const layoutEntries = [...day.entries];
      if (previewStartMin < previewEndMin) {
        layoutEntries.push({
          id: CREATION_PREVIEW_ID,
          title: '',
          startMinutes: previewStartMin,
          endMinutes: previewEndMin,
          color: '',
        });
      }

      const layoutMap = computeOverlapLayout(layoutEntries);

      return {
        day,
        dayIndex,
        previewStartMin,
        previewEndMin,
        layoutMap,
      };
    });
  }, [days, dragMode, hourHeight]);

  const showCurrentTimeLine = currentMinutes >= DAY_START_HOUR * 60 && currentMinutes <= DAY_END_HOUR * 60;

  return (
    <div className="timeline-container" ref={timelineRef}>
      <div
        className="timeline"
        style={{ height: getTotalHeight(hourHeight) }}
        onMouseDown={handleTimelineMouseDown}
      >
        {/* Hour grid */}
        {hours.map((hour) => (
          <div
            key={hour}
            className={`hour-row${hour < 9 || hour >= 18 ? ' off-hours' : ''}`}
            style={{
              top: minutesToPixels(hour * 60, hourHeight),
              height: hourHeight,
            }}
          >
            <span className="hour-label">{formatTime(hour * 60)}</span>
            <div className="hour-line" />
            <div className="half-hour-line" style={{ top: hourHeight / 2 }} />
          </div>
        ))}

        {/* Current time indicator — single-day mode only (spans gutter) */}
        {!isMultiDay && days[0]?.isToday && showCurrentTimeLine && (
          <div
            className="current-time-line"
            style={{ top: minutesToPixels(currentMinutes, hourHeight) }}
          />
        )}

        {/* Day columns overlay */}
        <div className="day-columns" ref={dayColumnsRef}>
          {perDayData.map(({ day, dayIndex, previewStartMin, previewEndMin, layoutMap }) => (
            <div className="day-column" key={day.dateStr}>
              {/* Per-column current time line (multi-day mode) */}
              {isMultiDay && day.isToday && showCurrentTimeLine && (
                <div
                  className="current-time-line"
                  style={{ top: minutesToPixels(currentMinutes, hourHeight) }}
                />
              )}

              {/* Creation preview */}
              {previewStartMin < previewEndMin && (() => {
                const previewLayout = layoutMap.get(CREATION_PREVIEW_ID);
                const leftPercent = previewLayout ? (previewLayout.columnIndex / previewLayout.totalColumns) * 100 : 0;
                const widthPercent = previewLayout ? (1 / previewLayout.totalColumns) * 100 : 100;
                return (
                  <div
                    className="creation-preview"
                    style={{
                      top: minutesToPixels(previewStartMin, hourHeight),
                      height: minutesToPixels(previewEndMin, hourHeight) -
                        minutesToPixels(previewStartMin, hourHeight),
                      left: `${leftPercent}%`,
                      width: `calc(${widthPercent}% - 1px)`,
                    }}
                  >
                    <span className="creation-preview-time">
                      {formatTime(previewStartMin)} -{' '}
                      {formatTime(previewEndMin)}{' '}
                      ({formatDuration(previewEndMin - previewStartMin)})
                    </span>
                  </div>
                );
              })()}

              {/* Time entries */}
              {day.entries.map((entry) => {
                const layout = layoutMap.get(entry.id);
                return (
                  <TimeBlock
                    key={entry.id}
                    entry={entry}
                    hourHeight={hourHeight}
                    isSelected={selectedIds.has(entry.id)}
                    isEditing={editingId === entry.id}
                    columnIndex={layout?.columnIndex}
                    totalColumns={layout?.totalColumns}
                    onMouseDown={(e) => handleBlockMouseDown(e, entry.id, dayIndex)}
                    onResizeStart={(e, edge) => handleResizeStart(e, entry.id, edge, dayIndex)}
                    onContextMenu={(e) => handleContextMenu(e, entry.id, dayIndex)}
                    onTitleChange={(title) => handleTitleChange(entry.id, title, dayIndex)}
                    onTitleBlur={() => setEditingId(null)}
                    onTitleDoubleClick={() => setEditingId(entry.id)}
                    onToggleDone={() => handleToggleDone(entry.id, dayIndex)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Color context menu */}
      {colorMenu && (
        <ColorMenu
          x={colorMenu.x}
          y={colorMenu.y}
          onSelect={handleColorSelect}
          onDuplicate={() => handleDuplicate(colorMenu.entryId, colorMenu.dayIndex)}
          onDelete={() => handleDelete(colorMenu.entryId, colorMenu.dayIndex)}
          onClose={() => setColorMenu(null)}
          onSendToToday={days[colorMenu.dayIndex]?.dateStr !== todayStr ? handleSendToToday : undefined}
        />
      )}
    </div>
  );
}
