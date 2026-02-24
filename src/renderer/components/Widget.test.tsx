import { render, screen, act, fireEvent } from '@testing-library/react';
import Widget from './Widget';
import { makeEntry } from '../../test/helpers';
import { WidgetData } from '../types';

// Capture the callback registered via onActiveEntryUpdate
let activeEntryCallback: ((data: WidgetData) => void) | null = null;

function mockElectronAPI() {
  (window as any).electronAPI = {
    onActiveEntryUpdate: vi.fn((cb: (data: WidgetData) => void) => {
      activeEntryCallback = cb;
      return () => { activeEntryCallback = null; };
    }),
    focusMainWindow: vi.fn(),
    widgetDragStart: vi.fn(),
    widgetDragMove: vi.fn(),
    widgetDragEnd: vi.fn(),
  };
}

function sendEntry(active: ReturnType<typeof makeEntry> | null, next: ReturnType<typeof makeEntry> | null = null) {
  act(() => {
    activeEntryCallback?.({ active, next });
  });
}

describe('Widget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default: set system time to 9:30 AM so entries from 9:00-10:00 are active
    vi.setSystemTime(new Date(2024, 0, 15, 9, 30, 0));
    activeEntryCallback = null;
    mockElectronAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as any).electronAPI;
  });

  it('shows "No active block" when no entry is set', () => {
    render(<Widget />);
    expect(screen.getByText('No active block')).toBeInTheDocument();
  });

  it('shows entry title when active entry is set', () => {
    render(<Widget />);
    const entry = makeEntry({ title: 'Focus time', startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    expect(screen.getByText('Focus time')).toBeInTheDocument();
  });

  it('shows time range for active entry', () => {
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    // formatTime(540) = "9:00 AM", formatTime(600) = "10:00 AM"
    expect(screen.getByText(/9:00 AM/)).toBeInTheDocument();
    expect(screen.getByText(/10:00 AM/)).toBeInTheDocument();
  });

  it('shows next entry preview when provided', () => {
    render(<Widget />);
    const active = makeEntry({ title: 'Current', startMinutes: 540, endMinutes: 600 });
    const next = makeEntry({ title: 'Upcoming', startMinutes: 600, endMinutes: 660 });
    sendEntry(active, next);
    expect(screen.getByText(/Next: Upcoming/)).toBeInTheDocument();
  });

  it('shows next entry even when no active entry', () => {
    render(<Widget />);
    const next = makeEntry({ title: 'Later', startMinutes: 720, endMinutes: 780 });
    sendEntry(null, next);
    expect(screen.getByText('No active block')).toBeInTheDocument();
    expect(screen.getByText(/Next: Later/)).toBeInTheDocument();
  });

  it('shows countdown text', () => {
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    // Remaining = 600*60 - (9*3600 + 30*60 + 0) = 36000 - 34200 = 1800 seconds = 30m 0s
    expect(screen.getByText('30m 0s left')).toBeInTheDocument();
  });

  it('countdown ticks down each second', () => {
    vi.setSystemTime(new Date(2024, 0, 15, 9, 59, 0));
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    // Remaining = 600*60 - (9*3600 + 59*60) = 36000 - 35940 = 60 seconds
    expect(screen.getByText('1m 0s left')).toBeInTheDocument();

    // Advance 1 second — clock moves to 9:59:01, remaining becomes 59
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('59s left')).toBeInTheDocument();
  });

  it('shows "Untitled" for entry with empty title', () => {
    render(<Widget />);
    const entry = makeEntry({ title: '', startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('clears entry when countdown reaches 0 with no next entry', () => {
    // Set time to 9:59:59 — 1 second before entry ends
    vi.setSystemTime(new Date(2024, 0, 15, 9, 59, 59));
    render(<Widget />);
    const entry = makeEntry({ title: 'Almost done', startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);
    expect(screen.getByText('Almost done')).toBeInTheDocument();

    // Advance 1 second — time becomes 10:00:00, remaining <= 0
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('No active block')).toBeInTheDocument();
  });

  it('transitions to next entry when countdown reaches 0', () => {
    // Set time to 9:59:59 — 1 second before entry ends
    vi.setSystemTime(new Date(2024, 0, 15, 9, 59, 59));
    render(<Widget />);
    const active = makeEntry({ title: 'Current task', startMinutes: 540, endMinutes: 600 });
    const next = makeEntry({ title: 'Next task', startMinutes: 600, endMinutes: 660 });
    sendEntry(active, next);
    expect(screen.getByText('Current task')).toBeInTheDocument();

    // Advance 1 second — remaining <= 0, next entry starts at 600 min (10:00 AM = 36000s)
    // nowSeconds = 10*3600 = 36000, nextEntry.startMinutes*60 = 36000, so 36000 <= 36000 is true
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Next task')).toBeInTheDocument();
    expect(screen.queryByText('Current task')).not.toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    render(<Widget />);
    // 9:30 AM — entry from 9:00-10:00 has 30 min remaining out of 60 min total = 50%
    const entry = makeEntry({ title: 'With progress', startMinutes: 540, endMinutes: 600, color: '#4a9eff' });
    sendEntry(entry);

    const widget = document.querySelector('.widget');
    const progressBar = widget?.querySelector('.widget-progress') as HTMLElement;
    expect(progressBar).toBeTruthy();
    expect(progressBar.style.background).toBe('rgb(74, 158, 255)');
    // 1800 remaining / 3600 total * 100 = 50%
    expect(progressBar.style.width).toBe('50%');
  });

  it('progress bar shrinks as time passes', () => {
    vi.setSystemTime(new Date(2024, 0, 15, 9, 45, 0));
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600, color: '#4a9eff' });
    sendEntry(entry);

    const progressBar = document.querySelector('.widget-progress') as HTMLElement;
    // 15 min remaining out of 60 total = 25%
    expect(progressBar.style.width).toBe('25%');
  });

  it('applies widget-flash class when entry changes', () => {
    render(<Widget />);
    const first = makeEntry({ id: 'entry-1', title: 'First', startMinutes: 540, endMinutes: 600 });
    sendEntry(first);
    const widget = document.querySelector('.widget')!;
    // First entry — no flash (prevEntryId was null)
    expect(widget.classList.contains('widget-flash')).toBe(false);

    // Switch to a different entry
    const second = makeEntry({ id: 'entry-2', title: 'Second', startMinutes: 540, endMinutes: 600 });
    sendEntry(second);
    expect(widget.classList.contains('widget-flash')).toBe(true);

    // Flash clears after 4000ms
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(widget.classList.contains('widget-flash')).toBe(false);
  });

  it('does not flash when entry id stays the same', () => {
    render(<Widget />);
    const entry = makeEntry({ id: 'same-id', title: 'First', startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);

    // Re-send the same entry (e.g. title updated)
    const updated = makeEntry({ id: 'same-id', title: 'Updated', startMinutes: 540, endMinutes: 600 });
    sendEntry(updated);

    const widget = document.querySelector('.widget')!;
    expect(widget.classList.contains('widget-flash')).toBe(false);
  });

  it('click without drag calls focusMainWindow', () => {
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);

    const widget = document.querySelector('.widget')!;
    // Simulate mousedown then immediate mouseup (no movement = click)
    fireEvent.mouseDown(widget, { button: 0, screenX: 100, screenY: 100 });
    fireEvent.mouseUp(document);

    expect((window as any).electronAPI.focusMainWindow).toHaveBeenCalled();
  });

  it('drag beyond threshold does not call focusMainWindow', () => {
    render(<Widget />);
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    sendEntry(entry);

    const widget = document.querySelector('.widget')!;
    fireEvent.mouseDown(widget, { button: 0, screenX: 100, screenY: 100 });
    // Move beyond 4px threshold
    fireEvent.mouseMove(document, { screenX: 110, screenY: 100 });
    fireEvent.mouseUp(document);

    expect((window as any).electronAPI.focusMainWindow).not.toHaveBeenCalled();
    expect((window as any).electronAPI.widgetDragMove).toHaveBeenCalled();
  });
});
