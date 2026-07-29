import { describe, expect, it, vi } from 'vitest';
import { normalizeSeriesCode, validateSeriesCode } from './noSeriesValidation';
import { SeriesNotFoundError, SeriesNotNormalError } from './numberAssigner';
import type { BcNoSeriesLine, NoSeriesClient } from './noSeriesClient';

function line(overrides: Partial<BcNoSeriesLine> = {}): BcNoSeriesLine {
  return {
    seriesCode: 'NEXUS-TEST',
    lineNo: 10000,
    startingNo: 'NX000001',
    endingNo: 'NX999999',
    lastNoUsed: 'NX000004',
    lastDateUsed: '2026-07-29',
    incrementByNo: 1,
    implementation: 'Normal',
    open: true,
    etag: 'W/"e"',
    ...overrides,
  };
}

function fakeClient(result: BcNoSeriesLine | null): NoSeriesClient {
  return {
    getOpenLine: vi.fn(async () => result),
    advanceLine: vi.fn(),
  } as unknown as NoSeriesClient;
}

describe('normalizeSeriesCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeSeriesCode('  nexus-test  ')).toBe('NEXUS-TEST');
  });

  it('treats blank and whitespace-only as null (manual numbering)', () => {
    expect(normalizeSeriesCode('')).toBeNull();
    expect(normalizeSeriesCode('   ')).toBeNull();
    expect(normalizeSeriesCode(null)).toBeNull();
    expect(normalizeSeriesCode(undefined)).toBeNull();
  });
});

describe('validateSeriesCode', () => {
  it('returns null for a blank code without calling BC', async () => {
    const client = fakeClient(null);
    await expect(validateSeriesCode(client, '')).resolves.toBeNull();
    expect(client.getOpenLine).not.toHaveBeenCalled();
  });

  it('accepts a Normal series and returns the normalized code', async () => {
    const client = fakeClient(line());
    await expect(validateSeriesCode(client, ' nexus-test ')).resolves.toBe('NEXUS-TEST');
    expect(client.getOpenLine).toHaveBeenCalledWith('NEXUS-TEST');
  });

  it('rejects a code BC does not know', async () => {
    const client = fakeClient(null);
    await expect(validateSeriesCode(client, 'NOPE')).rejects.toBeInstanceOf(SeriesNotFoundError);
  });

  it('rejects a series that allows gaps, naming the requirement', async () => {
    const client = fakeClient(line({ implementation: 'Sequence' }));
    await expect(validateSeriesCode(client, 'NEXUS-TEST')).rejects.toBeInstanceOf(
      SeriesNotNormalError
    );
    await expect(validateSeriesCode(client, 'NEXUS-TEST')).rejects.toThrow(/Allow Gaps/);
  });
});
