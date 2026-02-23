import { TimeEntry } from '../renderer/types';

let counter = 0;

export function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  counter++;
  return {
    id: `test-${counter}`,
    title: `Entry ${counter}`,
    startMinutes: 540, // 9:00 AM
    endMinutes: 600,   // 10:00 AM
    color: '#4a9eff',
    done: false,
    ...overrides,
  };
}
