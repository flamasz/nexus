export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export const AGING_BUCKETS: readonly AgingBucket[] = [
  'current',
  '1-30',
  '31-60',
  '61-90',
  '90+',
] as const;

/**
 * The current date in the Business Central environment's time zone, as YYYY-MM-DD.
 *
 * Aging must not use the server clock: an invoice due today in Pacific/Honolulu
 * would otherwise read as one day overdue on a UTC server. Mirrors the formatting
 * already used for No. Series date stamping in businessCentralItems.ts.
 */
export function todayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  const zone = timeZone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now);
  }
}

/**
 * Bucket an entry by how many days past its due date it is.
 * Boundaries land in the lower bucket: 30 days is "1-30", 31 is "31-60".
 */
export function agingBucket(daysOverdue: number | null): AgingBucket {
  if (daysOverdue === null || daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}
