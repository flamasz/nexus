import { describe, expect, it, vi } from 'vitest';
import {
  runAllEntitySyncs,
  runEntitySync,
  type CheckpointStore,
  type SyncContext,
  type SyncEntityAdapter,
  type SyncRunnerDeps,
} from './syncRunner';
import type { SyncEntityType } from '@/types/database';

interface FakeRecord {
  id: string;
  cursor: string;
}

const ctx: SyncContext = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

interface CheckpointState {
  cursor_value: string | null;
  records_synced: number;
  last_error: string | null;
}

type FakeCheckpointStore = CheckpointStore & {
  /** Every checkpoint ever written, keyed by `${connectionId}:${entityType}`. */
  states: Map<string, CheckpointState>;
  /** The checkpoint for one entity, or a zeroed default if never written. */
  stateFor(entityType: SyncEntityType, connectionId?: string): CheckpointState;
  /** The checkpoint for the default entity used by most tests. */
  readonly state: CheckpointState;
};

/**
 * Checkpoint fake that keys state per `${connectionId}:${entityType}`, exactly
 * like the real store. A flat single-slot fake would let a regression that wrote
 * every entity under the same key pass the whole suite.
 */
function makeCheckpointStore(initial: string | null = null): FakeCheckpointStore {
  const key = (connectionId: string, entityType: SyncEntityType) =>
    `${connectionId}:${entityType}`;
  const states = new Map<string, CheckpointState>();

  const stateFor = (entityType: SyncEntityType, connectionId = ctx.connectionId) =>
    states.get(key(connectionId, entityType)) ?? {
      cursor_value: null,
      records_synced: 0,
      last_error: null,
    };

  return {
    states,
    stateFor,
    get state() {
      return stateFor('customer');
    },
    read: vi.fn(async (connectionId: string, entityType: SyncEntityType) => {
      const existing = states.get(key(connectionId, entityType));
      if (existing) {
        return { cursor_value: existing.cursor_value, records_synced: existing.records_synced };
      }
      // A never-synced entity starts from `initial` so tests can seed a resume point.
      return initial === null ? null : { cursor_value: initial, records_synced: 0 };
    }),
    write: vi.fn(async (connectionId: string, entityType: SyncEntityType, patch) => {
      states.set(key(connectionId, entityType), { ...patch });
    }),
  };
}

function makeDeps(
  checkpoints: CheckpointStore,
  clock: { ms: number } = { ms: 0 }
): SyncRunnerDeps & { upserted: Record<string, unknown>[][] } {
  const upserted: Record<string, unknown>[][] = [];
  return {
    checkpoints,
    upserted,
    upsert: vi.fn(async (_table, rows) => {
      upserted.push(rows);
    }),
    nowMs: () => clock.ms,
  };
}

function makeAdapter(
  pages: FakeRecord[][],
  pageSize = 2,
  entityType: SyncEntityType = 'customer'
): SyncEntityAdapter<FakeRecord> {
  let call = 0;
  return {
    entityType,
    table: 'business_central_customers',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_customer_id',
    pageSize,
    fetchPage: vi.fn(async () => pages[call++] ?? []),
    map: (_c, remote) => ({ bc_customer_id: remote.id }),
    cursorValue: (remote) => remote.cursor,
  };
}

describe('runEntitySync', () => {
  it('pages until exhausted and reports completion', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([
      [
        { id: 'a', cursor: '1' },
        { id: 'b', cursor: '2' },
      ],
      [{ id: 'c', cursor: '3' }],
    ]);

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(true);
    expect(result.recordsSynced).toBe(3);
    expect(result.cursor).toBe('3');
    expect(result.error).toBeNull();
    expect(deps.upserted).toHaveLength(2);
  });

  it('resumes from the stored cursor', async () => {
    const checkpoints = makeCheckpointStore('42');
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([[{ id: 'a', cursor: '43' }]]);

    await runEntitySync(deps, adapter, ctx, 60_000);

    expect(adapter.fetchPage).toHaveBeenCalledWith('42', 2);
  });

  it('stops on the time budget and reports incomplete with progress saved', async () => {
    const checkpoints = makeCheckpointStore();
    const clock = { ms: 0 };
    const deps = makeDeps(checkpoints, clock);
    const adapter = makeAdapter([
      [
        { id: 'a', cursor: '1' },
        { id: 'b', cursor: '2' },
      ],
      [
        { id: 'c', cursor: '3' },
        { id: 'd', cursor: '4' },
      ],
    ]);
    (adapter.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      clock.ms += 40_000;
      return clock.ms <= 40_000
        ? [
            { id: 'a', cursor: '1' },
            { id: 'b', cursor: '2' },
          ]
        : [
            { id: 'c', cursor: '3' },
            { id: 'd', cursor: '4' },
          ];
    });

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(false);
    expect(result.recordsSynced).toBe(4);
    expect(checkpoints.state.cursor_value).toBe('4');
  });

  it('preserves the cursor when a page fails mid-run', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([]);
    (adapter.fetchPage as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        { id: 'a', cursor: '1' },
        { id: 'b', cursor: '2' },
      ])
      .mockRejectedValueOnce(new Error('network blew up'));

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(false);
    expect(result.error).toBe('network blew up');
    expect(result.recordsSynced).toBe(2);
    // The first page's progress survives the failure.
    expect(checkpoints.state.cursor_value).toBe('2');
    expect(checkpoints.state.last_error).toBe('network blew up');
  });

  it('does not upsert an empty page', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([[]]);

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(true);
    expect(deps.upsert).not.toHaveBeenCalled();
  });

  it('clears a stale last_error when a catch-up run finds nothing new', async () => {
    const checkpoints = makeCheckpointStore();
    checkpoints.states.set('conn-1:customer', {
      cursor_value: '42',
      records_synced: 7,
      last_error: 'network blew up',
    });
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([[]]);

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(true);
    expect(result.error).toBeNull();
    expect(checkpoints.write).toHaveBeenCalledWith('conn-1', 'customer', {
      cursor_value: '42',
      records_synced: 7,
      last_error: null,
    });
    expect(checkpoints.state.last_error).toBeNull();
    expect(checkpoints.state.cursor_value).toBe('42');
  });

  it('stops with an explicit error when the cursor never advances', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([]);
    // Full pages whose last cursor value is always the same: without a guard the
    // loop spins until the time budget is spent and never makes progress.
    (adapter.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(async () => [
      { id: 'a', cursor: 'stuck' },
      { id: 'b', cursor: 'stuck' },
    ]);

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.complete).toBe(false);
    expect(result.error).toMatch(/cursor did not advance/i);
    expect(result.error).toContain('customer');
    // Two fetches at most: the first establishes 'stuck', the second detects it.
    expect((adapter.fetchPage as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(2);
    expect(checkpoints.state.last_error).toMatch(/cursor did not advance/i);
  });

  it('returns an error result instead of throwing when the checkpoint read fails', async () => {
    const checkpoints = makeCheckpointStore();
    (checkpoints.read as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('store offline'));
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([[{ id: 'a', cursor: '1' }]]);

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    expect(result.error).toBe('store offline');
    expect(result.complete).toBe(false);
    expect(adapter.fetchPage).not.toHaveBeenCalled();
  });

  it('keeps the original error when the catch-path checkpoint write also fails', async () => {
    const checkpoints = makeCheckpointStore();
    (checkpoints.write as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('checkpoint store offline')
    );
    const deps = makeDeps(checkpoints);
    const adapter = makeAdapter([]);
    (adapter.fetchPage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network blew up'));

    const result = await runEntitySync(deps, adapter, ctx, 60_000);

    // The bookkeeping failure must never mask the real underlying error.
    expect(result.error).toBe('network blew up');
    expect(result.complete).toBe(false);
  });
});

describe('runAllEntitySyncs', () => {
  it('runs every adapter even when one fails', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);

    const failing = makeAdapter([]);
    failing.entityType = 'customer_ledger_entry';
    (failing.fetchPage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('page not published')
    );

    const working = makeAdapter([[{ id: 'a', cursor: '1' }]]);

    const results = await runAllEntitySyncs(deps, [failing, working], ctx, 60_000);

    expect(results).toHaveLength(2);
    expect(results[0].error).toBe('page not published');
    expect(results[1].error).toBeNull();
    expect(results[1].recordsSynced).toBe(1);
  });

  it('returns results in adapter order with matching entity types', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);

    const customers = makeAdapter([[{ id: 'a', cursor: '1' }]], 2, 'customer');
    const ledger = makeAdapter([[{ id: 'b', cursor: '9' }]], 2, 'customer_ledger_entry');

    const results = await runAllEntitySyncs(deps, [ledger, customers], ctx, 60_000);

    expect(results.map((r) => r.entityType)).toEqual(['customer_ledger_entry', 'customer']);
  });

  it('keeps a separate cursor per entity type', async () => {
    const checkpoints = makeCheckpointStore();
    const deps = makeDeps(checkpoints);

    const customers = makeAdapter([[{ id: 'a', cursor: 'cust-9' }]], 2, 'customer');
    const ledger = makeAdapter([[{ id: 'b', cursor: 'ledger-4711' }]], 2, 'customer_ledger_entry');

    await runAllEntitySyncs(deps, [customers, ledger], ctx, 60_000);

    // Neither adapter may overwrite the other's checkpoint.
    expect(checkpoints.stateFor('customer').cursor_value).toBe('cust-9');
    expect(checkpoints.stateFor('customer_ledger_entry').cursor_value).toBe('ledger-4711');
    expect(checkpoints.states.size).toBe(2);
    expect(checkpoints.write).toHaveBeenCalledWith(
      'conn-1',
      'customer',
      expect.objectContaining({ cursor_value: 'cust-9' })
    );
    expect(checkpoints.write).toHaveBeenCalledWith(
      'conn-1',
      'customer_ledger_entry',
      expect.objectContaining({ cursor_value: 'ledger-4711' })
    );
  });

  it('still gives later adapters one page each when the budget is already spent', async () => {
    // Documented, deliberate behaviour: an exhausted budget does not skip
    // adapters — every entity makes minimum progress and advances its checkpoint.
    const checkpoints = makeCheckpointStore();
    const clock = { ms: 0 };
    const deps = makeDeps(checkpoints, clock);

    const hog = makeAdapter([], 2, 'customer');
    (hog.fetchPage as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      clock.ms += 90_000;
      return [
        { id: 'a', cursor: '1' },
        { id: 'b', cursor: '2' },
      ];
    });

    const second = makeAdapter(
      [
        [
          { id: 'c', cursor: '3' },
          { id: 'd', cursor: '4' },
        ],
      ],
      2,
      'customer_ledger_entry'
    );
    const third = makeAdapter(
      [
        [
          { id: 'e', cursor: '5' },
          { id: 'f', cursor: '6' },
        ],
      ],
      2,
      'sales_invoice'
    );

    const results = await runAllEntitySyncs(deps, [hog, second, third], ctx, 60_000);

    expect(results).toHaveLength(3);
    expect(second.fetchPage).toHaveBeenCalledTimes(1);
    expect(third.fetchPage).toHaveBeenCalledTimes(1);
    expect(results[1].recordsSynced).toBe(2);
    expect(results[2].recordsSynced).toBe(2);
  });

  it('runs every adapter even when the checkpoint store itself is broken', async () => {
    // C1 probe: infrastructure trouble usually breaks the fetch *and* the
    // checkpoint write together. Neither may abort the remaining adapters.
    const checkpoints = makeCheckpointStore();
    (checkpoints.write as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('checkpoint store offline')
    );
    const deps = makeDeps(checkpoints);

    const failing = makeAdapter([], 2, 'customer_ledger_entry');
    (failing.fetchPage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('page not published')
    );
    const working = makeAdapter([[{ id: 'a', cursor: '1' }]], 2, 'customer');

    const results = await runAllEntitySyncs(deps, [failing, working], ctx, 60_000);

    expect(results).toHaveLength(2);
    expect(results[0].error).toBe('page not published');
    // The later adapter still ran despite the store throwing on every write.
    expect(working.fetchPage).toHaveBeenCalledTimes(1);
    expect(results[1].error).toBe('checkpoint store offline');
    expect(results[1].entityType).toBe('customer');
  });

  it('runs every adapter even when the checkpoint read is broken', async () => {
    const checkpoints = makeCheckpointStore();
    (checkpoints.read as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('store offline'));
    const deps = makeDeps(checkpoints);

    const first = makeAdapter([[{ id: 'a', cursor: '1' }]], 2, 'customer_ledger_entry');
    const second = makeAdapter([[{ id: 'b', cursor: '2' }]], 2, 'customer');

    const results = await runAllEntitySyncs(deps, [first, second], ctx, 60_000);

    expect(results.map((r) => r.error)).toEqual(['store offline', 'store offline']);
    expect(results.map((r) => r.entityType)).toEqual(['customer_ledger_entry', 'customer']);
  });
});
