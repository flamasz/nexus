import { createBcClientForOrg, type BcClient } from './client';

export interface BcNoSeriesLine {
  seriesCode: string;
  lineNo: number;
  startingNo: string;
  endingNo: string;
  lastNoUsed: string;
  lastDateUsed: string;
  incrementByNo: number;
  implementation: string;
  open: boolean;
  etag: string;
}

export class NoSeriesConflictError extends Error {
  constructor() {
    super('No. Series line changed concurrently (conflict)');
    this.name = 'NoSeriesConflictError';
  }
}

export interface NoSeriesClient {
  getOpenLine(seriesCode: string): Promise<BcNoSeriesLine | null>;
  advanceLine(line: BcNoSeriesLine, newLastNoUsed: string, lastDateUsed: string): Promise<BcNoSeriesLine>;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function mapLine(row: Record<string, unknown>): BcNoSeriesLine {
  return {
    seriesCode: String(row.Series_Code),
    lineNo: Number(row.Line_No),
    startingNo: String(row.Starting_No ?? ''),
    endingNo: String(row.Ending_No ?? ''),
    lastNoUsed: String(row.Last_No_Used ?? ''),
    lastDateUsed: String(row.Last_Date_Used ?? ''),
    incrementByNo: Number(row.Increment_by_No ?? 1),
    implementation: String(row.Implementation ?? 'Normal'),
    open: Boolean(row.Open),
    etag: String(row['@odata.etag'] ?? ''),
  };
}

export function createNoSeriesClient(
  bcClient: BcClient,
  companyName: string,
  fetchImpl: typeof fetch = fetch,
): NoSeriesClient {
  const base = `${trimTrailingSlash(bcClient.config.apiBaseUrl ?? 'https://api.businesscentral.dynamics.com')}/v2.0/${encodeURIComponent(bcClient.config.environment)}/ODataV4/Company('${encodeURIComponent(companyName)}')`;

  async function authHeader(): Promise<string> {
    const token = await bcClient.getAccessToken();
    return `${token.tokenType} ${token.accessToken}`;
  }

  async function getOpenLine(seriesCode: string): Promise<BcNoSeriesLine | null> {
    const url = `${base}/NoSeriesLines?$filter=${encodeURIComponent(`Series_Code eq '${seriesCode}'`)}`;
    const res = await fetchImpl(url, { headers: { Authorization: await authHeader(), Accept: 'application/json' } });
    if (!res.ok) throw new Error(`No. Series read failed: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { value?: Record<string, unknown>[] };
    const rows = (json.value ?? []).map(mapLine);
    if (rows.length === 0) return null;
    return rows.find((r) => r.open) ?? rows[0];
  }

  async function advanceLine(line: BcNoSeriesLine, newLastNoUsed: string, lastDateUsed: string): Promise<BcNoSeriesLine> {
    const key = `${base}/NoSeriesLines(Series_Code='${encodeURIComponent(line.seriesCode)}',Line_No=${line.lineNo})`;
    const res = await fetchImpl(key, {
      method: 'PATCH',
      headers: { Authorization: await authHeader(), Accept: 'application/json', 'Content-Type': 'application/json', 'If-Match': line.etag },
      body: JSON.stringify({ Last_No_Used: newLastNoUsed, Last_Date_Used: lastDateUsed }),
    });
    if (res.status === 409 || res.status === 412) throw new NoSeriesConflictError();
    if (!res.ok) throw new Error(`No. Series advance failed: ${res.status} ${res.statusText}`);
    return mapLine((await res.json()) as Record<string, unknown>);
  }

  return { getOpenLine, advanceLine };
}

export async function createNoSeriesClientForOrg(orgId: string, connectionId?: string): Promise<NoSeriesClient> {
  const bcClient = await createBcClientForOrg(orgId, connectionId);
  const company = await bcClient.getCompany(bcClient.config.companyId);
  // BC OData company key uses the Company.Name (short name), not displayName.
  return createNoSeriesClient(bcClient, company.name);
}
