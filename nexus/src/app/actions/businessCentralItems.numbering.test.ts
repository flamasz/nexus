// businessCentralItems.numbering.test.ts
import { describe, expect, it, vi } from 'vitest';
import { assignAndCreate } from './businessCentralItems';
import type { NumberAssigner, PreparedNumber } from '@/lib/businessCentral/numberAssigner';

function preparedStub(candidate: string): PreparedNumber {
  return { seriesCode: 'S', candidate, line: { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'e' } };
}

describe('assignAndCreate', () => {
  it('creates with the prepared number then commits the advance (create-then-advance)', async () => {
    const order: string[] = [];
    const assigner: NumberAssigner = {
      prepare: async () => { order.push('prepare'); return preparedStub('NX000006'); },
      bump: (p) => p,
      commit: async (_p, used) => { order.push('commit:' + used); },
    };
    const createInBc = vi.fn(async (num: string) => { order.push('create:' + num); return { number: num }; });
    const result = await assignAndCreate({ assigner, seriesCode: 'S', createInBc });
    expect(result.number).toBe('NX000006');
    expect(order).toEqual(['prepare', 'create:NX000006', 'commit:NX000006']);
  });

  it('does NOT commit when BC create fails (no number burned)', async () => {
    const commit = vi.fn();
    const assigner: NumberAssigner = { prepare: async () => preparedStub('NX000006'), bump: (p) => p, commit };
    const createInBc = vi.fn(async () => { throw new Error('BC down'); });
    await expect(assignAndCreate({ assigner, seriesCode: 'S', createInBc })).rejects.toThrow('BC down');
    expect(commit).not.toHaveBeenCalled();
  });

  it('bumps and retries on a duplicate-number create error', async () => {
    const isDuplicate = () => true;
    const assigner: NumberAssigner = {
      prepare: async () => preparedStub('NX000006'),
      bump: (p) => ({ ...p, candidate: 'NX000007' }),
      commit: async () => {},
    };
    const createInBc = vi.fn()
      .mockImplementationOnce(async () => { const e = new Error('exists'); (e as unknown as Record<string, unknown>).duplicate = true; throw e; })
      .mockImplementationOnce(async (num: string) => ({ number: num }));
    const result = await assignAndCreate({ assigner, seriesCode: 'S', createInBc, isDuplicate });
    expect(result.number).toBe('NX000007');
    expect(createInBc).toHaveBeenCalledTimes(2);
  });
});
