import { describe, expect, it } from 'vitest';
import {
  POSTED_INVOICE_ODATA_FILTER,
  isPostedInvoice,
  mapBcSalesInvoiceToDb,
  type BcSalesInvoice,
} from './salesInvoiceMapper';

const baseInvoice: BcSalesInvoice = {
  id: 'inv-guid-1',
  number: 'PS-INV-1042',
  externalDocumentNumber: 'PO-77',
  invoiceDate: '2026-03-03',
  postingDate: '2026-03-03',
  dueDate: '2026-04-02',
  customerId: 'cust-guid-1',
  customerNumber: 'C00010',
  customerName: 'Acme Corp',
  billToCustomerId: 'cust-guid-1',
  billToCustomerNumber: 'C00010',
  billToName: 'Acme Corp',
  currencyCode: 'USD',
  discountAmount: 0,
  totalAmountExcludingTax: 4000,
  totalTaxAmount: 200,
  totalAmountIncludingTax: 4200,
  status: 'Open',
  lastModifiedDateTime: '2026-03-03T10:00:00Z',
  '@odata.etag': 'W/"etag-inv-1"',
};

const input = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

describe('isPostedInvoice', () => {
  it('rejects drafts', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'Draft' })).toBe(false);
  });

  it('accepts posted statuses', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'Open' })).toBe(true);
    expect(isPostedInvoice({ ...baseInvoice, status: 'Paid' })).toBe(true);
    expect(isPostedInvoice({ ...baseInvoice, status: 'Canceled' })).toBe(true);
  });

  it('is case-insensitive about Draft', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'draft' })).toBe(false);
  });

  it('rejects an invoice with no status rather than guessing', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: undefined })).toBe(false);
  });

  it('exposes a matching OData filter', () => {
    expect(POSTED_INVOICE_ODATA_FILTER).toBe("status ne 'Draft'");
  });
});

describe('mapBcSalesInvoiceToDb', () => {
  it('maps identity, dates, customer, and amounts', () => {
    const row = mapBcSalesInvoiceToDb({ ...input, invoice: baseInvoice });
    expect(row.bc_invoice_id).toBe('inv-guid-1');
    expect(row.bc_invoice_number).toBe('PS-INV-1042');
    expect(row.external_document_number).toBe('PO-77');
    expect(row.invoice_date).toBe('2026-03-03');
    expect(row.posting_date).toBe('2026-03-03');
    expect(row.due_date).toBe('2026-04-02');
    expect(row.bc_customer_id).toBe('cust-guid-1');
    expect(row.customer_name).toBe('Acme Corp');
    expect(row.total_amount_including_tax).toBe(4200);
    expect(row.status).toBe('Open');
  });

  it('nulls empty dates rather than storing empty strings', () => {
    const row = mapBcSalesInvoiceToDb({
      ...input,
      invoice: { ...baseInvoice, dueDate: '', postingDate: undefined },
    });
    expect(row.due_date).toBeNull();
    expect(row.posting_date).toBeNull();
  });

  it('retains the raw payload and stamps sync fields', () => {
    const row = mapBcSalesInvoiceToDb({ ...input, invoice: baseInvoice });
    expect(row.bc_raw_payload).toEqual(baseInvoice);
    expect(row.sync_status).toBe('synced');
    expect(row.last_pulled_at).toBe('2026-03-04T00:00:00Z');
  });
});
