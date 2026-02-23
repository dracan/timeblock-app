import { render, screen, act } from '@testing-library/react';
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
});
