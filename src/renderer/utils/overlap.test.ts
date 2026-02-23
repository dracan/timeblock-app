import { computeOverlapLayout } from './overlap';
import { makeEntry } from '../../test/helpers';

describe('computeOverlapLayout', () => {
  it('returns an empty map for empty input', () => {
    const result = computeOverlapLayout([]);
    expect(result.size).toBe(0);
  });

  it('assigns a single entry to column 0 with totalColumns 1', () => {
    const entry = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const result = computeOverlapLayout([entry]);

    expect(result.size).toBe(1);
    expect(result.get(entry.id)).toEqual({ columnIndex: 0, totalColumns: 1 });
  });

  it('treats two non-overlapping entries (A ends exactly when B starts) as separate groups', () => {
    const a = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const b = makeEntry({ startMinutes: 600, endMinutes: 660 });
    const result = computeOverlapLayout([a, b]);

    expect(result.size).toBe(2);
    expect(result.get(a.id)).toEqual({ columnIndex: 0, totalColumns: 1 });
    expect(result.get(b.id)).toEqual({ columnIndex: 0, totalColumns: 1 });
  });

  it('places two overlapping entries in 2 columns', () => {
    const a = makeEntry({ startMinutes: 540, endMinutes: 630 });
    const b = makeEntry({ startMinutes: 570, endMinutes: 660 });
    const result = computeOverlapLayout([a, b]);

    expect(result.size).toBe(2);
    expect(result.get(a.id)).toEqual({ columnIndex: 0, totalColumns: 2 });
    expect(result.get(b.id)).toEqual({ columnIndex: 1, totalColumns: 2 });
  });

  it('places three mutually overlapping entries in 3 columns', () => {
    const a = makeEntry({ startMinutes: 540, endMinutes: 660 });
    const b = makeEntry({ startMinutes: 570, endMinutes: 690 });
    const c = makeEntry({ startMinutes: 600, endMinutes: 720 });
    const result = computeOverlapLayout([a, b, c]);

    expect(result.size).toBe(3);

    const colA = result.get(a.id)!;
    const colB = result.get(b.id)!;
    const colC = result.get(c.id)!;

    // All should be in a group with 3 columns
    expect(colA.totalColumns).toBe(3);
    expect(colB.totalColumns).toBe(3);
    expect(colC.totalColumns).toBe(3);

    // All should have unique column indices
    const indices = new Set([colA.columnIndex, colB.columnIndex, colC.columnIndex]);
    expect(indices.size).toBe(3);
  });

  it('handles chain overlap where C reuses column 0 from A', () => {
    // A: 9:00-10:00, B: 9:30-11:00, C: 10:00-11:30
    // A overlaps B, B overlaps C, but A does NOT overlap C (A ends at 600, C starts at 600)
    // However, they all end up in the same group because the sweep-line extends groupEnd.
    // Within the group, C can reuse A's column because A ends at 600 and C starts at 600.
    const a = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const b = makeEntry({ startMinutes: 570, endMinutes: 660 });
    const c = makeEntry({ startMinutes: 600, endMinutes: 690 });
    const result = computeOverlapLayout([a, b, c]);

    expect(result.size).toBe(3);

    const colA = result.get(a.id)!;
    const colB = result.get(b.id)!;
    const colC = result.get(c.id)!;

    // All in the same group because B bridges A and C
    expect(colA.totalColumns).toBe(2);
    expect(colB.totalColumns).toBe(2);
    expect(colC.totalColumns).toBe(2);

    // A gets column 0, B gets column 1, C reuses column 0 (A ended at 600, C starts at 600)
    expect(colA.columnIndex).toBe(0);
    expect(colB.columnIndex).toBe(1);
    expect(colC.columnIndex).toBe(0);
  });

  it('places a fully nested entry (B inside A) in 2 columns', () => {
    const a = makeEntry({ startMinutes: 480, endMinutes: 720 });
    const b = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const result = computeOverlapLayout([a, b]);

    expect(result.size).toBe(2);

    const colA = result.get(a.id)!;
    const colB = result.get(b.id)!;

    expect(colA.totalColumns).toBe(2);
    expect(colB.totalColumns).toBe(2);
    expect(colA.columnIndex).toBe(0);
    expect(colB.columnIndex).toBe(1);
  });

  it('gives column 0 to the longer entry when two start at the same time', () => {
    // Same startMinutes, but different durations. The sort tiebreaker puts longer first.
    const longer = makeEntry({ startMinutes: 540, endMinutes: 720 }); // 3 hours
    const shorter = makeEntry({ startMinutes: 540, endMinutes: 600 }); // 1 hour

    // Pass shorter first to ensure the sort (not insertion order) determines column assignment
    const result = computeOverlapLayout([shorter, longer]);

    expect(result.size).toBe(2);

    const colLonger = result.get(longer.id)!;
    const colShorter = result.get(shorter.id)!;

    expect(colLonger.columnIndex).toBe(0);
    expect(colShorter.columnIndex).toBe(1);
    expect(colLonger.totalColumns).toBe(2);
    expect(colShorter.totalColumns).toBe(2);
  });

  it('assigns 5 simultaneous entries to 5 unique columns', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ startMinutes: 540, endMinutes: 600, id: `sim-${i}` })
    );
    const result = computeOverlapLayout(entries);

    expect(result.size).toBe(5);

    const indices = new Set<number>();
    for (const entry of entries) {
      const info = result.get(entry.id)!;
      expect(info.totalColumns).toBe(5);
      indices.add(info.columnIndex);
    }

    // All 5 should have unique column indices 0-4
    expect(indices.size).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(indices.has(i)).toBe(true);
    }
  });

  it('handles mixed groups with overlapping and non-overlapping entries independently', () => {
    // Group 1: two overlapping entries (9:00-10:00 and 9:30-10:30)
    const g1a = makeEntry({ startMinutes: 540, endMinutes: 600 });
    const g1b = makeEntry({ startMinutes: 570, endMinutes: 630 });

    // Group 2: single entry (12:00-13:00), well separated
    const g2a = makeEntry({ startMinutes: 720, endMinutes: 780 });

    // Group 3: three overlapping entries (14:00-15:00, 14:15-15:15, 14:30-15:30)
    const g3a = makeEntry({ startMinutes: 840, endMinutes: 900 });
    const g3b = makeEntry({ startMinutes: 855, endMinutes: 915 });
    const g3c = makeEntry({ startMinutes: 870, endMinutes: 930 });

    // Pass in shuffled order to test sorting
    const result = computeOverlapLayout([g3b, g1a, g2a, g3c, g1b, g3a]);

    expect(result.size).toBe(6);

    // Group 1: 2 columns
    expect(result.get(g1a.id)!.totalColumns).toBe(2);
    expect(result.get(g1b.id)!.totalColumns).toBe(2);
    expect(result.get(g1a.id)!.columnIndex).toBe(0);
    expect(result.get(g1b.id)!.columnIndex).toBe(1);

    // Group 2: 1 column
    expect(result.get(g2a.id)).toEqual({ columnIndex: 0, totalColumns: 1 });

    // Group 3: 3 columns
    expect(result.get(g3a.id)!.totalColumns).toBe(3);
    expect(result.get(g3b.id)!.totalColumns).toBe(3);
    expect(result.get(g3c.id)!.totalColumns).toBe(3);

    const g3Indices = new Set([
      result.get(g3a.id)!.columnIndex,
      result.get(g3b.id)!.columnIndex,
      result.get(g3c.id)!.columnIndex,
    ]);
    expect(g3Indices.size).toBe(3);
  });
});
