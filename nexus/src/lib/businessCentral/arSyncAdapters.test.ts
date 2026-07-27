import { describe, expect, it, vi } from 'vitest';
import { buildArSyncAdapters } from './arSyncAdapters';
import type { BcClient } from './client';
import type { CustomerLedgerClient } from './customerLedgerClient';

const ctx = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

function fakeClients() {
  const listResourcePage = vi.fn<
    (
      resource: string,
      options: { filter?: string; orderBy: string; top: number; expand?: string }
    ) => Promise<unknown[]>
  >(async () => []);
  const listEntriesAfter = vi.fn<(entryNo: number, top: number) => Promise<unknown[]>>(async () => []);
  return {
    bcClient: { listResourcePage } as unknown as BcClient,
    ledgerClient: { listEntriesAfter } as unknown as CustomerLedgerClient,
    listResourcePage,
    listEntriesAfter,
  };
}

describe('buildArSyncAdapters', () => {
  it('returns the three entities in dependency order', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    expect(adapters.map((a) => a.entityType)).toEqual([
      'customer',
      'sales_invoice',
      'customer_ledger_entry',
    ]);
  });

  it('filters sales invoices to posted only and orders by last modified', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const invoices = adapters.find((a) => a.entityType === 'sales_invoice')!;

    await invoices.fetchPage('2026-03-01T00:00:00Z', 500);

    const call = listResourcePage.mock.calls[0];
    expect(call[0]).toBe('salesInvoices');
    expect(call[1].filter).toContain("status ne 'Draft'");
    expect(call[1].filter).toContain('lastModifiedDateTime ge 2026-03-01T00:00:00Z');
    expect(call[1].orderBy).toBe('lastModifiedDateTime');
    expect(call[1].top).toBe(500);
  });

  it('does not pass an expand option for customers, because BC rejects the customerFinancialDetails expand', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    await customers.fetchPage(null, 500);

    expect(listResourcePage.mock.calls[0][1].expand).toBeUndefined();
  });

  it('omits the cursor clause on a first run', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    await customers.fetchPage(null, 500);

    expect(listResourcePage.mock.calls[0][1].filter).toBeUndefined();
  });

  it('drives ledger entries from the numeric entry cursor', async () => {
    const { bcClient, ledgerClient, listEntriesAfter } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const ledger = adapters.find((a) => a.entityType === 'customer_ledger_entry')!;

    await ledger.fetchPage('4700', 500);
    expect(listEntriesAfter).toHaveBeenCalledWith(4700, 500);

    await ledger.fetchPage(null, 500);
    expect(listEntriesAfter).toHaveBeenLastCalledWith(0, 500);
  });

  it('maps a customer through the customer mapper', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    const row = customers.map(ctx, {
      id: 'cust-1',
      displayName: 'Acme',
      lastModifiedDateTime: '2026-03-03T10:00:00Z',
    });

    expect(row.bc_customer_id).toBe('cust-1');
    expect(row.organization_id).toBe('org-1');
  });

  it('uses lastModifiedDateTime as the cursor for API v2.0 entities', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    expect(
      customers.cursorValue({ id: 'c', displayName: 'x', lastModifiedDateTime: '2026-03-03T10:00:00Z' })
    ).toBe('2026-03-03T10:00:00Z');
  });

  it('returns the string form of entryNo as the ledger cursor', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const ledger = adapters.find((a) => a.entityType === 'customer_ledger_entry')!;

    expect(
      ledger.cursorValue({
        entryNo: 4700,
        customerNo: 'CUST-1',
        postingDate: '2026-03-01',
        documentType: 'Invoice',
        documentNo: 'INV-1',
        description: '',
        dueDate: '2026-03-31',
        currencyCode: '',
        amount: 100,
        remainingAmount: 100,
        open: true,
        closedAtDate: '',
        externalDocumentNo: '',
        raw: {},
      })
    ).toBe('4700');
  });

  it('drops a Draft invoice returned by the API as a client-side guard', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    listResourcePage.mockImplementation(async () => [
      {
        id: 'inv-draft',
        status: 'Draft',
        lastModifiedDateTime: '2026-03-02T00:00:00Z',
      },
      {
        id: 'inv-posted',
        status: 'Open',
        lastModifiedDateTime: '2026-03-02T00:00:00Z',
      },
    ]);
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const invoices = adapters.find((a) => a.entityType === 'sales_invoice')!;

    const page = (await invoices.fetchPage(null, 500)) as Array<{ id: string }>;

    expect(page.map((invoice) => invoice.id)).toEqual(['inv-posted']);
  });
});
