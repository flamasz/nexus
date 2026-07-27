import { describe, expect, it } from 'vitest';
import { summarizeAging, type AgingRow } from './agingSummary';

function row(partial: Partial<AgingRow>): AgingRow {
  return {
    id: 'r1',
    customer_no: 'C00010',
    document_no: 'PS-INV-1',
    document_type: 'Invoice',
    posting_date: '2026-01-01',
    due_date: '2026-02-01',
    currency_code: 'USD',
    remaining_amount: 100,
    days_overdue: 0,
    as_of_date: '2026-03-04',
    ...partial,
  };
}

describe('summarizeAging', () => {
  it('totals each bucket', () => {
    const summary = summarizeAging([
      row({ id: 'a', days_overdue: 0, remaining_amount: 100 }),
      row({ id: 'b', days_overdue: 10, remaining_amount: 200 }),
      row({ id: 'c', days_overdue: 45, remaining_amount: 300 }),
      row({ id: 'd', days_overdue: 120, remaining_amount: 400 }),
    ]);

    expect(summary.buckets.current).toEqual({ count: 1, total: 100 });
    expect(summary.buckets['1-30']).toEqual({ count: 1, total: 200 });
    expect(summary.buckets['31-60']).toEqual({ count: 1, total: 300 });
    expect(summary.buckets['61-90']).toEqual({ count: 0, total: 0 });
    expect(summary.buckets['90+']).toEqual({ count: 1, total: 400 });
    expect(summary.total).toBe(1000);
  });

  it('treats a null remaining amount as zero', () => {
    const summary = summarizeAging([row({ remaining_amount: null })]);
    expect(summary.buckets.current.total).toBe(0);
    expect(summary.buckets.current.count).toBe(1);
  });

  it('returns zeroed buckets for no rows', () => {
    const summary = summarizeAging([]);
    expect(summary.total).toBe(0);
    expect(summary.buckets['90+']).toEqual({ count: 0, total: 0 });
  });
});
