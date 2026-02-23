import {
  DAY_START_HOUR,
  DAY_END_HOUR,
  TOTAL_HOURS,
  DEFAULT_HOUR_HEIGHT,
  getTotalHeight,
  minutesToPixels,
  pixelsToMinutes,
  snapToGrid,
  formatTime,
  formatTime24,
  formatDuration,
  formatCountdown,
  generateId,
} from './time';

// ---------------------------------------------------------------------------
// minutesToPixels
// ---------------------------------------------------------------------------
describe('minutesToPixels', () => {
  it('returns 0px for 6 AM (360 min) at default height', () => {
    expect(minutesToPixels(360)).toBe(0);
  });

  it('returns 1020px for 11 PM (1380 min) at default height 60', () => {
    // (1380 - 360) / 60 * 60 = 1020
    expect(minutesToPixels(1380)).toBe(1020);
  });

  it('works with a custom hourHeight of 120', () => {
    // 7 AM = 420 min => offset 60 min => (60/60)*120 = 120
    expect(minutesToPixels(420, 120)).toBe(120);
  });

  it('returns negative pixels for times before DAY_START_HOUR', () => {
    // 5 AM = 300 min => offset = -60 => (-60/60)*60 = -60
    expect(minutesToPixels(300)).toBe(-60);
  });
});

// ---------------------------------------------------------------------------
// pixelsToMinutes
// ---------------------------------------------------------------------------
describe('pixelsToMinutes', () => {
  it('returns 360 (6 AM) for 0px at default height', () => {
    expect(pixelsToMinutes(0)).toBe(360);
  });

  it('returns 1380 (11 PM) for 1020px at default height', () => {
    expect(pixelsToMinutes(1020)).toBe(1380);
  });

  it('works with a custom hourHeight of 120', () => {
    // 120px / 120 * 60 + 360 = 420 (7 AM)
    expect(pixelsToMinutes(120, 120)).toBe(420);
  });
});

// ---------------------------------------------------------------------------
// minutesToPixels / pixelsToMinutes roundtrip
// ---------------------------------------------------------------------------
describe('minutesToPixels <-> pixelsToMinutes roundtrip', () => {
  it('roundtrips at default hourHeight', () => {
    const minutes = 480; // 8 AM
    expect(pixelsToMinutes(minutesToPixels(minutes))).toBe(minutes);
  });

  it('roundtrips at custom hourHeight', () => {
    const minutes = 720; // noon
    const hourHeight = 90;
    expect(pixelsToMinutes(minutesToPixels(minutes, hourHeight), hourHeight)).toBe(minutes);
  });
});

// ---------------------------------------------------------------------------
// snapToGrid
// ---------------------------------------------------------------------------
describe('snapToGrid', () => {
  it('passes through on-grid value 0', () => {
    expect(snapToGrid(0)).toBe(0);
  });

  it('passes through on-grid value 15', () => {
    expect(snapToGrid(15)).toBe(15);
  });

  it('passes through on-grid value 30', () => {
    expect(snapToGrid(30)).toBe(30);
  });

  it('passes through on-grid value 60', () => {
    expect(snapToGrid(60)).toBe(60);
  });

  it('rounds down 7 to 0', () => {
    expect(snapToGrid(7)).toBe(0);
  });

  it('rounds down 22 to 15', () => {
    expect(snapToGrid(22)).toBe(15);
  });

  it('rounds up 8 to 15', () => {
    expect(snapToGrid(8)).toBe(15);
  });

  it('rounds up 23 to 30', () => {
    expect(snapToGrid(23)).toBe(30);
  });

  it('rounds 7.5 to 15 (Math.round tie-breaking)', () => {
    expect(snapToGrid(7.5)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// formatTime (12-hour)
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  it('formats midnight (0 min) as "12:00 AM"', () => {
    expect(formatTime(0)).toBe('12:00 AM');
  });

  it('formats noon (720 min) as "12:00 PM"', () => {
    expect(formatTime(720)).toBe('12:00 PM');
  });

  it('formats 1:00 PM (780 min) as "1:00 PM"', () => {
    expect(formatTime(780)).toBe('1:00 PM');
  });

  it('formats 11:59 PM (1439 min) as "11:59 PM"', () => {
    expect(formatTime(1439)).toBe('11:59 PM');
  });

  it('zero-pads minutes: 65 min → "1:05 AM"', () => {
    expect(formatTime(65)).toBe('1:05 AM');
  });
});

// ---------------------------------------------------------------------------
// formatTime24 (24-hour)
// ---------------------------------------------------------------------------
describe('formatTime24', () => {
  it('formats 0 as "00:00"', () => {
    expect(formatTime24(0)).toBe('00:00');
  });

  it('formats 720 as "12:00"', () => {
    expect(formatTime24(720)).toBe('12:00');
  });

  it('formats 615 as "10:15"', () => {
    expect(formatTime24(615)).toBe('10:15');
  });

  it('zero-pads hours and minutes: 5 min → "00:05"', () => {
    expect(formatTime24(5)).toBe('00:05');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
  it('formats 0 minutes as "0m"', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats 30 minutes as "30m"', () => {
    expect(formatDuration(30)).toBe('30m');
  });

  it('formats 60 minutes as "1h"', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('formats 90 minutes as "1h 30m"', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats 120 minutes as "2h"', () => {
    expect(formatDuration(120)).toBe('2h');
  });
});

// ---------------------------------------------------------------------------
// formatCountdown
// ---------------------------------------------------------------------------
describe('formatCountdown', () => {
  it('returns "0s left" for 0 seconds', () => {
    expect(formatCountdown(0)).toBe('0s left');
  });

  it('returns "0s left" for negative seconds', () => {
    expect(formatCountdown(-5)).toBe('0s left');
  });

  it('formats 30 seconds as "30s left"', () => {
    expect(formatCountdown(30)).toBe('30s left');
  });

  it('formats 59 seconds as "59s left"', () => {
    expect(formatCountdown(59)).toBe('59s left');
  });

  it('formats 60 seconds as "1m 0s left"', () => {
    expect(formatCountdown(60)).toBe('1m 0s left');
  });

  it('formats 90 seconds as "1m 30s left"', () => {
    expect(formatCountdown(90)).toBe('1m 30s left');
  });

  it('formats 754 seconds as "12m 34s left"', () => {
    expect(formatCountdown(754)).toBe('12m 34s left');
  });

  it('formats 3600 seconds (1 hour) as "1h 0m left"', () => {
    expect(formatCountdown(3600)).toBe('1h 0m left');
  });

  it('formats 8100 seconds (2h 15m) as "2h 15m left"', () => {
    expect(formatCountdown(8100)).toBe('2h 15m left');
  });
});

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('produces 100 unique values in 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getTotalHeight
// ---------------------------------------------------------------------------
describe('getTotalHeight', () => {
  it('returns TOTAL_HOURS * hourHeight', () => {
    expect(getTotalHeight(60)).toBe(TOTAL_HOURS * 60);
  });

  it('scales with custom hourHeight', () => {
    expect(getTotalHeight(120)).toBe(TOTAL_HOURS * 120);
  });
});
