import { BusinessCentralSalesInvoice } from '@/types/database';

export interface BcSalesInvoice {
  id: string;
  number?: string;
  externalDocumentNumber?: string;
  invoiceDate?: string;
  postingDate?: string;
  dueDate?: string;
  customerId?: string;
  customerNumber?: string;
  customerName?: string;
  billToCustomerId?: string;
  billToCustomerNumber?: string;
  billToName?: string;
  currencyCode?: string;
  discountAmount?: number;
  totalAmountExcludingTax?: number;
  totalTaxAmount?: number;
  totalAmountIncludingTax?: number;
  status?: string;
  lastModifiedDateTime?: string;
  '@odata.etag'?: string;
  [key: string]: unknown;
}

export interface SalesInvoiceUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  invoice: BcSalesInvoice;
  now: string;
}

/**
 * BC's salesInvoices endpoint returns drafts alongside posted invoices.
 * Nexus mirrors posted invoices only.
 */
export const POSTED_INVOICE_ODATA_FILTER = "status ne 'Draft'";

export function isPostedInvoice(invoice: BcSalesInvoice): boolean {
  const status = invoice.status?.trim();
  if (!status) return false;
  return status.toLowerCase() !== 'draft';
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapBcSalesInvoiceToDb(
  input: SalesInvoiceUpsertInput
): Partial<BusinessCentralSalesInvoice> {
  const { organizationId, connectionId, environment, companyId, invoice, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_invoice_id: invoice.id,
    bc_invoice_number: emptyToNull(invoice.number),
    external_document_number: emptyToNull(invoice.externalDocumentNumber),
    bc_etag: invoice['@odata.etag'] ?? null,
    bc_last_modified_at: invoice.lastModifiedDateTime || null,
    invoice_date: emptyToNull(invoice.invoiceDate),
    posting_date: emptyToNull(invoice.postingDate),
    due_date: emptyToNull(invoice.dueDate),
    bc_customer_id: emptyToNull(invoice.customerId),
    customer_number: emptyToNull(invoice.customerNumber),
    customer_name: emptyToNull(invoice.customerName),
    bill_to_customer_id: emptyToNull(invoice.billToCustomerId),
    bill_to_customer_number: emptyToNull(invoice.billToCustomerNumber),
    bill_to_name: emptyToNull(invoice.billToName),
    currency_code: emptyToNull(invoice.currencyCode),
    discount_amount: numberOrNull(invoice.discountAmount),
    total_amount_excluding_tax: numberOrNull(invoice.totalAmountExcludingTax),
    total_tax_amount: numberOrNull(invoice.totalTaxAmount),
    total_amount_including_tax: numberOrNull(invoice.totalAmountIncludingTax),
    status: emptyToNull(invoice.status),
    bc_raw_payload: invoice as unknown as Record<string, unknown>,
    sync_status: 'synced',
    sync_error: null,
    last_synced_at: now,
    last_pulled_at: now,
    updated_at: now,
  };
}
