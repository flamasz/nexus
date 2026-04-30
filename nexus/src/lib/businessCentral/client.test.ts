import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BC_TOKEN_SCOPE,
  apiRoot,
  createBcClient,
  readBcClientConfigFromEnv,
  resetBcClientTokenCacheForTests,
} from './client';

const config = {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  environment: 'sandbox',
  companyId: 'company-id',
  timeoutMs: 1_000,
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
}

function tokenResponse() {
  return jsonResponse({ access_token: 'access-token', token_type: 'Bearer', expires_in: 3600 });
}

describe('Business Central client', () => {
  beforeEach(() => {
    resetBcClientTokenCacheForTests();
  });

  it('builds the Business Central API root from environment and base URL', () => {
    expect(apiRoot({ environment: 'sandbox' })).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0'
    );
    expect(apiRoot({ environment: 'Production', apiBaseUrl: 'https://example.test/' })).toBe(
      'https://example.test/v2.0/Production/api/v2.0'
    );
  });

  it('reads required config from env and reports missing values', () => {
    expect(() => readBcClientConfigFromEnv({})).toThrow(/Missing Business Central env vars/);
    expect(
      readBcClientConfigFromEnv({
        BUSINESS_CENTRAL_TENANT_ID: 'tenant',
        BUSINESS_CENTRAL_CLIENT_ID: 'client',
        BUSINESS_CENTRAL_CLIENT_SECRET: 'secret',
        BUSINESS_CENTRAL_ENVIRONMENT: 'sandbox',
        BUSINESS_CENTRAL_DEFAULT_COMPANY_ID: 'company',
      })
    ).toMatchObject({ tenantId: 'tenant', clientId: 'client', environment: 'sandbox', companyId: 'company' });
  });

  it('authenticates with client credentials and calls company-scoped item endpoints', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: 'item-id', number: '1000' }] }));
    const client = createBcClient({ ...config, fetchImpl });

    const response = await client.listItems({ top: 5, filter: "lastModifiedDateTime gt 2026-04-01T00:00:00Z" });

    expect(response.value[0]).toMatchObject({ id: 'item-id', number: '1000' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
    expect(String(tokenUrl)).toBe('https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
    expect(String((tokenInit?.body as URLSearchParams).get('scope'))).toBe(BC_TOKEN_SCOPE);
    expect(String((tokenInit?.body as URLSearchParams).get('grant_type'))).toBe('client_credentials');

    const [itemsUrl, itemsInit] = fetchImpl.mock.calls[1];
    expect(String(itemsUrl)).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/items?%24top=5&%24filter=lastModifiedDateTime+gt+2026-04-01T00%3A00%3A00Z'
    );
    expect(new Headers(itemsInit?.headers).get('Authorization')).toBe('Bearer access-token');
  });


  it('follows Business Central item pagination links', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          value: [{ id: 'item-1', number: '1000' }],
          '@odata.nextLink': 'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/items?$skiptoken=abc',
        })
      )
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: 'item-2', number: '1001' }] }));

    const client = createBcClient({ ...config, fetchImpl });

    await expect(client.listAllItems({ pageSize: 1 })).resolves.toEqual({
      items: [
        { id: 'item-1', number: '1000' },
        { id: 'item-2', number: '1001' },
      ],
      truncated: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/items?%24top=1'
    );
    expect(String(fetchImpl.mock.calls[2][0])).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/items?$skiptoken=abc'
    );
  });

  it('retries 429 responses and preserves sanitized error details', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'TooManyRequests', message: 'Slow down' } }, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }));

    const client = createBcClient({ ...config, fetchImpl });

    await expect(client.listCompanies()).resolves.toEqual({ value: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('calls Business Central posting group reference endpoints', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: 'gppg-id', code: 'RETAIL' }] }))
      .mockResolvedValueOnce(jsonResponse({ value: [{ id: 'ipg-id', code: 'FINISHED' }] }));
    const client = createBcClient({ ...config, fetchImpl });

    await expect(client.listGeneralProductPostingGroups({ top: 100 })).resolves.toMatchObject({
      value: [{ id: 'gppg-id', code: 'RETAIL' }],
    });
    await expect(client.listInventoryPostingGroups({ top: 100 })).resolves.toMatchObject({
      value: [{ id: 'ipg-id', code: 'FINISHED' }],
    });

    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/generalProductPostingGroups?%24top=100'
    );
    expect(String(fetchImpl.mock.calls[2][0])).toBe(
      'https://api.businesscentral.dynamics.com/v2.0/sandbox/api/v2.0/companies(company-id)/inventoryPostingGroups?%24top=100'
    );
  });
});
