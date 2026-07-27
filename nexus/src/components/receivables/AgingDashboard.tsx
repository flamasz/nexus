"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AGING_BUCKETS, type AgingBucket } from "@/lib/businessCentral/aging";
import type { AgingRow } from "@/lib/businessCentral/agingSummary";
import { summarizeAging } from "@/lib/businessCentral/agingSummary";
import { formatDate, formatMoney } from "@/lib/format";

interface AgingDashboardProps {
  rows: AgingRow[];
  asOfDate: string | null;
}

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

type SortKey = "remaining_amount" | "days_overdue";

function compareRows(a: AgingRow, b: AgingRow, sortKey: SortKey): number {
  if (sortKey === "days_overdue") {
    return (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
  }
  return (b.remaining_amount ?? 0) - (a.remaining_amount ?? 0);
}

export function AgingDashboard({ rows, asOfDate }: AgingDashboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("days_overdue");

  const summary = useMemo(() => summarizeAging(rows), [rows]);
  const sorted = useMemo(
    () => [...rows].sort((a, b) => compareRows(a, b, sortKey)),
    [rows, sortKey]
  );

  const singleCurrency =
    summary.currencyCodes.length === 1 ? summary.currencyCodes[0] : null;
  const isMixedCurrency = summary.currencyCodes.length > 1;

  const formatAggregate = (value: number): string => {
    if (isMixedCurrency) {
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(value);
    }
    return formatMoney(value, singleCurrency);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Receivables aging
          </h1>
          <p className="mt-1 text-xs text-foreground-subtle">
            {asOfDate
              ? `As of ${asOfDate} (Business Central environment time zone)`
              : "No aging data available yet"}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-4">
        <div className="space-y-4">
          {isMixedCurrency && (
            <div className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-xs text-foreground-muted">
              These totals span multiple currencies (
              {summary.currencyCodes.join(", ")}) and are shown as plain
              numbers, not currency-converted.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-surface-raised p-4 card-shadow">
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                Total outstanding
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {formatAggregate(summary.total)}
              </p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {rows.length} open entr{rows.length === 1 ? "y" : "ies"}
              </p>
            </div>
            {AGING_BUCKETS.map((bucket) => (
              <div
                key={bucket}
                className="rounded-xl border border-border bg-surface-raised p-4 card-shadow"
              >
                <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">
                  {BUCKET_LABELS[bucket]}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatAggregate(summary.buckets[bucket].total)}
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  {summary.buckets[bucket].count} entr
                  {summary.buckets[bucket].count === 1 ? "y" : "ies"}
                </p>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="mx-auto max-w-sm space-y-4 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                  <Clock className="size-7" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold text-foreground">
                    No open receivables
                  </h2>
                  <p className="text-sm text-foreground-muted">
                    No open receivables. If you expected data here, check that
                    customer ledger entries have synced.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised card-shadow">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <span className="text-xs text-foreground-muted">
                  Showing {rows.length} open entr{rows.length === 1 ? "y" : "ies"}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={sortKey === "days_overdue" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSortKey("days_overdue")}
                  >
                    Sort by days overdue
                  </Button>
                  <Button
                    type="button"
                    variant={sortKey === "remaining_amount" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSortKey("remaining_amount")}
                  >
                    Sort by remaining
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="sticky top-0 bg-surface-raised text-left text-xs uppercase tracking-wide text-foreground-subtle">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Customer</th>
                      <th className="px-4 py-2.5 font-medium">Document</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Posting date</th>
                      <th className="px-4 py-2.5 font-medium">Due date</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Days overdue
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-surface">
                        <td className="p-0">
                          <Link
                            href={`/customers?search=${encodeURIComponent(row.customer_no)}`}
                            className="block px-4 py-2.5 font-mono text-xs text-primary hover:underline"
                          >
                            {row.customer_no}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground-muted">
                          {row.document_no ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-foreground-muted">
                          {row.document_type ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-foreground-muted">
                          {formatDate(row.posting_date)}
                        </td>
                        <td className="px-4 py-2.5 text-foreground-muted">
                          {formatDate(row.due_date)}
                        </td>
                        <td
                          className={
                            "px-4 py-2.5 text-right " +
                            ((row.days_overdue ?? 0) > 0
                              ? "text-destructive"
                              : "text-foreground-muted")
                          }
                        >
                          {row.days_overdue ?? 0}
                        </td>
                        <td className="px-4 py-2.5 text-right text-foreground">
                          {formatMoney(row.remaining_amount, row.currency_code)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
