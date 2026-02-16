export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 23;
export const SNAP_MINUTES = 15;
export const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;

// Zoom constants
export const DEFAULT_HOUR_HEIGHT = 60;
export const MIN_HOUR_HEIGHT = 20;
export const MAX_HOUR_HEIGHT = 200;
export const ZOOM_STEP = 1.15;

// Backward-compat aliases
export const HOUR_HEIGHT = DEFAULT_HOUR_HEIGHT;
export const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

export function getTotalHeight(hourHeight: number): number {
  return TOTAL_HOURS * hourHeight;
}

export function minutesToPixels(minutes: number, hourHeight: number = DEFAULT_HOUR_HEIGHT): number {
  const offsetMinutes = minutes - DAY_START_HOUR * 60;
  return (offsetMinutes / 60) * hourHeight;
}

export function pixelsToMinutes(pixels: number, hourHeight: number = DEFAULT_HOUR_HEIGHT): number {
  return (pixels / hourHeight) * 60 + DAY_START_HOUR * 60;
}

export function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

export function formatTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function formatTime24(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
