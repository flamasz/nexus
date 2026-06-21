import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — activeConnection.ts is a 'server-only' module that reads from the
// service-role Supabase client. vi.hoisted shares the spy across the factory.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { resolveActiveBcConnection } from './activeConnection';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

type QueryResult = { data?: unknown; error: unknown };

/**
 * Minimal chainable Supabase mock that records `.eq()` filters so the handler
 * can tell the active-connection lookup (`id` filter) apart from the default
 * lookup (`is_default` filter).
 */
function createSupabaseMock(
  handler: (table: string, filters: Record<string, unknown>) => QueryResult,
) {
  function makeChain(table: string) {
    const filters: Record<string, unknown> = {};
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      maybeSingle: () => Promise.resolve(handler(table, filters)),
      single: () => Promise.resolve(handler(table, filters)),
    };
    return chain;
  }

  return { from: vi.fn((table: string) => makeChain(table)) };
}

const DEFAULT_CONNECTION = { id: 'conn-default', organization_id: ORG_ID, is_default: true };
const ACTIVE_CONNECTION = { id: 'conn-active', organization_id: ORG_ID, is_default: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveActiveBcConnection', () => {
  it("returns the user's active connection when it belongs to the org", async () => {
    const client = createSupabaseMock((table, filters) => {
      if (table === 'users') {
        return { data: { active_bc_connection_id: ACTIVE_CONNECTION.id }, error: null };
      }
      // business_central_connections — active lookup keyed by `id`.
      if (filters.id === ACTIVE_CONNECTION.id && filters.organization_id === ORG_ID) {
        return { data: ACTIVE_CONNECTION, error: null };
      }
      return { data: DEFAULT_CONNECTION, error: null };
    });
    mocks.createServiceClient.mockReturnValue(client);

    await expect(resolveActiveBcConnection(ORG_ID, USER_ID)).resolves.toEqual(ACTIVE_CONNECTION);
  });

  it('falls back to the org default when the user has no active connection', async () => {
    const client = createSupabaseMock((table) => {
      if (table === 'users') {
        return { data: { active_bc_connection_id: null }, error: null };
      }
      return { data: DEFAULT_CONNECTION, error: null };
    });
    mocks.createServiceClient.mockReturnValue(client);

    await expect(resolveActiveBcConnection(ORG_ID, USER_ID)).resolves.toEqual(DEFAULT_CONNECTION);
  });

  it('falls back to the org default when the active connection belongs to another org', async () => {
    const client = createSupabaseMock((table, filters) => {
      if (table === 'users') {
        return { data: { active_bc_connection_id: 'conn-other-org' }, error: null };
      }
      // Active lookup is scoped by organization_id, so a cross-org pointer
      // resolves to no row; the default lookup (is_default filter) wins.
      if (filters.id === 'conn-other-org') {
        return { data: null, error: null };
      }
      return { data: DEFAULT_CONNECTION, error: null };
    });
    mocks.createServiceClient.mockReturnValue(client);

    await expect(resolveActiveBcConnection(ORG_ID, USER_ID)).resolves.toEqual(DEFAULT_CONNECTION);
  });

  it('returns null when the user has no active connection and the org has no default', async () => {
    const client = createSupabaseMock((table) => {
      if (table === 'users') {
        return { data: { active_bc_connection_id: null }, error: null };
      }
      return { data: null, error: null };
    });
    mocks.createServiceClient.mockReturnValue(client);

    await expect(resolveActiveBcConnection(ORG_ID, USER_ID)).resolves.toBeNull();
  });
});
