const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    // Postgres `date` columns arrive as bare `YYYY-MM-DD` strings. JavaScript's
    // `Date` constructor parses those as UTC midnight, so formatting with the
    // viewer's local time zone would shift the displayed calendar date by one
    // day in any negative-UTC-offset zone. Treat a date-only value as a pure
    // calendar date by formatting in UTC — no time-zone conversion.
    if (DATE_ONLY_PATTERN.test(value)) {
      return new Date(value).toLocaleDateString("en-US", { timeZone: "UTC" });
    }
    // Full timestamps (with a time component) DO carry real time-zone meaning,
    // so those still render in the viewer's local zone as before.
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export function formatMoney(value: number | null, currencyCode: string | null): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}
