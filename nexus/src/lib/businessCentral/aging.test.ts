import { describe, expect, it } from 'vitest';
import { AGING_BUCKETS, agingBucket, todayInTimeZone } from './aging';

describe('todayInTimeZone', () => {
  it('returns the local date for the given time zone', () => {
    // 2026-03-04T05:00:00Z is still 2026-03-03 in Honolulu (UTC-10).
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone('Pacific/Honolulu', now)).toBe('2026-03-03');
    expect(todayInTimeZone('UTC', now)).toBe('2026-03-04');
  });

  it('falls back to UTC when no time zone is configured', () => {
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone(null, now)).toBe('2026-03-04');
    expect(todayInTimeZone(undefined, now)).toBe('2026-03-04');
  });

  it('falls back to UTC when the time zone is invalid', () => {
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone('Not/AZone', now)).toBe('2026-03-04');
  });
});

describe('agingBucket', () => {
  it('treats not-yet-due and due-today entries as current', () => {
    expect(agingBucket(-5)).toBe('current');
    expect(agingBucket(0)).toBe('current');
  });

  it('places each boundary in the lower bucket', () => {
    expect(agingBucket(1)).toBe('1-30');
    expect(agingBucket(30)).toBe('1-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(60)).toBe('31-60');
    expect(agingBucket(61)).toBe('61-90');
    expect(agingBucket(90)).toBe('61-90');
    expect(agingBucket(91)).toBe('90+');
  });

  it('treats a missing due date as current', () => {
    expect(agingBucket(null)).toBe('current');
  });

  it('exposes buckets in display order', () => {
    expect(AGING_BUCKETS).toEqual(['current', '1-30', '31-60', '61-90', '90+']);
  });
});
