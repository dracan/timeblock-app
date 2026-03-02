import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const COLORS = [
  '#4a9eff', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

interface ColorMenuProps {
  x: number;
  y: number;
  onSelect: (color: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSendToToday?: () => void;
}

export default function ColorMenu({ x, y, onSelect, onDuplicate, onDelete, onClose, onSendToToday }: ColorMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let left = x;
    let top = y;
    if (x + rect.width > window.innerWidth) {
      left = x - rect.width;
    }
    if (y + rect.height > window.innerHeight) {
      top = y - rect.height;
    }
    if (left !== adjusted.left || top !== adjusted.top) {
      setAdjusted({ left, top });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the same right-click closing it
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    left: adjusted.left,
    top: adjusted.top,
    zIndex: 1000,
  };

  return (
    <div ref={menuRef} className="color-menu" style={style}>
      <div className="color-menu-label">Color</div>
      <div className="color-menu-grid">
        {COLORS.map((color) => (
          <button
            key={color}
            className="color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
          />
        ))}
      </div>
      <button className="color-menu-action" onClick={onDuplicate}>
        Duplicate
      </button>
      {onSendToToday && (
        <button className="color-menu-action" onClick={onSendToToday}>
          Send to Today
        </button>
      )}
      <button className="color-menu-delete" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
