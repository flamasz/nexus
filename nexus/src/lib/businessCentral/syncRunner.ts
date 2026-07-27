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

  let checkpoint: { cursor_value: string | null; records_synced: number } | null = null;
  let cursor: string | null = null;
  let recordsSynced = 0;
  let complete = false;

  try {
    // Read inside the try: a checkpoint-store failure must surface as this
    // entity's error result, never as a throw that aborts sibling entities.
    checkpoint = await deps.checkpoints.read(ctx.connectionId, adapter.entityType);
    cursor = checkpoint?.cursor_value ?? null;

    for (;;) {
      const cursorAtFetch = cursor;
      const page = await adapter.fetchPage(cursor, adapter.pageSize);

      if (page.length === 0) {
        // Clear any stale last_error: a clean catch-up run is the steady state
        // and must not leave the entity displaying a previous failure.
        await deps.checkpoints.write(ctx.connectionId, adapter.entityType, {
          cursor_value: cursor,
          records_synced: (checkpoint?.records_synced ?? 0) + recordsSynced,
          last_error: null,
        });
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

      // A full page that leaves the cursor where it started can never make
      // progress: the next fetch would return the same page forever. Surface it
      // loudly rather than burning the whole budget on a silent spin.
      if (cursor === cursorAtFetch) {
        throw new Error(
          `Cursor did not advance for ${adapter.entityType} (stuck at ${
            cursor === null ? 'null' : `"${cursor}"`
          }); aborting to avoid an endless loop`
        );
      }

      if (deps.nowMs() - started >= budgetMs) {
        break;
      }
    }

    return { entityType: adapter.entityType, recordsSynced, complete, cursor, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';

    // Bookkeeping must never mask the real failure. If recording the error also
    // fails (infrastructure trouble usually breaks both), keep the original
    // message and still return a normal error result.
    try {
      await deps.checkpoints.write(ctx.connectionId, adapter.entityType, {
        cursor_value: cursor,
        records_synced: (checkpoint?.records_synced ?? 0) + recordsSynced,
        last_error: message,
      });
    } catch {
      // Intentionally swallowed: the returned error stays the original one.
    }

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
 * must not block customer and invoice sync. Every adapter yields a result, in
 * adapter order, even if it throws unexpectedly.
 *
 * Budget semantics (deliberate): the time budget is checked *after* a page is
 * fetched, upserted and checkpointed, and an exhausted budget does NOT skip the
 * remaining adapters — each still processes exactly one page. That is correct
 * for a manual, resumable sync: every entity makes minimum progress and advances
 * its checkpoint on every invocation. The cost is that worst-case wall time is
 * roughly `budgetMs` plus one page round-trip per adapter, so callers must size
 * `budgetMs` with that much headroom below any serverless execution timeout.
 */
export async function runAllEntitySyncs(
  deps: SyncRunnerDeps,
  adapters: SyncEntityAdapter<unknown>[],
  ctx: SyncContext,
  budgetMs: number
): Promise<SyncEntityResult[]> {
  const started = deps.nowMs();
  const results: SyncEntityResult[] = [];

  for (const adapter of adapters) {
    const remaining = budgetMs - (deps.nowMs() - started);
    try {
      results.push(await runEntitySync(deps, adapter, ctx, Math.max(remaining, 0)));
    } catch (error) {
      // Last line of defence: runEntitySync is not expected to throw, but the
      // headline guarantee is that one entity can never stop the others.
      results.push({
        entityType: adapter.entityType,
        recordsSynced: 0,
        complete: false,
        cursor: null,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }

  return results;
}
