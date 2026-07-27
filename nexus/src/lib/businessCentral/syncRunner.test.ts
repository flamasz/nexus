import { describe, expect, it, vi } from 'vitest';
import {
  runAllEntitySyncs,
  runEntitySync,
  type CheckpointStore,
  type SyncContext,
  type SyncEntityAdapter,
  type SyncRunnerDeps,
} from './syncRunner';

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

function makeCheckpointStore(initial: string | null = null): CheckpointStore & {
  state: { cursor_value: string | null; records_synced: number; last_error: string | null };
} {
  const state = { cursor_value: initial, records_synced: 0, last_error: null as string | null };
  return {
    state,
    read: vi.fn(async () => ({ cursor_value: state.cursor_value, records_synced: state.records_synced })),
    write: vi.fn(async (_c, _e, patch) => {
      state.cursor_value = patch.cursor_value;
      state.records_synced = patch.records_synced;
      state.last_error = patch.last_error;
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

function makeAdapter(pages: FakeRecord[][], pageSize = 2): SyncEntityAdapter<FakeRecord> {
  let call = 0;
  return {
    entityType: 'customer',
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
});
