import React, { useRef, useEffect } from 'react';
import { TimeEntry } from '../types';
import { minutesToPixels, formatTime } from '../utils/time';

interface TimeBlockProps {
  entry: TimeEntry;
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, edge: 'top' | 'bottom') => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onTitleDoubleClick: () => void;
}

export default function TimeBlock({
  entry,
  isSelected,
  isEditing,
  onMouseDown,
  onResizeStart,
  onContextMenu,
  onTitleChange,
  onTitleBlur,
  onTitleDoubleClick,
}: TimeBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const top = minutesToPixels(entry.startMinutes);
  const height = minutesToPixels(entry.endMinutes) - top;
  const isCompact = height <= 20;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      className={`time-block ${isSelected ? 'selected' : ''} ${isCompact ? 'compact' : ''}`}
      style={{
        top,
        height,
        backgroundColor: entry.color,
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
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
            {formatTime(entry.startMinutes)} - {formatTime(entry.endMinutes)}
          </div>
        )}
      </div>
    </div>
  );
}
