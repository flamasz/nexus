import type { BcClient } from './client';
import {
  mapBcCustomerToDb,
  type BcCustomer,
} from './customerMapper';
import {
  POSTED_INVOICE_ODATA_FILTER,
  isPostedInvoice,
  mapBcSalesInvoiceToDb,
  type BcSalesInvoice,
} from './salesInvoiceMapper';
import {
  mapBcLedgerEntryToDb,
  type BcCustomerLedgerEntry,
  type CustomerLedgerClient,
} from './customerLedgerClient';
import type { SyncEntityAdapter } from './syncRunner';

export const AR_SYNC_PAGE_SIZE = 500;

function deltaFilter(cursor: string | null, extra?: string): string | undefined {
  const clauses: string[] = [];
  if (extra) clauses.push(extra);
  // `ge`, not `gt`. Several records can share one lastModifiedDateTime, and a
  // tie group straddling a page boundary would be silently DROPPED by `gt` —
  // silent data loss in a financial mirror. `ge` re-fetches the boundary
  // record instead, which is harmless because every write is an idempotent
  // upsert on a stable conflict target. The sync runner's cursor-did-not-
  // advance guard prevents the pathological case where more than `pageSize`
  // records share a single timestamp.
  if (cursor) clauses.push(`lastModifiedDateTime ge ${cursor}`);
  return clauses.length ? clauses.join(' and ') : undefined;
}

export interface ArSyncAdapterInput {
  bcClient: BcClient;
  ledgerClient: CustomerLedgerClient;
}

export function buildArSyncAdapters(input: ArSyncAdapterInput): SyncEntityAdapter<unknown>[] {
  const { bcClient, ledgerClient } = input;

  const customers: SyncEntityAdapter<BcCustomer> = {
    entityType: 'customer',
    table: 'business_central_customers',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_customer_id',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) =>
      // No $expand of customerFinancialDetails: this tenant's BC rejects it
      // with "Could not find a property named 'customerFinancialDetails' on
      // type 'Microsoft.NAV.customer'". `balance` still populates from the
      // customer's own top-level field; `overdue_amount` stays null, so no UI
      // surfaces it. Deriving overdue from our own ledger entries is a
      // follow-up.
      bcClient.listResourcePage<BcCustomer>('customers', {
        filter: deltaFilter(cursor),
        orderBy: 'lastModifiedDateTime',
        top,
      }),
    map: (ctx, customer) =>
      mapBcCustomerToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        customer,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (customer) => customer.lastModifiedDateTime ?? '',
  };

  const salesInvoices: SyncEntityAdapter<BcSalesInvoice> = {
    entityType: 'sales_invoice',
    table: 'business_central_sales_invoices',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_invoice_id',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: async (cursor, top) => {
      const page = await bcClient.listResourcePage<BcSalesInvoice>('salesInvoices', {
        filter: deltaFilter(cursor, POSTED_INVOICE_ODATA_FILTER),
        orderBy: 'lastModifiedDateTime',
        top,
      });
      // Defence in depth: POSTED_INVOICE_ODATA_FILTER already filters server-side,
      // but a Draft must never be persisted even if that filter is ever wrong or
      // dropped, so guard again client-side.
      return page.filter(isPostedInvoice);
    },
    map: (ctx, invoice) =>
      mapBcSalesInvoiceToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        invoice,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (invoice) => invoice.lastModifiedDateTime ?? '',
  };

  const ledgerEntries: SyncEntityAdapter<BcCustomerLedgerEntry> = {
    entityType: 'customer_ledger_entry',
    table: 'business_central_customer_ledger_entries',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,entry_no',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) => ledgerClient.listEntriesAfter(cursor ? Number(cursor) : 0, top),
    map: (ctx, entry) =>
      mapBcLedgerEntryToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        entry,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (entry) => String(entry.entryNo),
  };

  // Dependency order: customers, then invoices, then ledger entries. Sales
  // invoice lines are NOT included here — BC cannot query salesInvoiceLines
  // as a flat collection at all (no delta field, and a bare fetch errors with
  // "You must specify an Id or a Document Id to get the lines"). Lines are
  // synced separately via salesInvoiceLineSync.ts, keyed off invoices already
  // mirrored in our own database.
  return [customers, salesInvoices, ledgerEntries] as SyncEntityAdapter<unknown>[];
}
