import { describe, expect, it, vi } from 'vitest';
import { createBcNoSeriesAssigner, SeriesNotNormalError, SeriesExhaustedError, SeriesNotFoundError } from './numberAssigner';
import { NoSeriesConflictError, type BcNoSeriesLine, type NoSeriesClient } from './noSeriesClient';

function line(over: Partial<BcNoSeriesLine> = {}): BcNoSeriesLine {
  return { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '0001-01-01', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'W/"abc"', ...over };
}

describe('prepare', () => {
  it('computes the next candidate from Last_No_Used', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine: vi.fn() };
    const prepared = await createBcNoSeriesAssigner(ns).prepare('S');
    expect(prepared.candidate).toBe('NX000006');
  });
  it('starts from Starting_No when Last_No_Used is empty', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: '' }), advanceLine: vi.fn() };
    expect((await createBcNoSeriesAssigner(ns).prepare('S')).candidate).toBe('NX000001');
  });
  it('throws SeriesNotFoundError when there is no line', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => null, advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesNotFoundError);
  });
  it('throws SeriesNotNormalError for Sequence series', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ implementation: 'Sequence' }), advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesNotNormalError);
  });
  it('throws SeriesExhaustedError when candidate exceeds Ending_No', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: 'NX999999' }), advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesExhaustedError);
  });
});

describe('bump', () => {
  it('advances the candidate by the increment', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine: vi.fn() };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S');
    expect(a.bump(p).candidate).toBe('NX000007');
  });
});

describe('commit', () => {
  it('advances only forward and stamps the date', async () => {
    const advanceLine = vi.fn(async () => line());
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S');
    await a.commit(p, 'NX000006', '2026-06-26');
    expect(advanceLine).toHaveBeenCalledWith(p.line, 'NX000006', '2026-06-26');
  });
  it('on conflict, re-reads and re-applies advance-only', async () => {
    const advanceLine = vi.fn()
      .mockRejectedValueOnce(new NoSeriesConflictError())
      .mockResolvedValueOnce(line({ lastNoUsed: 'NX000008' }));
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: 'NX000007', etag: 'W/"new"' }), advanceLine };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S'); // candidate NX000006
    await a.commit(p, 'NX000006', '2026-06-26');
    // second call uses the re-read line; never lowers below current NX000007
    const secondArgs = advanceLine.mock.calls[1];
    expect((secondArgs[0] as BcNoSeriesLine).lastNoUsed).toBe('NX000007');
    expect(secondArgs[1]).toBe('NX000007'); // keeps the higher existing value
  });
});
