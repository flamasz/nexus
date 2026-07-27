import { BusinessCentralCustomerLedgerEntry } from '@/types/database';
import { createBcClientForOrg, type BcClient } from './client';

/** Page 25 (Cust. Ledger Entries), published as an OData web service under this name. */
export const CUSTOMER_LEDGER_SERVICE_NAME = 'CustomerLedgerEntries';

/** BC's placeholder for "no date". */
const BC_NULL_DATE = '0001-01-01';

export class CustomerLedgerPageUnavailableError extends Error {
  constructor(status: number) {
    super(
      `Customer ledger entries are unavailable (HTTP ${status}). Publish page 25 ` +
        `(Cust. Ledger Entries) as an OData web service named "${CUSTOMER_LEDGER_SERVICE_NAME}" ` +
        `in this Business Central environment, and confirm the app registration has read ` +
        `access to the Cust. Ledger Entry table.`
    );
    this.name = 'CustomerLedgerPageUnavailableError';
  }
}

export interface BcCustomerLedgerEntry {
  entryNo: number;
  customerNo: string;
  postingDate: string;
  documentType: string;
  documentNo: string;
  description: string;
  dueDate: string;
  currencyCode: string;
  amount: number;
  remainingAmount: number;
  open: boolean;
  closedAtDate: string;
  externalDocumentNo: string;
  raw: Record<string, unknown>;
}

export interface CustomerLedgerClient {
  listEntriesAfter(entryNo: number, top: number): Promise<BcCustomerLedgerEntry[]>;
}

export interface LedgerEntryUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  entry: BcCustomerLedgerEntry;
  now: string;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function mapEntry(row: Record<string, unknown>): BcCustomerLedgerEntry {
  return {
    entryNo: Number(row.Entry_No),
    customerNo: String(row.Customer_No ?? ''),
    postingDate: String(row.Posting_Date ?? ''),
    documentType: String(row.Document_Type ?? ''),
    documentNo: String(row.Document_No ?? ''),
    description: String(row.Description ?? ''),
    dueDate: String(row.Due_Date ?? ''),
    currencyCode: String(row.Currency_Code ?? ''),
    amount: Number(row.Amount ?? 0),
    remainingAmount: Number(row.Remaining_Amount ?? 0),
    open: Boolean(row.Open),
    closedAtDate: String(row.Closed_at_Date ?? ''),
    externalDocumentNo: String(row.External_Document_No ?? ''),
    raw: row,
  };
}

export function createCustomerLedgerClient(
  bcClient: BcClient,
  companyName: string,
  fetchImpl: typeof fetch = fetch
): CustomerLedgerClient {
  const base =
    `${trimTrailingSlash(bcClient.config.apiBaseUrl ?? 'https://api.businesscentral.dynamics.com')}` +
    `/v2.0/${encodeURIComponent(bcClient.config.environment)}` +
    `/ODataV4/Company('${encodeURIComponent(companyName)}')`;

  async function authHeader(): Promise<string> {
    const token = await bcClient.getAccessToken();
    return `${token.tokenType} ${token.accessToken}`;
  }

  return {
    async listEntriesAfter(entryNo: number, top: number): Promise<BcCustomerLedgerEntry[]> {
      const filter = encodeURIComponent(`Entry_No gt ${entryNo}`);
      const url =
        `${base}/${CUSTOMER_LEDGER_SERVICE_NAME}` +
        `?$filter=${filter}&$orderby=${encodeURIComponent('Entry_No')}&$top=${top}`;

      const response = await fetchImpl(url, {
        headers: {
          Authorization: await authHeader(),
          Accept: 'application/json',
        },
      });

      if (response.status === 404 || response.status === 403 || response.status === 401) {
        throw new CustomerLedgerPageUnavailableError(response.status);
      }
      if (!response.ok) {
        throw new Error(
          `Failed to read ${CUSTOMER_LEDGER_SERVICE_NAME}: HTTP ${response.status}`
        );
      }

      const body = (await response.json()) as { value?: Record<string, unknown>[] };
      return (body.value ?? []).map(mapEntry);
    },
  };
}

export async function createCustomerLedgerClientForOrg(
  orgId: string,
  connectionId: string
): Promise<CustomerLedgerClient> {
  const bcClient = await createBcClientForOrg(orgId, connectionId);
  const company = await bcClient.getCompany(bcClient.config.companyId);
  return createCustomerLedgerClient(bcClient, company.name);
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === BC_NULL_DATE) return null;
  return trimmed;
}

export function mapBcLedgerEntryToDb(
  input: LedgerEntryUpsertInput
): Partial<BusinessCentralCustomerLedgerEntry> {
  const { organizationId, connectionId, environment, companyId, entry, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    entry_no: entry.entryNo,
    customer_no: entry.customerNo,
    posting_date: dateOrNull(entry.postingDate),
    document_type: emptyToNull(entry.documentType),
    document_no: emptyToNull(entry.documentNo),
    description: emptyToNull(entry.description),
    due_date: dateOrNull(entry.dueDate),
    currency_code: emptyToNull(entry.currencyCode),
    amount: entry.amount,
    remaining_amount: entry.remainingAmount,
    open: entry.open,
    closed_at_date: dateOrNull(entry.closedAtDate),
    external_document_no: emptyToNull(entry.externalDocumentNo),
    bc_raw_payload: entry.raw,
    updated_at: now,
  };
}
