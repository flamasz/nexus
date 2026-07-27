import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_LEDGER_SERVICE_NAME,
  CustomerLedgerPageUnavailableError,
  createCustomerLedgerClient,
  mapBcLedgerEntryToDb,
  type BcCustomerLedgerEntry,
} from './customerLedgerClient';
import type { BcClient } from './client';

function fakeBcClient(): BcClient {
  return {
    config: {
      apiBaseUrl: 'https://api.businesscentral.dynamics.com',
      environment: 'TEST',
      companyId: 'company-1',
      tenantId: 't',
      clientId: 'c',
      clientSecret: 's',
    },
    getAccessToken: vi.fn(async () => ({
      accessToken: 'token-1',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000,
    })),
  } as unknown as BcClient;
}

const rawEntry = {
  Entry_No: 4711,
  Customer_No: 'C00010',
  Posting_Date: '2026-03-03',
  Document_Type: 'Invoice',
  Document_No: 'PS-INV-1042',
  Description: 'Order 77',
  Due_Date: '2026-04-02',
  Currency_Code: '',
  Amount: 4200,
  Remaining_Amount: 4200,
  Open: true,
  Closed_at_Date: '0001-01-01',
  External_Document_No: 'PO-77',
};

describe('CUSTOMER_LEDGER_SERVICE_NAME', () => {
  it('matches the service published in BC', () => {
    expect(CUSTOMER_LEDGER_SERVICE_NAME).toBe('CustomerLedgerEntries');
  });
});

describe('createCustomerLedgerClient', () => {
  it('requests entries after the cursor, ordered and paged', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ value: [rawEntry] }), { status: 200 })
    );
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    const entries = await client.listEntriesAfter(4700, 500);

    expect(entries).toHaveLength(1);
    expect(entries[0].entryNo).toBe(4711);
    expect(entries[0].open).toBe(true);

    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("/ODataV4/Company('CRONUS')/CustomerLedgerEntries");
    expect(decodeURIComponent(url)).toContain('Entry_No gt 4700');
    expect(decodeURIComponent(url)).toContain('$orderby=Entry_No');
    expect(url).toContain('$top=500');
  });

  it('raises a targeted error when the page is not published', async () => {
    const fetchImpl = vi.fn(async () => new Response('Not Found', { status: 404 }));
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    await expect(client.listEntriesAfter(0, 500)).rejects.toBeInstanceOf(
      CustomerLedgerPageUnavailableError
    );
    await expect(client.listEntriesAfter(0, 500)).rejects.toThrow(/CustomerLedgerEntries/);
  });

  it('raises the same targeted error when access is denied', async () => {
    const fetchImpl = vi.fn(async () => new Response('Forbidden', { status: 403 }));
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    await expect(client.listEntriesAfter(0, 500)).rejects.toBeInstanceOf(
      CustomerLedgerPageUnavailableError
    );
  });
});

describe('mapBcLedgerEntryToDb', () => {
  const input = {
    organizationId: 'org-1',
    connectionId: 'conn-1',
    environment: 'TEST',
    companyId: 'company-1',
    now: '2026-03-04T00:00:00Z',
  };

  const entry: BcCustomerLedgerEntry = {
    entryNo: 4711,
    customerNo: 'C00010',
    postingDate: '2026-03-03',
    documentType: 'Invoice',
    documentNo: 'PS-INV-1042',
    description: 'Order 77',
    dueDate: '2026-04-02',
    currencyCode: '',
    amount: 4200,
    remainingAmount: 4200,
    open: true,
    closedAtDate: '0001-01-01',
    externalDocumentNo: 'PO-77',
    raw: rawEntry,
  };

  it('maps entry fields and scope', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.entry_no).toBe(4711);
    expect(row.customer_no).toBe('C00010');
    expect(row.document_type).toBe('Invoice');
    expect(row.due_date).toBe('2026-04-02');
    expect(row.remaining_amount).toBe(4200);
    expect(row.open).toBe(true);
    expect(row.bc_connection_id).toBe('conn-1');
  });

  it('normalizes BC placeholder dates and empty strings to null', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.closed_at_date).toBeNull();
    expect(row.currency_code).toBeNull();
  });

  it('retains the raw payload', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.bc_raw_payload).toEqual(rawEntry);
  });
});
