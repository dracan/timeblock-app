import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { TimeEntry } from '../types';
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
  entries: TimeEntry[];
  onEntriesChange: (entries: TimeEntry[]) => void;
  isToday: boolean;
}

type DragMode =
  | { type: 'none' }
  | { type: 'creating'; startY: number; currentY: number }
  | { type: 'moving'; entryId: string; offsetY: number; startMinutesMap: Map<string, number> }
  | { type: 'resizing'; entryId: string; edge: 'top' | 'bottom' };

const DEFAULT_COLOR = '#4a9eff';

export default function Timeline({ entries, onEntriesChange, isToday }: TimelineProps) {
  const [dragMode, setDragMode] = useState<DragMode>({ type: 'none' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number; entryId: string } | null>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const timelineRef = useRef<HTMLDivElement>(null);
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
      setDragMode({ type: 'creating', startY: y, currentY: y });
      setColorMenu(null);
    },
    [getTimelineY]
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
        const deltaY = y - dragMode.offsetY;
        const deltaMinutes = snapToGrid(pixelsToMinutes(deltaY, hourHeight) - DAY_START_HOUR * 60);

        const updated = entries.map((entry) => {
          const origStart = dragMode.startMinutesMap.get(entry.id);
          if (origStart === undefined) return entry;
          const duration = entry.endMinutes - entry.startMinutes;
          const newStart = snapToGrid(origStart + deltaMinutes);
          return {
            ...entry,
            startMinutes: Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - duration, newStart)),
            endMinutes: Math.max(DAY_START_HOUR * 60 + duration, Math.min(DAY_END_HOUR * 60, newStart + duration)),
          };
        });
        onEntriesChange(updated);
      } else if (dragMode.type === 'resizing') {
        const minutes = snapToGrid(pixelsToMinutes(y, hourHeight));
        const updated = entries.map((entry) => {
          if (entry.id !== dragMode.entryId) return entry;
          if (dragMode.edge === 'top') {
            const newStart = Math.min(minutes, entry.endMinutes - 15);
            return { ...entry, startMinutes: Math.max(DAY_START_HOUR * 60, newStart) };
          } else {
            const newEnd = Math.max(minutes, entry.startMinutes + 15);
            return { ...entry, endMinutes: Math.min(DAY_END_HOUR * 60, newEnd) };
          }
        });
        onEntriesChange(updated);
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
            const newEntry: TimeEntry = {
              id: generateId(),
              title: 'New Block',
              startMinutes: Math.max(DAY_START_HOUR * 60, startMin),
              endMinutes: Math.min(DAY_END_HOUR * 60, endMin),
              color: DEFAULT_COLOR,
            };
            onEntriesChange([...entries, newEntry]);
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
  }, [dragMode, entries, onEntriesChange, getTimelineY, hourHeight]);

  // --- Entry interactions ---
  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string) => {
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
      const idsToMove = newSelected.size > 0 ? newSelected : new Set([entryId]);
      const startMinutesMap = new Map<string, number>();
      entries.forEach((entry) => {
        if (idsToMove.has(entry.id)) {
          startMinutesMap.set(entry.id, entry.startMinutes);
        }
      });

      setDragMode({
        type: 'moving',
        entryId,
        offsetY: y,
        startMinutesMap,
      });
    },
    [selectedIds, entries, getTimelineY]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, entryId: string, edge: 'top' | 'bottom') => {
      e.stopPropagation();
      e.preventDefault();
      setColorMenu(null);
      setDragMode({ type: 'resizing', entryId, edge });
    },
    []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedIds.has(entryId)) {
        setSelectedIds(new Set([entryId]));
      }
      setColorMenu({ x: e.clientX, y: e.clientY, entryId });
    },
    [selectedIds]
  );

  const handleColorSelect = useCallback(
    (color: string) => {
      if (!colorMenu) return;
      const idsToUpdate = selectedIds.size > 0 ? selectedIds : new Set([colorMenu.entryId]);
      const updated = entries.map((entry) =>
        idsToUpdate.has(entry.id) ? { ...entry, color } : entry
      );
      onEntriesChange(updated);
      setColorMenu(null);
    },
    [colorMenu, selectedIds, entries, onEntriesChange]
  );

  const handleTitleChange = useCallback(
    (entryId: string, title: string) => {
      const updated = entries.map((entry) =>
        entry.id === entryId ? { ...entry, title } : entry
      );
      onEntriesChange(updated);
    },
    [entries, onEntriesChange]
  );

  const handleToggleDone = useCallback(
    (entryId: string) => {
      const updated = entries.map((entry) =>
        entry.id === entryId ? { ...entry, done: !entry.done } : entry
      );
      onEntriesChange(updated);
    },
    [entries, onEntriesChange]
  );

  const handleDuplicate = useCallback(
    (entryId: string) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const newEntry: TimeEntry = {
        ...entry,
        id: generateId(),
      };
      onEntriesChange([...entries, newEntry]);
      setSelectedIds(new Set([newEntry.id]));
      setColorMenu(null);
    },
    [entries, onEntriesChange]
  );

  const handleDelete = useCallback(
    (entryId: string) => {
      const idsToDelete = selectedIds.size > 0 && selectedIds.has(entryId)
        ? selectedIds
        : new Set([entryId]);
      const updated = entries.filter((entry) => !idsToDelete.has(entry.id));
      onEntriesChange(updated);
      setSelectedIds(new Set());
      setColorMenu(null);
    },
    [selectedIds, entries, onEntriesChange]
  );

  // Global keydown for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.size > 0 && !editingId) {
        const updated = entries.filter((entry) => !selectedIds.has(entry.id));
        onEntriesChange(updated);
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
  }, [selectedIds, editingId, entries, onEntriesChange]);

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

  // Build layout entries (real entries + phantom creation preview entry)
  const CREATION_PREVIEW_ID = '__creation_preview__';
  let previewStartMin = 0;
  let previewEndMin = 0;
  if (dragMode.type === 'creating') {
    const minY = Math.min(dragMode.startY, dragMode.currentY);
    const maxY = Math.max(dragMode.startY, dragMode.currentY);
    if (maxY - minY > 5) {
      previewStartMin = Math.max(DAY_START_HOUR * 60, snapToGrid(pixelsToMinutes(minY, hourHeight)));
      previewEndMin = Math.min(DAY_END_HOUR * 60, snapToGrid(pixelsToMinutes(maxY, hourHeight)));
    }
  }

  const layoutEntries = useMemo(() => {
    const all = [...entries];
    if (previewStartMin < previewEndMin) {
      all.push({
        id: CREATION_PREVIEW_ID,
        title: '',
        startMinutes: previewStartMin,
        endMinutes: previewEndMin,
        color: '',
      });
    }
    return all;
  }, [entries, previewStartMin, previewEndMin]);

  const layoutMap = useMemo(() => computeOverlapLayout(layoutEntries), [layoutEntries]);

  // Creation preview
  let creationPreview: React.ReactNode = null;
  if (previewStartMin < previewEndMin) {
    const previewLayout = layoutMap.get(CREATION_PREVIEW_ID);
    const leftPercent = previewLayout ? (previewLayout.columnIndex / previewLayout.totalColumns) * 100 : 0;
    const widthPercent = previewLayout ? (1 / previewLayout.totalColumns) * 100 : 100;
    creationPreview = (
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
  }

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
            className="hour-row"
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

        {/* Current time indicator */}
        {isToday && currentMinutes >= DAY_START_HOUR * 60 && currentMinutes <= DAY_END_HOUR * 60 && (
          <div
            className="current-time-line"
            style={{ top: minutesToPixels(currentMinutes, hourHeight) }}
          />
        )}

        {/* Creation preview */}
        {creationPreview}

        {/* Time entries */}
        {entries.map((entry) => {
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
              onMouseDown={(e) => handleBlockMouseDown(e, entry.id)}
              onResizeStart={(e, edge) => handleResizeStart(e, entry.id, edge)}
              onContextMenu={(e) => handleContextMenu(e, entry.id)}
              onTitleChange={(title) => handleTitleChange(entry.id, title)}
              onTitleBlur={() => setEditingId(null)}
              onTitleDoubleClick={() => setEditingId(entry.id)}
              onToggleDone={() => handleToggleDone(entry.id)}
            />
          );
        })}
      </div>

      {/* Color context menu */}
      {colorMenu && (
        <ColorMenu
          x={colorMenu.x}
          y={colorMenu.y}
          onSelect={handleColorSelect}
          onDuplicate={() => handleDuplicate(colorMenu.entryId)}
          onDelete={() => handleDelete(colorMenu.entryId)}
          onClose={() => setColorMenu(null)}
        />
      )}
    </div>
  );
}
