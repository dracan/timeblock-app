import { render, fireEvent, act } from '@testing-library/react';
import Timeline from './Timeline';
import { DayColumn } from '../types';
import { makeEntry } from '../../test/helpers';
import { DAY_START_HOUR, DAY_END_HOUR, minutesToPixels, DEFAULT_HOUR_HEIGHT, MIN_HOUR_HEIGHT } from '../utils/time';

function makeDay(overrides: Partial<DayColumn> = {}): DayColumn {
  return {
    date: new Date(2025, 0, 15),
    dateStr: '2025-01-15',
    entries: [],
    isToday: true,
    ...overrides,
  };
}

function renderTimeline(overrides: { days?: DayColumn[]; todayStr?: string; todayEntries?: any[] } = {}) {
  const onEntriesChange = vi.fn();
  const days = overrides.days ?? [makeDay()];
  const result = render(
    <Timeline
      days={days}
      onEntriesChange={onEntriesChange}
      todayStr={overrides.todayStr ?? '2025-01-15'}
      todayEntries={overrides.todayEntries ?? []}
    />
  );
  return { ...result, onEntriesChange };
}

describe('Timeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hour grid', () => {
    it('renders hour rows from DAY_START_HOUR to DAY_END_HOUR', () => {
      const { container } = renderTimeline();
      const hourRows = container.querySelectorAll('.hour-row');
      const expectedHours = DAY_END_HOUR - DAY_START_HOUR + 1; // 6 to 23 inclusive
      expect(hourRows.length).toBe(expectedHours);
    });

    it('renders hour labels for each hour', () => {
      const { container } = renderTimeline();
      const labels = container.querySelectorAll('.hour-label');
      expect(labels.length).toBe(DAY_END_HOUR - DAY_START_HOUR + 1);
    });

    it('renders half-hour lines within each hour row', () => {
      const { container } = renderTimeline();
      const halfHourLines = container.querySelectorAll('.half-hour-line');
      expect(halfHourLines.length).toBe(DAY_END_HOUR - DAY_START_HOUR + 1);
    });
  });

  describe('off-hours tint', () => {
    it('applies off-hours class to hours before 9 AM', () => {
      const { container } = renderTimeline();
      const hourRows = container.querySelectorAll('.hour-row');
      // Hours 6, 7, 8 (indices 0, 1, 2) should be off-hours
      for (let i = 0; i < 3; i++) {
        expect(hourRows[i].classList.contains('off-hours')).toBe(true);
      }
    });

    it('applies off-hours class to hours at 6 PM and after', () => {
      const { container } = renderTimeline();
      const hourRows = container.querySelectorAll('.hour-row');
      // Hour 18 (6 PM) is at index 12 (18-6), and all subsequent hours should be off-hours
      for (let i = 12; i < hourRows.length; i++) {
        expect(hourRows[i].classList.contains('off-hours')).toBe(true);
      }
    });

    it('does not apply off-hours class to business hours (9 AM - 5 PM)', () => {
      const { container } = renderTimeline();
      const hourRows = container.querySelectorAll('.hour-row');
      // Hours 9-17 (indices 3-11) should NOT be off-hours
      for (let i = 3; i < 12; i++) {
        expect(hourRows[i].classList.contains('off-hours')).toBe(false);
      }
    });
  });

  describe('current time line', () => {
    it('renders current time line on today in single-day view', () => {
      const { container } = renderTimeline({
        days: [makeDay({ isToday: true })],
      });
      const timeLine = container.querySelector('.current-time-line');
      expect(timeLine).toBeTruthy();
    });

    it('does not render current time line on a non-today day in single-day view', () => {
      const { container } = renderTimeline({
        days: [makeDay({ isToday: false })],
      });
      const timeLine = container.querySelector('.current-time-line');
      expect(timeLine).toBeNull();
    });

    it('positions current time line at correct pixel offset', () => {
      const { container } = renderTimeline({
        days: [makeDay({ isToday: true })],
      });
      const timeLine = container.querySelector('.current-time-line') as HTMLElement;
      // Current time is 10:00 AM = 600 minutes
      // In jsdom, clientHeight is 0, so initial zoom sets hourHeight to MIN_HOUR_HEIGHT
      const expectedTop = minutesToPixels(600, MIN_HOUR_HEIGHT);
      expect(timeLine.style.top).toBe(`${expectedTop}px`);
    });

    it('renders per-column current time line in multi-day view for today column', () => {
      const { container } = renderTimeline({
        days: [
          makeDay({ dateStr: '2025-01-14', isToday: false, date: new Date(2025, 0, 14) }),
          makeDay({ dateStr: '2025-01-15', isToday: true }),
          makeDay({ dateStr: '2025-01-16', isToday: false, date: new Date(2025, 0, 16) }),
        ],
      });
      // In multi-day mode, current time line appears inside the today column
      const timeLines = container.querySelectorAll('.current-time-line');
      expect(timeLines.length).toBe(1);
    });
  });

  describe('time entries rendering', () => {
    it('renders TimeBlock for each entry', () => {
      const entries = [
        makeEntry({ id: 'a', title: 'Meeting', startMinutes: 540, endMinutes: 600 }),
        makeEntry({ id: 'b', title: 'Lunch', startMinutes: 720, endMinutes: 780 }),
      ];
      const { container } = renderTimeline({
        days: [makeDay({ entries })],
      });
      const blocks = container.querySelectorAll('.time-block');
      expect(blocks.length).toBe(2);
    });

    it('renders no blocks for empty entries', () => {
      const { container } = renderTimeline({
        days: [makeDay({ entries: [] })],
      });
      const blocks = container.querySelectorAll('.time-block');
      expect(blocks.length).toBe(0);
    });
  });

  describe('day columns', () => {
    it('renders one day-column per day', () => {
      const { container } = renderTimeline({
        days: [
          makeDay({ dateStr: '2025-01-15' }),
          makeDay({ dateStr: '2025-01-16', date: new Date(2025, 0, 16), isToday: false }),
        ],
      });
      const columns = container.querySelectorAll('.day-column');
      expect(columns.length).toBe(2);
    });
  });

  describe('keyboard shortcuts', () => {
    it('Delete key removes selected entries', () => {
      const entry = makeEntry({ id: 'del-me', title: 'Delete me', startMinutes: 540, endMinutes: 600 });
      const { container, onEntriesChange } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      // Click the block to select it
      const block = container.querySelector('.time-block')!;
      fireEvent.mouseDown(block, { button: 0 });
      fireEvent.mouseUp(window);

      // Press Delete
      fireEvent.keyDown(window, { key: 'Delete' });

      // onEntriesChange should have been called with empty array (entry deleted)
      const deleteCalls = onEntriesChange.mock.calls.filter(
        (call: any[]) => call[0] === '2025-01-15' && call[1].length === 0
      );
      expect(deleteCalls.length).toBeGreaterThan(0);
    });

    it('Escape clears selection', () => {
      const entry = makeEntry({ id: 'esc', title: 'Select me', startMinutes: 540, endMinutes: 600 });
      const { container } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.mouseDown(block, { button: 0 });
      fireEvent.mouseUp(window);
      // Block should be selected
      expect(block.classList.contains('selected')).toBe(true);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(block.classList.contains('selected')).toBe(false);
    });
  });

  describe('context menu', () => {
    it('right-click on a block opens the color menu', () => {
      const entry = makeEntry({ id: 'ctx', title: 'Right-click me', startMinutes: 540, endMinutes: 600 });
      const { container } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.contextMenu(block, { clientX: 100, clientY: 200 });

      const colorMenu = container.querySelector('.color-menu');
      expect(colorMenu).toBeTruthy();
    });

    it('color menu shows "Send to Today" only for non-today days', () => {
      const entry = makeEntry({ id: 'send', title: 'Send me', startMinutes: 540, endMinutes: 600 });
      const { container } = renderTimeline({
        days: [makeDay({ dateStr: '2025-01-14', isToday: false, date: new Date(2025, 0, 14), entries: [entry] })],
        todayStr: '2025-01-15',
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.contextMenu(block, { clientX: 100, clientY: 200 });

      const sendBtn = container.querySelector('.color-menu-action');
      // There should be Duplicate and Send to Today
      const actions = container.querySelectorAll('.color-menu-action');
      const texts = Array.from(actions).map((a) => a.textContent);
      expect(texts).toContain('Send to Today');
    });

    it('color menu does not show "Send to Today" for today', () => {
      const entry = makeEntry({ id: 'stay', title: 'Stay here', startMinutes: 540, endMinutes: 600 });
      const { container } = renderTimeline({
        days: [makeDay({ dateStr: '2025-01-15', isToday: true, entries: [entry] })],
        todayStr: '2025-01-15',
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.contextMenu(block, { clientX: 100, clientY: 200 });

      const actions = container.querySelectorAll('.color-menu-action');
      const texts = Array.from(actions).map((a) => a.textContent);
      expect(texts).toContain('Duplicate');
      expect(texts).not.toContain('Send to Today');
    });

    it('duplicate creates a new entry via onEntriesChange', () => {
      const entry = makeEntry({ id: 'dup', title: 'Duplicate me', startMinutes: 540, endMinutes: 600 });
      const { container, onEntriesChange } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.contextMenu(block, { clientX: 100, clientY: 200 });

      // Click "Duplicate"
      const actions = container.querySelectorAll('.color-menu-action');
      const dupBtn = Array.from(actions).find((a) => a.textContent === 'Duplicate')!;
      fireEvent.click(dupBtn);

      // Should have been called with 2 entries (original + duplicate)
      const lastCall = onEntriesChange.mock.calls[onEntriesChange.mock.calls.length - 1];
      expect(lastCall[1].length).toBe(2);
      expect(lastCall[1][0].title).toBe('Duplicate me');
      expect(lastCall[1][1].title).toBe('Duplicate me');
      expect(lastCall[1][0].id).not.toBe(lastCall[1][1].id);
    });

    it('delete removes entry via onEntriesChange', () => {
      const entry = makeEntry({ id: 'del', title: 'Delete me', startMinutes: 540, endMinutes: 600 });
      const { container, onEntriesChange } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      const block = container.querySelector('.time-block')!;
      fireEvent.contextMenu(block, { clientX: 100, clientY: 200 });

      const deleteBtn = container.querySelector('.color-menu-delete')!;
      fireEvent.click(deleteBtn);

      const lastCall = onEntriesChange.mock.calls[onEntriesChange.mock.calls.length - 1];
      expect(lastCall[1].length).toBe(0);
    });
  });

  describe('toggle done', () => {
    it('clicking checkbox toggles the done state via onEntriesChange', () => {
      const entry = makeEntry({ id: 'done-test', title: 'Check me', startMinutes: 540, endMinutes: 600, done: false });
      const { container, onEntriesChange } = renderTimeline({
        days: [makeDay({ entries: [entry] })],
      });

      const checkbox = container.querySelector('.time-block-checkbox')!;
      fireEvent.click(checkbox);

      const lastCall = onEntriesChange.mock.calls[onEntriesChange.mock.calls.length - 1];
      expect(lastCall[1][0].done).toBe(true);
    });
  });

  describe('initial zoom', () => {
    it('sets timeline height based on calculated hourHeight', () => {
      const { container } = renderTimeline();
      const timeline = container.querySelector('.timeline') as HTMLElement;
      // Timeline should have a height set (TOTAL_HOURS * hourHeight)
      expect(timeline.style.height).toBeTruthy();
      // The height should be a pixel value
      expect(timeline.style.height).toMatch(/^\d+(\.\d+)?px$/);
    });
  });
});
