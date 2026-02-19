import React, { useState, useRef, useEffect } from 'react';
import { TimeEntry } from '../types';
import { minutesToPixels, formatTime, formatDuration, DEFAULT_HOUR_HEIGHT } from '../utils/time';

interface TimeBlockProps {
  entry: TimeEntry;
  hourHeight: number;
  isSelected: boolean;
  isEditing: boolean;
  columnIndex?: number;
  totalColumns?: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, edge: 'top' | 'bottom') => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onTitleDoubleClick: () => void;
  onToggleDone: () => void;
}

export default function TimeBlock({
  entry,
  hourHeight,
  isSelected,
  isEditing,
  columnIndex = 0,
  totalColumns = 1,
  onMouseDown,
  onResizeStart,
  onContextMenu,
  onTitleChange,
  onTitleBlur,
  onTitleDoubleClick,
  onToggleDone,
}: TimeBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const top = minutesToPixels(entry.startMinutes, hourHeight);
  const height = minutesToPixels(entry.endMinutes, hourHeight) - top;
  const isCompact = height <= 20 * (hourHeight / DEFAULT_HOUR_HEIGHT);
  const leftPercent = (columnIndex / totalColumns) * 100;
  const widthPercent = (1 / totalColumns) * 100;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={`time-block ${isSelected ? 'selected' : ''} ${isCompact ? 'compact' : ''} ${entry.done ? 'done' : ''}`}
      style={{
        top,
        height,
        left: `${leftPercent}%`,
        width: `calc(${widthPercent}% - 1px)`,
        backgroundColor: entry.color,
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mousePosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (!isEditing && entry.title) {
          hoverTimer.current = setTimeout(() => setTooltipPos({ ...mousePosRef.current }), 1000);
        }
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setTooltipPos(null);
      }}
    >
      {/* Tooltip */}
      {tooltipPos && !isEditing && entry.title && (
        <div className="time-block-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>{entry.title} — {formatTime(entry.startMinutes)} - {formatTime(entry.endMinutes)} ({formatDuration(entry.endMinutes - entry.startMinutes)})</div>
      )}

      {/* Resize handles */}
      <div
        className="resize-handle resize-handle-top"
        onMouseDown={(e) => onResizeStart(e, 'top')}
      />
      <div
        className="resize-handle resize-handle-bottom"
        onMouseDown={(e) => onResizeStart(e, 'bottom')}
      />

      {/* Content */}
      <div className="time-block-content">
        <div
          className={`time-block-checkbox ${entry.done ? 'checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <div className="time-block-text">
          {isEditing ? (
            <input
              ref={inputRef}
              className="time-block-title-input"
              value={entry.title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTitleBlur();
                if (e.key === 'Escape') onTitleBlur();
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="time-block-title" onDoubleClick={onTitleDoubleClick}>
              {entry.title}
            </div>
          )}
          {!isCompact && (
            <div className="time-block-time">
              {formatTime(entry.startMinutes)} - {formatTime(entry.endMinutes)} ({formatDuration(entry.endMinutes - entry.startMinutes)})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
