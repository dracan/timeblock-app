import { render, screen, fireEvent, act } from '@testing-library/react';
import App from './App';

// Mock Timeline to avoid its complex DOM/interaction logic
vi.mock('./components/Timeline', () => ({
  default: (props: any) => (
    <div data-testid="timeline" data-today-str={props.todayStr}>
      {props.days.map((d: any) => (
        <div key={d.dateStr} data-testid={`day-${d.dateStr}`} data-is-today={d.isToday}>
          {d.entries.length} entries
        </div>
      ))}
    </div>
  ),
}));

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set a fixed date: Wednesday Jan 15, 2025 at 10:00 AM
    vi.setSystemTime(new Date(2025, 0, 15, 10, 0, 0));
    // Ensure no electronAPI (use localStorage fallback)
    delete (window as any).electronAPI;
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders the day header with correct date', () => {
    render(<App />);
    // Default is 1-day view, should show "Wed, Jan 15"
    expect(screen.getByText(/Wed/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
  });

  it('prev button navigates to previous day', () => {
    render(<App />);
    const prevBtn = screen.getByTitle('Previous day');
    fireEvent.click(prevBtn);
    // Should now show Jan 14 (Tuesday)
    expect(screen.getByText(/Tue/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 14/)).toBeInTheDocument();
  });

  it('next button navigates to next day', () => {
    render(<App />);
    const nextBtn = screen.getByTitle('Next day');
    fireEvent.click(nextBtn);
    // Should now show Jan 16 (Thursday)
    expect(screen.getByText(/Thu/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
  });

  it('pressing 1-5 changes day count', () => {
    render(<App />);
    // Press "3" to switch to 3-day view
    fireEvent.keyDown(window, { key: '3' });
    // In multi-day mode, header shows range like "Jan 15 – Jan 17"
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 17/)).toBeInTheDocument();
    // dayCount is saved to localStorage
    expect(localStorage.getItem('dayCount')).toBe('3');
  });

  it('renders timeline component', () => {
    render(<App />);
    expect(screen.getByTestId('timeline')).toBeInTheDocument();
  });

  it('loads entries from localStorage on mount', async () => {
    // Pre-populate localStorage with markdown data for today
    const md = `# Wednesday, January 15, 2025\n\n## 09:00 - 10:00 | Morning Meeting\n- **Color:** #4a9eff\n- **ID:** test-1\n\n`;
    localStorage.setItem('day-2025-01-15', md);
    render(<App />);
    // Flush the async loadAll() promise chain inside the useEffect
    await act(async () => {});
    // The Timeline mock shows entry count
    expect(screen.getByText('1 entries')).toBeInTheDocument();
  });

  it('shows Today button when navigated away from today', () => {
    render(<App />);
    // Initially on today, no Today button
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    // Navigate to previous day
    fireEvent.click(screen.getByTitle('Previous day'));
    // Now Today button should appear
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('Today button returns to current date', () => {
    render(<App />);
    fireEvent.click(screen.getByTitle('Previous day'));
    fireEvent.click(screen.getByText('Today'));
    // Should be back on Jan 15
    expect(screen.getByText(/Wed/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
  });

  it('can navigate to future dates', () => {
    render(<App />);
    const nextBtn = screen.getByTitle('Next day');
    // Navigate two days into the future
    fireEvent.click(nextBtn);
    fireEvent.click(nextBtn);
    // Should show Jan 17 (Friday)
    expect(screen.getByText(/Fri/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 17/)).toBeInTheDocument();
    // Today button should appear since we're not on today
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows "Now Doing" panel when there is an active entry', async () => {
    // Pre-populate localStorage with an entry spanning 9:00-11:00 (current time is 10:00)
    const md = `# Wednesday, January 15, 2025\n\n## 09:00 - 11:00 | Deep Work\n- **Color:** #22c55e\n- **ID:** active-1\n\n`;
    localStorage.setItem('day-2025-01-15', md);
    render(<App />);
    await act(async () => {});

    const panel = document.querySelector('.now-panel');
    expect(panel).toBeTruthy();
    expect(screen.getByText('Deep Work')).toBeInTheDocument();
    // The accent bar should use the entry's color
    const accent = document.querySelector('.now-panel-accent') as HTMLElement;
    expect(accent.style.background).toBe('rgb(34, 197, 94)');
  });

  it('does not show "Now Doing" panel when no active entry', async () => {
    // Entry from 11:00-12:00 — current time is 10:00, so no active entry
    const md = `# Wednesday, January 15, 2025\n\n## 11:00 - 12:00 | Later Meeting\n- **Color:** #4a9eff\n- **ID:** later-1\n\n`;
    localStorage.setItem('day-2025-01-15', md);
    render(<App />);
    await act(async () => {});

    const panel = document.querySelector('.now-panel');
    expect(panel).toBeNull();
  });

  it('shows multi-day column headers when dayCount > 1', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '3' });
    // Column headers should appear for each day
    const headers = document.querySelectorAll('.day-column-header');
    expect(headers.length).toBe(3);
  });

  describe('midnight crossing', () => {
    it('auto-advances to new today when midnight passes while viewing today', async () => {
      // Mount at 23:59 on Jan 15
      vi.setSystemTime(new Date(2025, 0, 15, 23, 59, 0));
      render(<App />);
      await act(async () => {});

      // Should show Jan 15
      expect(screen.getByText(/Jan 15/)).toBeInTheDocument();
      expect(screen.getByTestId('day-2025-01-15').dataset.isToday).toBe('true');

      // Advance past midnight — advanceTimersByTime both fires the timeout
      // AND advances the fake clock so new Date() returns Jan 16
      await act(async () => {
        vi.advanceTimersByTime(60_100); // 1 minute + 100ms covers the midnight timeout
      });
      // Flush async state updates (loadAll triggered by todayStr change)
      await act(async () => {});

      // Should now show Jan 16 (Thursday) — auto-advanced
      expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
      expect(screen.getByTestId('day-2025-01-16').dataset.isToday).toBe('true');
    });

    it('does not auto-advance if user navigated to a different date', async () => {
      // Mount at 23:59 on Jan 15
      vi.setSystemTime(new Date(2025, 0, 15, 23, 59, 0));
      render(<App />);
      await act(async () => {});

      // Navigate to Jan 14 (a different date)
      fireEvent.click(screen.getByTitle('Previous day'));
      expect(screen.getByText(/Jan 14/)).toBeInTheDocument();

      // Advance past midnight
      await act(async () => {
        vi.advanceTimersByTime(60_100);
      });
      await act(async () => {});

      // Should still show Jan 14 — did NOT auto-advance
      expect(screen.getByText(/Jan 14/)).toBeInTheDocument();
    });

    it('Today button navigates to the real new today after midnight', async () => {
      // Mount at 23:59 on Jan 15
      vi.setSystemTime(new Date(2025, 0, 15, 23, 59, 0));
      render(<App />);
      await act(async () => {});

      // Navigate away so Today button appears
      fireEvent.click(screen.getByTitle('Previous day'));
      expect(screen.getByText('Today')).toBeInTheDocument();

      // Advance past midnight
      await act(async () => {
        vi.advanceTimersByTime(60_100);
      });
      await act(async () => {});

      // Click Today — should go to Jan 16, not stale Jan 15
      fireEvent.click(screen.getByText('Today'));
      await act(async () => {});
      expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
    });

    it('updates todayStr for widget after midnight', async () => {
      // Mount at 23:59 on Jan 15 with entries for both days
      vi.setSystemTime(new Date(2025, 0, 15, 23, 59, 0));
      const md15 = `# Wednesday, January 15, 2025\n\n## 23:00 - 23:59 | Night Task\n- **Color:** #4a9eff\n- **ID:** night-1\n\n`;
      const md16 = `# Thursday, January 16, 2025\n\n## 00:00 - 01:00 | Morning Task\n- **Color:** #22c55e\n- **ID:** morning-1\n\n`;
      localStorage.setItem('day-2025-01-15', md15);
      localStorage.setItem('day-2025-01-16', md16);
      render(<App />);
      await act(async () => {});

      // todayStr should be 2025-01-15
      expect(screen.getByTestId('timeline').dataset.todayStr).toBe('2025-01-15');

      // Advance past midnight
      await act(async () => {
        vi.advanceTimersByTime(60_100);
      });
      await act(async () => {});

      // todayStr should now be 2025-01-16
      expect(screen.getByTestId('timeline').dataset.todayStr).toBe('2025-01-16');
    });

    it('detects date change on window focus', async () => {
      // Mount at 23:00 on Jan 15
      vi.setSystemTime(new Date(2025, 0, 15, 23, 0, 0));
      render(<App />);
      await act(async () => {});

      expect(screen.getByTestId('timeline').dataset.todayStr).toBe('2025-01-15');

      // Simulate time jumping past midnight (e.g., laptop was sleeping)
      // then user focuses the window
      vi.setSystemTime(new Date(2025, 0, 16, 8, 0, 0));
      await act(async () => {
        window.dispatchEvent(new Event('focus'));
      });
      await act(async () => {});

      expect(screen.getByTestId('timeline').dataset.todayStr).toBe('2025-01-16');
      // Auto-advanced since user was on "today"
      expect(screen.getByText(/Jan 16/)).toBeInTheDocument();
    });
  });
});
