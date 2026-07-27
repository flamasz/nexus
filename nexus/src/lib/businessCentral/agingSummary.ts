import { AGING_BUCKETS, agingBucket, type AgingBucket } from './aging';

export interface AgingRow {
  id: string;
  customer_no: string;
  document_no: string | null;
  document_type: string | null;
  posting_date: string | null;
  due_date: string | null;
  currency_code: string | null;
  remaining_amount: number | null;
  days_overdue: number | null;
  as_of_date: string;
}

export interface AgingSummary {
  buckets: Record<AgingBucket, { count: number; total: number }>;
  total: number;
}

export function summarizeAging(rows: AgingRow[]): AgingSummary {
  const buckets = Object.fromEntries(
    AGING_BUCKETS.map((bucket) => [bucket, { count: 0, total: 0 }])
  ) as Record<AgingBucket, { count: number; total: number }>;

  let total = 0;

  for (const row of rows) {
    const bucket = agingBucket(row.days_overdue);
    const amount = row.remaining_amount ?? 0;
    buckets[bucket].count += 1;
    buckets[bucket].total += amount;
    total += amount;
  }

  return { buckets, total };
}
