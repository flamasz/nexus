import { SyncEntityType } from '@/types/database';

export interface SyncContext {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  now: string;
}

export interface SyncEntityAdapter<TRemote> {
  entityType: SyncEntityType;
  table: string;
  conflictTarget: string;
  pageSize: number;
  /**
   * Fetch the next page of records strictly after `cursor`, ordered by the
   * cursor field ascending. A short page signals the end of the feed.
   */
  fetchPage(cursor: string | null, top: number): Promise<TRemote[]>;
  map(ctx: SyncContext, remote: TRemote): Record<string, unknown>;
  cursorValue(remote: TRemote): string;
}

export interface SyncEntityResult {
  entityType: SyncEntityType;
  recordsSynced: number;
  complete: boolean;
  cursor: string | null;
  error: string | null;
}

export interface CheckpointStore {
  read(
    connectionId: string,
    entityType: SyncEntityType
  ): Promise<{ cursor_value: string | null; records_synced: number } | null>;
  write(
    connectionId: string,
    entityType: SyncEntityType,
    patch: { cursor_value: string | null; records_synced: number; last_error: string | null }
  ): Promise<void>;
}

export interface SyncRunnerDeps {
  checkpoints: CheckpointStore;
  upsert(
    table: string,
    rows: Record<string, unknown>[],
    conflictTarget: string
  ): Promise<void>;
  nowMs(): number;
}

/**
 * Pull one entity from Business Central, resuming from its stored keyset cursor
 * and stopping when the time budget is spent.
 *
 * The cursor is a single field value, so records sharing a cursor value at a page
 * boundary may be fetched again on resume. That is safe: every write is an
 * idempotent upsert on a stable conflict target.
 *
 * Progress is never rolled back on failure — a fault costs the current page, not
 * the whole run.
 */
export async function runEntitySync<TRemote>(
  deps: SyncRunnerDeps,
  adapter: SyncEntityAdapter<TRemote>,
  ctx: SyncContext,
  budgetMs: number
): Promise<SyncEntityResult> {
  const started = deps.nowMs();
  const checkpoint = await deps.checkpoints.read(ctx.connectionId, adapter.entityType);

  let cursor = checkpoint?.cursor_value ?? null;
  let recordsSynced = 0;
  let complete = false;

  try {
    for (;;) {
      const page = await adapter.fetchPage(cursor, adapter.pageSize);

      if (page.length === 0) {
        complete = true;
        break;
      }

      const rows = page.map((remote) => adapter.map(ctx, remote));
      await deps.upsert(adapter.table, rows, adapter.conflictTarget);

      cursor = adapter.cursorValue(page[page.length - 1]);
      recordsSynced += page.length;

      await deps.checkpoints.write(ctx.connectionId, adapter.entityType, {
        cursor_value: cursor,
        records_synced: (checkpoint?.records_synced ?? 0) + recordsSynced,
        last_error: null,
      });

      if (page.length < adapter.pageSize) {
        complete = true;
        break;
      }

      if (deps.nowMs() - started >= budgetMs) {
        break;
      }
    }

    return { entityType: adapter.entityType, recordsSynced, complete, cursor, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';

    await deps.checkpoints.write(ctx.connectionId, adapter.entityType, {
      cursor_value: cursor,
      records_synced: (checkpoint?.records_synced ?? 0) + recordsSynced,
      last_error: message,
    });

    return {
      entityType: adapter.entityType,
      recordsSynced,
      complete: false,
      cursor,
      error: message,
    };
  }
}

/**
 * Run adapters in order, sharing one overall time budget.
 *
 * One entity failing never stops the others: a missing customer ledger OData page
 * must not block customer and invoice sync.
 */
export async function runAllEntitySyncs(
  deps: SyncRunnerDeps,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapters: SyncEntityAdapter<any>[],
  ctx: SyncContext,
  budgetMs: number
): Promise<SyncEntityResult[]> {
  const started = deps.nowMs();
  const results: SyncEntityResult[] = [];

  for (const adapter of adapters) {
    const remaining = budgetMs - (deps.nowMs() - started);
    results.push(await runEntitySync(deps, adapter, ctx, Math.max(remaining, 0)));
  }

  return results;
}
