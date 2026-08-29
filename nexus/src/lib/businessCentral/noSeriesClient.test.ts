import { describe, expect, it, vi } from 'vitest';
import { createNoSeriesClient } from './noSeriesClient';
import type { BcClient } from './client';

function fakeBcClient(): BcClient {
  return {
    config: { tenantId: 't', clientId: 'c', environment: 'Production', companyId: 'co', apiBaseUrl: 'https://api.businesscentral.dynamics.com', timeoutMs: 30000 },
    getAccessToken: async () => ({ accessToken: 'tok', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3600000 }),
  } as unknown as BcClient;
}

const lineJson = {
  '@odata.etag': 'W/"abc"', Series_Code: 'NEXUS-TEST', Line_No: 10000,
  Starting_No: 'NX000001', Ending_No: 'NX999999', Last_No_Used: 'NX000005',
  Last_Date_Used: '0001-01-01', Increment_by_No: 1, Implementation: 'Normal', Open: true,
};

describe('getOpenLine', () => {
  it('reads the open line for a series and maps fields', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ value: [lineJson] }), { status: 200 }));
    const client = createNoSeriesClient(fakeBcClient(), 'Hawaii Candy Factory LLC', fetchImpl as unknown as typeof fetch);
    const line = await client.getOpenLine('NEXUS-TEST');
    expect(line).toMatchObject({ seriesCode: 'NEXUS-TEST', lineNo: 10000, lastNoUsed: 'NX000005', implementation: 'Normal', etag: 'W/"abc"' });
    const calledUrl = String((fetchImpl.mock.calls as unknown as Array<[string, object]>)[0]?.[0] ?? '');
    expect(calledUrl).toContain("ODataV4/Company('Hawaii%20Candy%20Factory%20LLC')/NoSeriesLines");
    expect(calledUrl).toContain("Series_Code%20eq%20'NEXUS-TEST'");
  });

  it('returns null when no line exists', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ value: [] }), { status: 200 }));
    const client = createNoSeriesClient(fakeBcClient(), 'C', fetchImpl as unknown as typeof fetch);
    expect(await client.getOpenLine('NOPE')).toBeNull();
  });
});

describe('advanceLine', () => {
  it('PATCHes Last_No_Used and Last_Date_Used with If-Match', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ...lineJson, Last_No_Used: 'NX000006', Last_Date_Used: '2026-06-26' }), { status: 200 }));
    const client = createNoSeriesClient(fakeBcClient(), 'C', fetchImpl as unknown as typeof fetch);
    const line = { seriesCode: 'NEXUS-TEST', lineNo: 10000, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '0001-01-01', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'W/"abc"' };
    const updated = await client.advanceLine(line, 'NX000006', '2026-06-26');
    expect(updated.lastNoUsed).toBe('NX000006');
    const init = ((fetchImpl.mock.calls as unknown as Array<[string, object]>)[0]?.[1]) as unknown as RequestInit;
    expect(init.method).toBe('PATCH');
    expect((init as unknown as Record<string, Record<string, string>>).headers['If-Match']).toBe('W/"abc"');
    expect(JSON.parse(init.body as string)).toEqual({ Last_No_Used: 'NX000006', Last_Date_Used: '2026-06-26' });
  });

  it('throws a typed conflict error on 409', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"code":"Request_EntityChanged"}}', { status: 409 }));
    const client = createNoSeriesClient(fakeBcClient(), 'C', fetchImpl as unknown as typeof fetch);
    const line = { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '0001-01-01', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'W/"abc"' };
    await expect(client.advanceLine(line, 'NX000006', '2026-06-26')).rejects.toThrow(/conflict/i);
  });
});
