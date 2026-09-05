import { describe, expect, it, vi } from 'vitest';

import { createBillcomClientForConnection } from './connection';
import { BillcomConnectionDisabledError } from './errors';

const row = {
  id: 'conn-1',
  organization_id: 'org-1',
  display_name: 'Sandbox',
  environment: 'sandbox',
  api_base_url: 'https://gateway.stage.bill.com',
  username: 'user@example.com',
  billcom_organization_id: '008ORG',
  is_enabled: true,
  session_id: null,
  session_last_used_at: null,
};

function stubSupabase(connectionRow: Record<string, unknown> | null, secrets: Record<string, string | null>) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: connectionRow, error: null })) })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    rpc: vi.fn(async (name: string) => ({ data: secrets[name] ?? null, error: null })),
  };
}

describe('Bill.com connection factory', () => {
  it('refuses to build a client for a disabled connection', async () => {
    const supabase = stubSupabase({ ...row, is_enabled: false }, {});

    await expect(
      createBillcomClientForConnection('conn-1', 'org-1', { supabase: supabase as never }),
    ).rejects.toBeInstanceOf(BillcomConnectionDisabledError);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws a clear error when the connection does not exist', async () => {
    const supabase = stubSupabase(null, {});

    await expect(
      createBillcomClientForConnection('missing', 'org-1', { supabase: supabase as never }),
    ).rejects.toThrow(/was not found/);
  });

  it('throws a clear error when the connection belongs to another organization', async () => {
    // The org-scoped query returns no row for a foreign connection id, so this
    // looks identical to "does not exist" from the caller's perspective — and
    // must never reach a Vault RPC.
    const supabase = stubSupabase(null, {});

    await expect(
      createBillcomClientForConnection('conn-1', 'org-2', { supabase: supabase as never }),
    ).rejects.toThrow(/was not found/);

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws a clear error when credentials have not been stored', async () => {
    const supabase = stubSupabase(row, { get_billcom_dev_key: null, get_billcom_password: null });

    await expect(
      createBillcomClientForConnection('conn-1', 'org-1', { supabase: supabase as never }),
    ).rejects.toThrow(/credentials/i);
  });

  it('decrypts both secrets and returns a usable client', async () => {
    const supabase = stubSupabase(row, {
      get_billcom_dev_key: 'dev-key',
      get_billcom_password: 'password',
    });

    const client = await createBillcomClientForConnection('conn-1', 'org-1', {
      supabase: supabase as never,
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(typeof client.login).toBe('function');
    expect(supabase.rpc).toHaveBeenCalledWith('get_billcom_dev_key', { p_connection_id: 'conn-1' });
    expect(supabase.rpc).toHaveBeenCalledWith('get_billcom_password', { p_connection_id: 'conn-1' });
  });
});
