'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/currentUserAccess';
import {
  canEditBusinessCentralItems,
  canViewCustomers,
  canViewReceivables,
} from '@/lib/auth/permissions';
import { resolveActiveBcConnection } from '@/lib/businessCentral/activeConnection';
import type { AgingRow } from '@/lib/businessCentral/agingSummary';
import { buildArSyncAdapters } from '@/lib/businessCentral/arSyncAdapters';
import { createBcClientForOrg } from '@/lib/businessCentral/client';
import { createCustomerLedgerClientForOrg } from '@/lib/businessCentral/customerLedgerClient';
import {
  runAllEntitySyncs,
  type CheckpointStore,
  type SyncEntityResult,
} from '@/lib/businessCentral/syncRunner';
import { createServiceClient } from '@/lib/supabase/server';
import {
  BusinessCentralCustomer,
  BusinessCentralCustomerLedgerEntry,
  BusinessCentralSalesInvoice,
  BusinessCentralSyncCheckpoint,
  SyncEntityType,
} from '@/types/database';

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
      const now = new Date().toISOString();
      const { error } = await supabase.from('business_central_sync_checkpoints').upsert(
        {
          organization_id: organizationId,
          bc_connection_id: connectionId,
          entity_type: entityType,
          phase: 'backfill',
          cursor_value: patch.cursor_value,
          records_synced: patch.records_synced,
          last_error: patch.last_error,
          completed_full_pass: patch.complete,
          // Only stamp completion time when this write actually finished a full
          // pass; an incomplete write must leave the previous completion time
          // untouched rather than clearing or refreshing it.
          ...(patch.complete ? { last_completed_at: now } : {}),
          updated_at: now,
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

export async function getCustomersPageData(): Promise<{
  customers: BusinessCentralCustomer[];
  canSync: boolean;
}> {
  const { orgId, user, access } = await requirePermission(
    canViewCustomers,
    'You do not have permission to view customers'
  );
  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) return { customers: [], canSync: false };

  const { data } = await supabase
    .from('business_central_customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', connection.id)
    .order('display_name', { ascending: true });

  return {
    customers: (data ?? []) as BusinessCentralCustomer[],
    canSync: canEditBusinessCentralItems(access),
  };
}

export async function getCustomerDetail(id: string): Promise<{
  customer: BusinessCentralCustomer;
  invoices: BusinessCentralSalesInvoice[];
  ledgerEntries: BusinessCentralCustomerLedgerEntry[];
} | null> {
  const { orgId, user } = await requirePermission(
    canViewCustomers,
    'You do not have permission to view customers'
  );
  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) return null;

  const { data: customer } = await supabase
    .from('business_central_customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', connection.id)
    .eq('id', id)
    .maybeSingle();

  if (!customer) return null;

  const [{ data: invoices }, ledgerResult] = await Promise.all([
    supabase
      .from('business_central_sales_invoices')
      .select('*')
      .eq('organization_id', orgId)
      .eq('bc_connection_id', connection.id)
      .eq('bc_customer_id', customer.bc_customer_id)
      .order('posting_date', { ascending: false, nullsFirst: false }),
    // Guard: A null or empty customer number cannot legitimately match ledger entries
    // by number, and querying for empty string ('') would incorrectly return orphaned
    // ledger rows whose customer_no was stored as empty. Return empty results instead.
    customer.bc_customer_number?.trim()
      ? supabase
          .from('business_central_customer_ledger_entries')
          .select('*')
          .eq('organization_id', orgId)
          .eq('bc_connection_id', connection.id)
          .eq('customer_no', customer.bc_customer_number)
          .order('posting_date', { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] as BusinessCentralCustomerLedgerEntry[] }),
  ]);

  return {
    customer: customer as BusinessCentralCustomer,
    invoices: (invoices ?? []) as BusinessCentralSalesInvoice[],
    ledgerEntries: (ledgerResult.data ?? []) as BusinessCentralCustomerLedgerEntry[],
  };
}

export async function getAgingPageData(): Promise<{ rows: AgingRow[]; asOfDate: string | null }> {
  const { orgId, user } = await requirePermission(
    canViewReceivables,
    'You do not have permission to view receivables'
  );
  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) return { rows: [], asOfDate: null };

  const { data } = await supabase
    .from('business_central_ar_aging')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', connection.id)
    .order('days_overdue', { ascending: false });

  const rows = (data ?? []) as AgingRow[];
  return { rows, asOfDate: rows[0]?.as_of_date ?? null };
}

export async function getSalesInvoicesPageData(): Promise<{
  invoices: BusinessCentralSalesInvoice[];
}> {
  const { orgId, user } = await requirePermission(
    canViewReceivables,
    'You do not have permission to view receivables'
  );
  const supabase = createServiceClient();
  const connection = await resolveActiveBcConnection(orgId, user.id);
  if (!connection) return { invoices: [] };

  const { data } = await supabase
    .from('business_central_sales_invoices')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', connection.id)
    // nullsFirst: false ensures NULLs sort last on DESC, preventing null posting_dates
    // from consuming result slots and pushing recent invoices out of the top 500.
    .order('posting_date', { ascending: false, nullsFirst: false })
    .limit(500);

  return { invoices: (data ?? []) as BusinessCentralSalesInvoice[] };
}

export type { SyncEntityResult, SyncEntityType };
