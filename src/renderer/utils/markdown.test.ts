import { entriesToMarkdown, markdownToEntries } from './markdown';
import { makeEntry } from '../../test/helpers';

// Fixed date for deterministic output: January 15, 2024 (Monday)
const TEST_DATE = new Date(2024, 0, 15);
const DATE_HEADER = '# Monday, January 15, 2024\n\n';

describe('entriesToMarkdown', () => {
  it('produces only the date header for an empty entries array', () => {
    const md = entriesToMarkdown([], TEST_DATE);
    expect(md).toBe(DATE_HEADER);
  });

  it('serializes a single entry with all fields', () => {
    const entry = makeEntry({
      id: 'abc123',
      title: 'Standup',
      startMinutes: 540,
      endMinutes: 570,
      color: '#ef4444',
      done: false,
    });
    const md = entriesToMarkdown([entry], TEST_DATE);
    expect(md).toContain('## 09:00 - 09:30 | Standup');
    expect(md).toContain('- **Color:** #ef4444');
    expect(md).toContain('- **ID:** abc123');
    expect(md).not.toContain('**Done:**');
  });

  it('includes the Done line when entry.done is true', () => {
    const entry = makeEntry({ done: true });
    const md = entriesToMarkdown([entry], TEST_DATE);
    expect(md).toContain('- **Done:** true');
  });

  it('sorts entries by startMinutes in the output', () => {
    const late = makeEntry({ title: 'Late', startMinutes: 900, endMinutes: 960 });
    const early = makeEntry({ title: 'Early', startMinutes: 360, endMinutes: 420 });
    const mid = makeEntry({ title: 'Mid', startMinutes: 720, endMinutes: 780 });

    // Pass in reverse order
    const md = entriesToMarkdown([late, mid, early], TEST_DATE);
    const earlyIdx = md.indexOf('Early');
    const midIdx = md.indexOf('Mid');
    const lateIdx = md.indexOf('Late');

    expect(earlyIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lateIdx);
  });
});

describe('markdownToEntries', () => {
  it('returns an empty array for an empty string', () => {
    const entries = markdownToEntries('');
    expect(entries).toEqual([]);
  });

  it('returns an empty array for random text with no H2 headings', () => {
    const entries = markdownToEntries('Hello world\nThis is just text.\nNo entries here.');
    expect(entries).toEqual([]);
  });

  it('returns an empty array for markdown with only the date header', () => {
    const entries = markdownToEntries(DATE_HEADER);
    expect(entries).toEqual([]);
  });

  it('parses a heading with no metadata lines using defaults', () => {
    const md = `# Some Day\n\n## 09:00 - 10:00 | My Task\n`;
    const entries = markdownToEntries(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('My Task');
    expect(entries[0].startMinutes).toBe(540);
    expect(entries[0].endMinutes).toBe(600);
    expect(entries[0].color).toBe('#4a9eff');
    expect(entries[0].done).toBe(false);
    // ID should be a generated string (non-empty)
    expect(entries[0].id).toBeTruthy();
    expect(typeof entries[0].id).toBe('string');
  });

  it('parses midnight (00:00) and end-of-day (23:59) times correctly', () => {
    const md = `## 00:00 - 23:59 | All Day\n- **Color:** #4a9eff\n- **ID:** allday1\n`;
    const entries = markdownToEntries(md);
    expect(entries).toHaveLength(1);
    expect(entries[0].startMinutes).toBe(0);
    expect(entries[0].endMinutes).toBe(1439);
  });
});

describe('roundtrip fidelity', () => {
  it('preserves all fields through serialize then deserialize', () => {
    const original = makeEntry({
      id: 'roundtrip-1',
      title: 'Deep Work',
      startMinutes: 600,
      endMinutes: 720,
      color: '#22c55e',
      done: false,
    });

    const md = entriesToMarkdown([original], TEST_DATE);
    const parsed = markdownToEntries(md);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(original.id);
    expect(parsed[0].title).toBe(original.title);
    expect(parsed[0].startMinutes).toBe(original.startMinutes);
    expect(parsed[0].endMinutes).toBe(original.endMinutes);
    expect(parsed[0].color).toBe(original.color);
    expect(parsed[0].done).toBe(false);
  });

  it('preserves the done flag through a roundtrip', () => {
    const original = makeEntry({
      id: 'done-rt',
      title: 'Completed Task',
      startMinutes: 480,
      endMinutes: 510,
      color: '#a855f7',
      done: true,
    });

    const md = entriesToMarkdown([original], TEST_DATE);
    const parsed = markdownToEntries(md);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].done).toBe(true);
  });

  it('roundtrips multiple entries and preserves sorted order', () => {
    const entries = [
      makeEntry({ id: 'c', title: 'Third', startMinutes: 840, endMinutes: 900, color: '#ef4444' }),
      makeEntry({ id: 'a', title: 'First', startMinutes: 480, endMinutes: 540, color: '#4a9eff' }),
      makeEntry({ id: 'b', title: 'Second', startMinutes: 660, endMinutes: 720, color: '#22c55e' }),
    ];

    const md = entriesToMarkdown(entries, TEST_DATE);
    const parsed = markdownToEntries(md);

    expect(parsed).toHaveLength(3);
    // Should come back sorted by startMinutes
    expect(parsed[0].id).toBe('a');
    expect(parsed[1].id).toBe('b');
    expect(parsed[2].id).toBe('c');
    expect(parsed[0].title).toBe('First');
    expect(parsed[1].title).toBe('Second');
    expect(parsed[2].title).toBe('Third');
  });
});

describe('metadata bleed prevention', () => {
  it('does not bleed color from entry B into entry A when A lacks color metadata', () => {
    // Manually construct markdown where entry A has no Color line
    const md = [
      '# Monday, January 15, 2024',
      '',
      '## 09:00 - 10:00 | Entry A',
      '- **ID:** id-a',
      '',
      '## 10:00 - 11:00 | Entry B',
      '- **Color:** #ef4444',
      '- **ID:** id-b',
      '',
    ].join('\n');

    const entries = markdownToEntries(md);
    expect(entries).toHaveLength(2);

    const entryA = entries.find(e => e.id === 'id-a')!;
    const entryB = entries.find(e => e.id === 'id-b')!;

    // Entry A should get the default color, NOT entry B's red
    expect(entryA.color).toBe('#4a9eff');
    expect(entryB.color).toBe('#ef4444');
  });
});

describe('titles with special characters', () => {
  it('roundtrips a title containing a pipe character', () => {
    const entry = makeEntry({
      id: 'pipe-title',
      title: 'Review | Feedback Session',
      startMinutes: 600,
      endMinutes: 660,
    });

    const md = entriesToMarkdown([entry], TEST_DATE);
    const parsed = markdownToEntries(md);

    expect(parsed).toHaveLength(1);
    // The regex uses (.+) which is greedy, so it captures everything after the first " | "
    // The title in markdown is "## 10:00 - 11:00 | Review | Feedback Session"
    // The regex captures "Review | Feedback Session"
    expect(parsed[0].title).toBe('Review | Feedback Session');
  });

  it('roundtrips a title with markdown bold and italic formatting', () => {
    const entry = makeEntry({
      id: 'md-title',
      title: 'Fix **critical** _bug_ in parser',
      startMinutes: 540,
      endMinutes: 570,
    });

    const md = entriesToMarkdown([entry], TEST_DATE);
    const parsed = markdownToEntries(md);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Fix **critical** _bug_ in parser');
  });
});

describe('time parsing edge cases', () => {
  it('handles midnight start (00:00) through roundtrip', () => {
    const entry = makeEntry({
      id: 'midnight',
      title: 'Midnight Task',
      startMinutes: 0,
      endMinutes: 60,
      color: '#f59e0b',
    });

    const md = entriesToMarkdown([entry], TEST_DATE);
    expect(md).toContain('## 00:00 - 01:00 | Midnight Task');

    const parsed = markdownToEntries(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].startMinutes).toBe(0);
    expect(parsed[0].endMinutes).toBe(60);
  });

  it('handles end-of-day time (23:45) through roundtrip', () => {
    const entry = makeEntry({
      id: 'late-night',
      title: 'Late Night',
      startMinutes: 1380,
      endMinutes: 1425,
      color: '#6366f1',
    });

    const md = entriesToMarkdown([entry], TEST_DATE);
    expect(md).toContain('## 23:00 - 23:45 | Late Night');

    const parsed = markdownToEntries(md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].startMinutes).toBe(1380);
    expect(parsed[0].endMinutes).toBe(1425);
  });
});
