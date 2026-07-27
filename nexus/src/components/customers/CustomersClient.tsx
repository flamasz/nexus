"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { RefreshCw, Search, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncBusinessCentralReceivables } from "@/app/actions/businessCentralReceivables";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BusinessCentralCustomer } from "@/types/database";
import type { SyncEntityResult } from "@/lib/businessCentral/syncRunner";

interface CustomersClientProps {
  customers: BusinessCentralCustomer[];
  canSync: boolean;
  initialSearch?: string;
}

export function CustomersClient({ customers, canSync, initialSearch }: CustomersClientProps) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [isPending, startTransition] = useTransition();
  const [syncResults, setSyncResults] = useState<SyncEntityResult[] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => {
      return (
        customer.display_name.toLowerCase().includes(query) ||
        (customer.bc_customer_number ?? "").toLowerCase().includes(query) ||
        (customer.email ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, search]);

  const runSync = () => {
    setSyncError(null);
    startTransition(() => {
      syncBusinessCentralReceivables()
        .then((results) => setSyncResults(results))
        .catch((error) => {
          setSyncError(
            error instanceof Error ? error.message : "Business Central sync failed"
          );
          setSyncResults(null);
        });
    });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Customers
          </h1>
          <p className="mt-1 text-xs text-foreground-subtle">
            {customers.length} customer{customers.length === 1 ? "" : "s"} synced from Business Central
          </p>
        </div>
        {canSync && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={runSync}
          >
            <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
            {isPending ? "Syncing…" : "Sync now"}
          </Button>
        )}
      </header>

      {syncError && (
        <div className="border-b border-border bg-destructive-subtle px-5 py-2 text-sm text-destructive">
          {syncError}
        </div>
      )}

      {syncResults && !syncError && (
        <div className="space-y-2 border-b border-border bg-surface px-5 py-3">
          {syncResults.map((result) => (
            <div
              key={result.entityType}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="font-medium text-foreground">{result.entityType}</span>
              <span className="text-foreground-muted">
                {result.recordsSynced} record{result.recordsSynced === 1 ? "" : "s"} synced
              </span>
              {result.error ? (
                <Badge variant="destructive">{result.error}</Badge>
              ) : result.complete ? (
                <Badge variant="success">Complete</Badge>
              ) : (
                <Badge variant="warning">
                  Incomplete — click Sync again to continue
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {customers.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-10">
          <div className="max-w-sm space-y-4 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
              <Users className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">
                No customers synced yet
              </h2>
              <p className="text-sm text-foreground-muted">
                No customers synced yet. Click Sync now to pull them from Business Central.
              </p>
            </div>
            {canSync && (
              <Button type="button" disabled={isPending} onClick={runSync}>
                <RefreshCw className="size-4" />
                Sync now
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden p-3 lg:p-4">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-raised card-shadow">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, number, or email"
                  className="pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 rounded-md p-1 -translate-y-1/2 text-foreground-subtle transition-colors hover:bg-surface hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 text-xs text-foreground-muted">
                {search.trim()
                  ? `Showing ${filtered.length} of ${customers.length} customer${customers.length === 1 ? "" : "s"}`
                  : `Showing ${customers.length} customer${customers.length === 1 ? "" : "s"}`}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-foreground-muted">
                  No customers match “{search.trim()}”.
                </p>
              ) : (
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="sticky top-0 bg-surface-raised text-left text-xs uppercase tracking-wide text-foreground-subtle">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Number</th>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">City</th>
                      <th className="px-4 py-2.5 font-medium">Currency</th>
                      <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((customer) => (
                      <tr
                        key={customer.id}
                        className="cursor-pointer transition-colors hover:bg-surface"
                      >
                        <td className="p-0">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="block px-4 py-2.5 font-mono text-xs text-foreground-muted"
                          >
                            {customer.bc_customer_number ?? "—"}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="block px-4 py-2.5 font-medium text-foreground"
                          >
                            {customer.display_name}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="block px-4 py-2.5 text-foreground-muted"
                          >
                            {customer.city ?? "—"}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="block px-4 py-2.5 text-foreground-muted"
                          >
                            {customer.currency_code ?? "—"}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="block px-4 py-2.5 text-right text-foreground"
                          >
                            {formatMoney(customer.balance, customer.currency_code)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
