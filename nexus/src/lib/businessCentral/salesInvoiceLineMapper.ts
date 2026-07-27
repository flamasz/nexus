import { BusinessCentralSalesInvoiceLine } from '@/types/database';

export interface BcSalesInvoiceLine {
  id: string;
  documentId: string;
  sequence?: number;
  lineType?: string;
  lineObjectNumber?: string;
  description?: string;
  unitOfMeasureCode?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxPercent?: number;
  amountExcludingTax?: number;
  taxAmount?: number;
  amountIncludingTax?: number;
  lastModifiedDateTime?: string;
  '@odata.etag'?: string;
  [key: string]: unknown;
}

export interface SalesInvoiceLineUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  line: BcSalesInvoiceLine;
  now: string;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapBcSalesInvoiceLineToDb(
  input: SalesInvoiceLineUpsertInput
): Partial<BusinessCentralSalesInvoiceLine> {
  const { organizationId, connectionId, environment, companyId, line, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_line_id: line.id,
    bc_invoice_id: line.documentId,
    bc_etag: line['@odata.etag'] ?? null,
    bc_last_modified_at: line.lastModifiedDateTime || null,
    sequence: numberOrNull(line.sequence),
    line_type: emptyToNull(line.lineType),
    line_object_number: emptyToNull(line.lineObjectNumber),
    description: emptyToNull(line.description),
    unit_of_measure_code: emptyToNull(line.unitOfMeasureCode),
    quantity: numberOrNull(line.quantity),
    unit_price: numberOrNull(line.unitPrice),
    discount_amount: numberOrNull(line.discountAmount),
    discount_percent: numberOrNull(line.discountPercent),
    tax_percent: numberOrNull(line.taxPercent),
    amount_excluding_tax: numberOrNull(line.amountExcludingTax),
    tax_amount: numberOrNull(line.taxAmount),
    amount_including_tax: numberOrNull(line.amountIncludingTax),
    bc_raw_payload: line as unknown as Record<string, unknown>,
    updated_at: now,
  };
}
