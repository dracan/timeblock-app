import { TimeEntry } from '../types';

export interface LayoutInfo {
  columnIndex: number;
  totalColumns: number;
}

export function computeOverlapLayout(entries: TimeEntry[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (entries.length === 0) return result;

  // Sort by start time, longer duration first as tiebreaker
  const sorted = [...entries].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
  });

  // Group overlapping entries using sweep-line
  const groups: TimeEntry[][] = [];
  let groupStart = sorted[0].startMinutes;
  let groupEnd = sorted[0].endMinutes;
  let currentGroup: TimeEntry[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i];
    if (entry.startMinutes < groupEnd) {
      // Overlaps with current group
      currentGroup.push(entry);
      groupEnd = Math.max(groupEnd, entry.endMinutes);
    } else {
      // New group
      groups.push(currentGroup);
      currentGroup = [entry];
      groupStart = entry.startMinutes;
      groupEnd = entry.endMinutes;
    }
  }
  groups.push(currentGroup);

  // Assign columns within each group
  for (const group of groups) {
    // columns[i] tracks the end time of the last entry placed in column i
    const columns: number[] = [];

    for (const entry of group) {
      // Find first column where this entry doesn't overlap
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (entry.startMinutes >= columns[col]) {
          columns[col] = entry.endMinutes;
          result.set(entry.id, { columnIndex: col, totalColumns: 0 }); // totalColumns set later
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(entry.id, { columnIndex: columns.length, totalColumns: 0 });
        columns.push(entry.endMinutes);
      }
    }

    // Set totalColumns for all entries in the group
    const totalColumns = columns.length;
    for (const entry of group) {
      const info = result.get(entry.id)!;
      info.totalColumns = totalColumns;
    }
  }

  return result;
}
