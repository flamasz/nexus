import { describe, expect, it } from 'vitest';
import { mapBcSalesInvoiceLineToDb, type BcSalesInvoiceLine } from './salesInvoiceLineMapper';

const baseLine: BcSalesInvoiceLine = {
  id: 'line-guid-1',
  documentId: 'inv-guid-1',
  sequence: 10000,
  lineType: 'Item',
  lineObjectNumber: 'NX000123',
  description: '500ct box',
  unitOfMeasureCode: 'CASE',
  quantity: 500,
  unitPrice: 6,
  discountAmount: 0,
  discountPercent: 0,
  taxPercent: 5,
  amountExcludingTax: 3000,
  taxAmount: 150,
  amountIncludingTax: 3150,
  '@odata.etag': 'W/"etag-line-1"',
};

const input = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

describe('mapBcSalesInvoiceLineToDb', () => {
  it('maps the line and its parent invoice reference', () => {
    const row = mapBcSalesInvoiceLineToDb({ ...input, line: baseLine });
    expect(row.bc_line_id).toBe('line-guid-1');
    expect(row.bc_invoice_id).toBe('inv-guid-1');
    expect(row.sequence).toBe(10000);
    expect(row.line_type).toBe('Item');
    expect(row.line_object_number).toBe('NX000123');
    expect(row.quantity).toBe(500);
    expect(row.unit_price).toBe(6);
    expect(row.amount_including_tax).toBe(3150);
  });

  it('nulls empty text and non-numeric values', () => {
    const row = mapBcSalesInvoiceLineToDb({
      ...input,
      line: { ...baseLine, description: '', quantity: undefined },
    });
    expect(row.description).toBeNull();
    expect(row.quantity).toBeNull();
  });

  it('retains the raw payload', () => {
    const row = mapBcSalesInvoiceLineToDb({ ...input, line: baseLine });
    expect(row.bc_raw_payload).toEqual(baseLine);
    expect(row.updated_at).toBe('2026-03-04T00:00:00Z');
  });
});
