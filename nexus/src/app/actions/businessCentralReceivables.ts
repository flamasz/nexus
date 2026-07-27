'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/currentUserAccess';
import {
  canEditBusinessCentralItems,
  canViewReceivables,
} from '@/lib/auth/permissions';
import { resolveActiveBcConnection } from '@/lib/businessCentral/activeConnection';
import { buildArSyncAdapters } from '@/lib/businessCentral/arSyncAdapters';
import { createBcClientForOrg } from '@/lib/businessCentral/client';
import { createCustomerLedgerClientForOrg } from '@/lib/businessCentral/customerLedgerClient';
import {
  runAllEntitySyncs,
  type CheckpointStore,
  type SyncEntityResult,
} from '@/lib/businessCentral/syncRunner';
import { createServiceClient } from '@/lib/supabase/server';
import { BusinessCentralSyncCheckpoint, SyncEntityType } from '@/types/database';

// Task 8's runner deliberately does NOT skip later entities when the budget is
// exhausted — each still processes one page, so worst-case wall time is this
// budget plus up to four page round-trips (one per adapter). The effective
// ceiling is therefore roughly 60s plus four page fetches, and it must stay
// below the deployment's serverless function timeout.
const SYNC_BUDGET_MS = 60_000;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

type SupabaseServiceClient = ReturnType<typeof createServiceClient>;

function checkpointStore(
  supabase: SupabaseServiceClient,
  organizationId: string
): CheckpointStore {
  return {
    async read(connectionId, entityType) {
      const { data } = await supabase
        .from('business_central_sync_checkpoints')
        .select('cursor_value, records_synced')
        .eq('bc_connection_id', connectionId)
        .eq('entity_type', entityType)
        .maybeSingle();
      return data ?? null;
    },
    async write(connectionId, entityType, patch) {
      const { error } = await supabase.from('business_central_sync_checkpoints').upsert(
        {
          organization_id: organizationId,
          bc_connection_id: connectionId,
          entity_type: entityType,
          phase: 'backfill',
          cursor_value: patch.cursor_value,
          records_synced: patch.records_synced,
          last_error: patch.last_error,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'bc_connection_id,entity_type' }
      );
      if (error) throw error;
    },
  };
}

export async function syncBusinessCentralReceivables(): Promise<SyncEntityResult[]> {
  const { orgId, user } = await requirePermission(
    canEditBusinessCentralItems,
    'You do not have permission to sync Business Central data'
  );

  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) throw new Error('Select a Business Central environment first');

  const now = new Date().toISOString();
  const lockUntil = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();

  if (
    connection.sync_in_progress_since &&
    (!connection.sync_in_progress_timeout_at || connection.sync_in_progress_timeout_at > now)
  ) {
    throw new Error(
      `Sync already in progress by ${connection.sync_in_progress_by ?? 'another user'} since ${connection.sync_in_progress_since}`
    );
  }

  await supabase
    .from('business_central_connections')
    .update({
      sync_in_progress_by: user.id,
      sync_in_progress_since: now,
      sync_in_progress_timeout_at: lockUntil,
      updated_at: now,
    })
    .eq('id', connection.id);

  try {
    const bcClient = await createBcClientForOrg(orgId, connection.id);
    const ledgerClient = await createCustomerLedgerClientForOrg(orgId, connection.id);
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });

    const results = await runAllEntitySyncs(
      {
        checkpoints: checkpointStore(supabase, orgId),
        async upsert(table, rows, conflictTarget) {
          const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictTarget });
          if (error) throw error;
        },
        nowMs: () => Date.now(),
      },
      adapters,
      {
        organizationId: orgId,
        connectionId: connection.id,
        environment: connection.environment,
        companyId: connection.company_id,
        now,
      },
      SYNC_BUDGET_MS
    );

    const failures = results.filter((r) => r.error);
    await supabase
      .from('business_central_connections')
      .update({
        last_pulled_at: now,
        last_error: failures.length ? failures.map((f) => `${f.entityType}: ${f.error}`).join('; ') : null,
        sync_in_progress_by: null,
        sync_in_progress_since: null,
        sync_in_progress_timeout_at: null,
        updated_at: now,
      })
      .eq('id', connection.id);

    revalidatePath('/customers');
    revalidatePath('/receivables');
    revalidatePath('/receivables/invoices');
    return results;
  } catch (error) {
    await supabase
      .from('business_central_connections')
      .update({
        last_error: error instanceof Error ? error.message : 'Receivables sync failed',
        sync_in_progress_by: null,
        sync_in_progress_since: null,
        sync_in_progress_timeout_at: null,
        updated_at: now,
      })
      .eq('id', connection.id);
    throw error;
  }
}

export async function getReceivablesSyncStatus(): Promise<BusinessCentralSyncCheckpoint[]> {
  const { orgId, user } = await requirePermission(
    canViewReceivables,
    'You do not have permission to view receivables'
  );
  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) return [];

  const { data } = await supabase
    .from('business_central_sync_checkpoints')
    .select('*')
    .eq('bc_connection_id', connection.id);

  return (data ?? []) as BusinessCentralSyncCheckpoint[];
}

export type { SyncEntityResult, SyncEntityType };
