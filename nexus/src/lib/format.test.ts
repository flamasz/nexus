import { afterEach, describe, expect, it } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("renders a date-only YYYY-MM-DD value as the same calendar date in a negative-UTC-offset zone", () => {
    // Pacific/Honolulu is UTC-10 with no DST. Against the pre-fix
    // implementation (`new Date(value).toLocaleDateString()`), "2026-07-24"
    // parses as 2026-07-24T00:00:00Z, which is 2026-07-23 14:00 in Honolulu —
    // one calendar day early. This test fails against that implementation.
    process.env.TZ = "Pacific/Honolulu";
    expect(formatDate("2026-07-24")).toBe("7/24/2026");
  });

  it("renders the same date-only value identically in a positive-UTC-offset zone", () => {
    process.env.TZ = "Pacific/Auckland";
    expect(formatDate("2026-07-24")).toBe("7/24/2026");
  });

  it("renders the same date-only value identically in UTC", () => {
    process.env.TZ = "UTC";
    expect(formatDate("2026-07-24")).toBe("7/24/2026");
  });

  it("returns the placeholder for a null value", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("still applies local time-zone conversion for a full ISO timestamp", () => {
    // A timestamp WITH a time component carries real time-zone meaning and
    // must continue to render in the viewer's local zone, not be frozen to
    // UTC like a bare date.
    process.env.TZ = "Pacific/Honolulu";
    // 2026-07-24T05:00:00Z is 2026-07-23 19:00 in Honolulu (UTC-10).
    expect(formatDate("2026-07-24T05:00:00Z")).toBe("7/23/2026");

    process.env.TZ = "UTC";
    expect(formatDate("2026-07-24T05:00:00Z")).toBe("7/24/2026");
  });
});
