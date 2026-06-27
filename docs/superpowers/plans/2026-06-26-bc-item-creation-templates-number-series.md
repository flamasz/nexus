# BC Item Creation — Templates + Number Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create Business Central items from Nexus using saved templates and per-category auto-numbering that drives BC's real No. Series counter.

**Architecture:** BC's published `NoSeriesLines` OData page stays the live counter; Nexus reads it, computes the next number, creates the item in BC with that explicit number, then advances the counter (create-then-advance). Numbering logic is split into pure formatting utils, a thin OData client, and a `NumberAssigner` strategy so a future AL `GetNextNo` can replace it. Templates are a saved bundle of `BcItemCreatePayload` defaults keyed to a packaging category.

**Tech Stack:** Next.js 15 (App Router) Server Actions, TypeScript, Supabase (Postgres), Vitest, React.

## Global Constraints

- Test runner is **Vitest**; run with `npm run test` (from `nexus/`). Tests are co-located as `*.test.ts(x)` next to source (e.g. `client.test.ts`).
- All new data is **BC-environment scoped** via `bc_connection_id` + `organization_id`, matching `categories`/`business_central_items`.
- Server actions live in `nexus/src/app/actions/`; they use `createServiceClient()` and `revalidatePath('/items')`, and gate access via the existing `requireBcEdit()` / `requireBcView()` helpers in `businessCentralItems.ts`.
- The BC client factory is `createBcClientForOrg(orgId, connectionId)` in `nexus/src/lib/businessCentral/client.ts`. Do not re-implement credential/Vault plumbing.
- **Only `Implementation = "Normal"` series may be auto-assigned.** If a mapped series reports any other implementation, refuse auto-assign and fall back to manual entry.
- Nexus must enforce, because BC's OData page does not: **advance-only** (never lower `Last_No_Used`), **within `Starting_No`..`Ending_No`**, and **set `Last_Date_Used` explicitly**.
- Number format basis: prefix + zero-padded digits derived from the series line's `Starting_No`; increment by `Increment_by_No`.
- All file paths below are relative to the repo root; source lives under `nexus/`.

---

### Task 1: Database migrations + types

**Files:**
- Create: `nexus/supabase/migrations/038_add_category_no_series.sql`
- Create: `nexus/supabase/migrations/039_add_item_templates.sql`
- Modify: `nexus/src/types/database.ts` (add `bc_no_series_code` to `Category`; add `ItemTemplate` interface + `item_templates` table entry)

**Interfaces:**
- Produces: `Category.bc_no_series_code: string | null`; `ItemTemplate` type (see Step 3); table name `item_templates`.

- [ ] **Step 1: Write migration 038**

```sql
-- 038_add_category_no_series.sql
-- Map each packaging category to a BC No. Series code (per-environment via existing bc_connection_id).
alter table public.categories
  add column if not exists bc_no_series_code text;

comment on column public.categories.bc_no_series_code is
  'BC No. Series code this packaging category auto-assigns item numbers from. NULL = manual numbering.';
```

- [ ] **Step 2: Write migration 039**

```sql
-- 039_add_item_templates.sql
-- Saved bundles of default BC item fields, keyed to a packaging category.
create table if not exists public.item_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid references public.business_central_connections(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  bc_item_category_code text,
  default_type text not null default 'Inventory',
  base_unit_of_measure_code text,
  tax_group_code text,
  general_product_posting_group_code text,
  inventory_posting_group_code text,
  price_includes_tax boolean not null default false,
  blocked boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists item_templates_org_conn_idx
  on public.item_templates (organization_id, bc_connection_id);

alter table public.item_templates enable row level security;

-- Mirror the RLS pattern used by categories/business_central_items: members of the
-- organization can read; writes go through service-role server actions.
create policy item_templates_select on public.item_templates
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
```

> Before writing the policy, open an existing recent migration that adds a table (e.g. `037_add_barcode_files.sql`) and copy its exact RLS pattern/helper. If that file uses a membership helper function instead of the subquery above, use the same helper for consistency.

- [ ] **Step 3: Add types in `database.ts`**

Add to the `Category` interface a new field:

```typescript
  bc_no_series_code: string | null;
```

Add a new exported interface near the other entity interfaces:

```typescript
export interface ItemTemplate {
  id: string;
  organization_id: string | null;
  bc_connection_id: string | null;
  name: string;
  description: string | null;
  category_id: string | null;
  bc_item_category_code: string | null;
  default_type: string;
  base_unit_of_measure_code: string | null;
  tax_group_code: string | null;
  general_product_posting_group_code: string | null;
  inventory_posting_group_code: string | null;
  price_includes_tax: boolean;
  blocked: boolean;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

Add an `item_templates` entry to the `Database['public']['Tables']` map, following the existing `categories` entry shape:

```typescript
      item_templates: {
        Row: ItemTemplate;
        Insert: Omit<ItemTemplate, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItemTemplate, "id">>;
      };
```

- [ ] **Step 4: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: no errors related to `ItemTemplate` / `bc_no_series_code`.

- [ ] **Step 5: Commit**

```bash
git add nexus/supabase/migrations/038_add_category_no_series.sql nexus/supabase/migrations/039_add_item_templates.sql nexus/src/types/database.ts
git commit -m "feat(db): add category no-series mapping and item_templates table"
```

---

### Task 2: Number formatting utilities (pure)

**Files:**
- Create: `nexus/src/lib/businessCentral/numberSeries.ts`
- Test: `nexus/src/lib/businessCentral/numberSeries.test.ts`

**Interfaces:**
- Produces:
  - `parseNoFormat(sample: string): { prefix: string; pad: number; suffix: string } | null`
  - `incrementNo(current: string, increment: number, startingNo: string): string`
  - `compareNo(a: string, b: string): number` (−1/0/1, numeric-aware when prefixes match)
  - `isWithinRange(candidate: string, startingNo: string, endingNo: string): boolean`

- [ ] **Step 1: Write the failing tests**

```typescript
// numberSeries.test.ts
import { describe, expect, it } from 'vitest';
import { parseNoFormat, incrementNo, compareNo, isWithinRange } from './numberSeries';

describe('parseNoFormat', () => {
  it('splits prefix, pad width, and suffix', () => {
    expect(parseNoFormat('NX000001')).toEqual({ prefix: 'NX', pad: 6, suffix: '' });
    expect(parseNoFormat('CHOC0001')).toEqual({ prefix: 'CHOC', pad: 4, suffix: '' });
    expect(parseNoFormat('A00001-X')).toEqual({ prefix: 'A', pad: 5, suffix: '-X' });
  });
  it('returns null when there is no digit run', () => {
    expect(parseNoFormat('ABC')).toBeNull();
  });
});

describe('incrementNo', () => {
  it('returns startingNo when current is empty', () => {
    expect(incrementNo('', 1, 'NX000001')).toBe('NX000001');
  });
  it('increments preserving prefix and pad width', () => {
    expect(incrementNo('NX000005', 1, 'NX000001')).toBe('NX000006');
    expect(incrementNo('CHOC0041', 1, 'CHOC0001')).toBe('CHOC0042');
  });
  it('honors a custom increment', () => {
    expect(incrementNo('NX000010', 5, 'NX000001')).toBe('NX000015');
  });
  it('grows pad width when digits overflow', () => {
    expect(incrementNo('NX999999', 1, 'NX000001')).toBe('NX1000000');
  });
});

describe('compareNo', () => {
  it('compares numerically when prefixes match', () => {
    expect(compareNo('NX000010', 'NX000009')).toBe(1);
    expect(compareNo('NX000009', 'NX000010')).toBe(-1);
    expect(compareNo('NX000010', 'NX000010')).toBe(0);
  });
});

describe('isWithinRange', () => {
  it('accepts a candidate inside the range', () => {
    expect(isWithinRange('NX000500', 'NX000001', 'NX999999')).toBe(true);
  });
  it('rejects a candidate past the end', () => {
    expect(isWithinRange('NX1000000', 'NX000001', 'NX999999')).toBe(false);
  });
  it('rejects a different prefix (out of range)', () => {
    expect(isWithinRange('ZZ000001', 'NX000001', 'NX999999')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/numberSeries.test.ts`
Expected: FAIL — module not found / functions not defined.

- [ ] **Step 3: Implement `numberSeries.ts`**

```typescript
// numberSeries.ts
// Pure helpers for BC-style number formatting: prefix + zero-padded digits + optional suffix.

const NO_FORMAT = /^(.*?)(\d+)(\D*)$/;

export function parseNoFormat(
  sample: string,
): { prefix: string; pad: number; suffix: string } | null {
  const match = NO_FORMAT.exec(sample ?? '');
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  return { prefix, pad: digits.length, suffix };
}

export function incrementNo(current: string, increment: number, startingNo: string): string {
  if (!current) return startingNo;
  const format = parseNoFormat(current) ?? parseNoFormat(startingNo);
  if (!format) return startingNo;
  const digits = NO_FORMAT.exec(current)?.[2] ?? '0';
  const nextValue = Number.parseInt(digits, 10) + increment;
  const padded = String(nextValue).padStart(format.pad, '0');
  return `${format.prefix}${padded}${format.suffix}`;
}

function numericPart(value: string): number {
  return Number.parseInt(NO_FORMAT.exec(value)?.[2] ?? '0', 10);
}
function prefixPart(value: string): string {
  return NO_FORMAT.exec(value)?.[1] ?? value;
}

export function compareNo(a: string, b: string): number {
  if (prefixPart(a) === prefixPart(b)) {
    const na = numericPart(a);
    const nb = numericPart(b);
    return na === nb ? 0 : na < nb ? -1 : 1;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

export function isWithinRange(candidate: string, startingNo: string, endingNo: string): boolean {
  if (prefixPart(candidate) !== prefixPart(startingNo)) return false;
  return compareNo(candidate, startingNo) >= 0 && compareNo(candidate, endingNo) <= 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/numberSeries.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/numberSeries.ts nexus/src/lib/businessCentral/numberSeries.test.ts
git commit -m "feat(bc): add pure number-series formatting utilities"
```

---

### Task 3: No. Series OData client

**Files:**
- Create: `nexus/src/lib/businessCentral/noSeriesClient.ts`
- Test: `nexus/src/lib/businessCentral/noSeriesClient.test.ts`

**Interfaces:**
- Consumes: `BcClient` (from `client.ts`) for `getAccessToken()` and `config` (`environment`, `apiBaseUrl`, `companyId`).
- Produces:
  - `interface BcNoSeriesLine { seriesCode: string; lineNo: number; startingNo: string; endingNo: string; lastNoUsed: string; lastDateUsed: string; incrementByNo: number; implementation: string; open: boolean; etag: string; }`
  - `interface NoSeriesClient { getOpenLine(seriesCode: string): Promise<BcNoSeriesLine | null>; advanceLine(line: BcNoSeriesLine, newLastNoUsed: string, lastDateUsed: string): Promise<BcNoSeriesLine>; }`
  - `createNoSeriesClient(bcClient: BcClient, companyName: string, fetchImpl?: typeof fetch): NoSeriesClient`
  - `createNoSeriesClientForOrg(orgId: string, connectionId?: string): Promise<NoSeriesClient>`

- [ ] **Step 1: Write the failing tests**

```typescript
// noSeriesClient.test.ts
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
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
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
    const [, init] = fetchImpl.mock.calls[0];
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as Record<string, Record<string, string>>).headers['If-Match']).toBe('W/"abc"');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ Last_No_Used: 'NX000006', Last_Date_Used: '2026-06-26' });
  });

  it('throws a typed conflict error on 409', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":{"code":"Request_EntityChanged"}}', { status: 409 }));
    const client = createNoSeriesClient(fakeBcClient(), 'C', fetchImpl as unknown as typeof fetch);
    const line = { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '0001-01-01', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'W/"abc"' };
    await expect(client.advanceLine(line, 'NX000006', '2026-06-26')).rejects.toThrow(/conflict/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/noSeriesClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `noSeriesClient.ts`**

```typescript
// noSeriesClient.ts
import { createBcClientForOrg, type BcClient } from './client';

export interface BcNoSeriesLine {
  seriesCode: string;
  lineNo: number;
  startingNo: string;
  endingNo: string;
  lastNoUsed: string;
  lastDateUsed: string;
  incrementByNo: number;
  implementation: string;
  open: boolean;
  etag: string;
}

export class NoSeriesConflictError extends Error {
  constructor() {
    super('No. Series line changed concurrently (conflict)');
    this.name = 'NoSeriesConflictError';
  }
}

export interface NoSeriesClient {
  getOpenLine(seriesCode: string): Promise<BcNoSeriesLine | null>;
  advanceLine(line: BcNoSeriesLine, newLastNoUsed: string, lastDateUsed: string): Promise<BcNoSeriesLine>;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function mapLine(row: Record<string, unknown>): BcNoSeriesLine {
  return {
    seriesCode: String(row.Series_Code),
    lineNo: Number(row.Line_No),
    startingNo: String(row.Starting_No ?? ''),
    endingNo: String(row.Ending_No ?? ''),
    lastNoUsed: String(row.Last_No_Used ?? ''),
    lastDateUsed: String(row.Last_Date_Used ?? ''),
    incrementByNo: Number(row.Increment_by_No ?? 1),
    implementation: String(row.Implementation ?? 'Normal'),
    open: Boolean(row.Open),
    etag: String(row['@odata.etag'] ?? ''),
  };
}

export function createNoSeriesClient(
  bcClient: BcClient,
  companyName: string,
  fetchImpl: typeof fetch = fetch,
): NoSeriesClient {
  const base = `${trimTrailingSlash(bcClient.config.apiBaseUrl ?? 'https://api.businesscentral.dynamics.com')}/v2.0/${encodeURIComponent(bcClient.config.environment)}/ODataV4/Company('${encodeURIComponent(companyName)}')`;

  async function authHeader(): Promise<string> {
    const token = await bcClient.getAccessToken();
    return `${token.tokenType} ${token.accessToken}`;
  }

  async function getOpenLine(seriesCode: string): Promise<BcNoSeriesLine | null> {
    const url = `${base}/NoSeriesLines?$filter=${encodeURIComponent(`Series_Code eq '${seriesCode}'`)}`;
    const res = await fetchImpl(url, { headers: { Authorization: await authHeader(), Accept: 'application/json' } });
    if (!res.ok) throw new Error(`No. Series read failed: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as { value?: Record<string, unknown>[] };
    const rows = (json.value ?? []).map(mapLine);
    if (rows.length === 0) return null;
    return rows.find((r) => r.open) ?? rows[0];
  }

  async function advanceLine(line: BcNoSeriesLine, newLastNoUsed: string, lastDateUsed: string): Promise<BcNoSeriesLine> {
    const key = `${base}/NoSeriesLines(Series_Code='${encodeURIComponent(line.seriesCode)}',Line_No=${line.lineNo})`;
    const res = await fetchImpl(key, {
      method: 'PATCH',
      headers: { Authorization: await authHeader(), Accept: 'application/json', 'Content-Type': 'application/json', 'If-Match': line.etag },
      body: JSON.stringify({ Last_No_Used: newLastNoUsed, Last_Date_Used: lastDateUsed }),
    });
    if (res.status === 409 || res.status === 412) throw new NoSeriesConflictError();
    if (!res.ok) throw new Error(`No. Series advance failed: ${res.status} ${res.statusText}`);
    return mapLine((await res.json()) as Record<string, unknown>);
  }

  return { getOpenLine, advanceLine };
}

export async function createNoSeriesClientForOrg(orgId: string, connectionId?: string): Promise<NoSeriesClient> {
  const bcClient = await createBcClientForOrg(orgId, connectionId);
  const company = await bcClient.getCompany(bcClient.config.companyId);
  // BC OData company key uses the Company.Name (short name), not displayName.
  return createNoSeriesClient(bcClient, company.name);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/noSeriesClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/noSeriesClient.ts nexus/src/lib/businessCentral/noSeriesClient.test.ts
git commit -m "feat(bc): add No. Series OData client (read line + advance counter)"
```

---

### Task 4: NumberAssigner strategy

**Files:**
- Create: `nexus/src/lib/businessCentral/numberAssigner.ts`
- Test: `nexus/src/lib/businessCentral/numberAssigner.test.ts`

**Interfaces:**
- Consumes: `NoSeriesClient`, `BcNoSeriesLine`, `NoSeriesConflictError` (Task 3); `incrementNo`, `isWithinRange`, `compareNo` (Task 2).
- Produces:
  - `interface PreparedNumber { seriesCode: string; candidate: string; line: BcNoSeriesLine; }`
  - `interface NumberAssigner { prepare(seriesCode: string): Promise<PreparedNumber>; bump(prepared: PreparedNumber): PreparedNumber; commit(prepared: PreparedNumber, usedNumber: string, today?: string): Promise<void>; }`
  - `class SeriesNotNormalError extends Error`, `class SeriesExhaustedError extends Error`, `class SeriesNotFoundError extends Error`
  - `createBcNoSeriesAssigner(noSeries: NoSeriesClient): NumberAssigner`

- [ ] **Step 1: Write the failing tests**

```typescript
// numberAssigner.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createBcNoSeriesAssigner, SeriesNotNormalError, SeriesExhaustedError, SeriesNotFoundError } from './numberAssigner';
import { NoSeriesConflictError, type BcNoSeriesLine, type NoSeriesClient } from './noSeriesClient';

function line(over: Partial<BcNoSeriesLine> = {}): BcNoSeriesLine {
  return { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '0001-01-01', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'W/"abc"', ...over };
}

describe('prepare', () => {
  it('computes the next candidate from Last_No_Used', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine: vi.fn() };
    const prepared = await createBcNoSeriesAssigner(ns).prepare('S');
    expect(prepared.candidate).toBe('NX000006');
  });
  it('starts from Starting_No when Last_No_Used is empty', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: '' }), advanceLine: vi.fn() };
    expect((await createBcNoSeriesAssigner(ns).prepare('S')).candidate).toBe('NX000001');
  });
  it('throws SeriesNotFoundError when there is no line', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => null, advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesNotFoundError);
  });
  it('throws SeriesNotNormalError for Sequence series', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ implementation: 'Sequence' }), advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesNotNormalError);
  });
  it('throws SeriesExhaustedError when candidate exceeds Ending_No', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: 'NX999999' }), advanceLine: vi.fn() };
    await expect(createBcNoSeriesAssigner(ns).prepare('S')).rejects.toThrow(SeriesExhaustedError);
  });
});

describe('bump', () => {
  it('advances the candidate by the increment', async () => {
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine: vi.fn() };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S');
    expect(a.bump(p).candidate).toBe('NX000007');
  });
});

describe('commit', () => {
  it('advances only forward and stamps the date', async () => {
    const advanceLine = vi.fn(async () => line());
    const ns: NoSeriesClient = { getOpenLine: async () => line(), advanceLine };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S');
    await a.commit(p, 'NX000006', '2026-06-26');
    expect(advanceLine).toHaveBeenCalledWith(p.line, 'NX000006', '2026-06-26');
  });
  it('on conflict, re-reads and re-applies advance-only', async () => {
    const advanceLine = vi.fn()
      .mockRejectedValueOnce(new NoSeriesConflictError())
      .mockResolvedValueOnce(line({ lastNoUsed: 'NX000008' }));
    const ns: NoSeriesClient = { getOpenLine: async () => line({ lastNoUsed: 'NX000007', etag: 'W/"new"' }), advanceLine };
    const a = createBcNoSeriesAssigner(ns);
    const p = await a.prepare('S'); // candidate NX000006
    await a.commit(p, 'NX000006', '2026-06-26');
    // second call uses the re-read line; never lowers below current NX000007
    const secondArgs = advanceLine.mock.calls[1];
    expect((secondArgs[0] as BcNoSeriesLine).lastNoUsed).toBe('NX000007');
    expect(secondArgs[1]).toBe('NX000007'); // keeps the higher existing value
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/numberAssigner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `numberAssigner.ts`**

```typescript
// numberAssigner.ts
import { compareNo, incrementNo, isWithinRange } from './numberSeries';
import { NoSeriesConflictError, type BcNoSeriesLine, type NoSeriesClient } from './noSeriesClient';

export class SeriesNotFoundError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' has no line in BC`); this.name = 'SeriesNotFoundError'; }
}
export class SeriesNotNormalError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' is not Normal (Allow Gaps must be off) — set it to Normal in BC to enable auto-numbering`); this.name = 'SeriesNotNormalError'; }
}
export class SeriesExhaustedError extends Error {
  constructor(seriesCode: string) { super(`No. Series '${seriesCode}' has no numbers left — update its range in BC`); this.name = 'SeriesExhaustedError'; }
}

export interface PreparedNumber {
  seriesCode: string;
  candidate: string;
  line: BcNoSeriesLine;
}

export interface NumberAssigner {
  prepare(seriesCode: string): Promise<PreparedNumber>;
  bump(prepared: PreparedNumber): PreparedNumber;
  commit(prepared: PreparedNumber, usedNumber: string, today?: string): Promise<void>;
}

const MAX_COMMIT_RETRIES = 5;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createBcNoSeriesAssigner(noSeries: NoSeriesClient): NumberAssigner {
  function candidateFor(line: BcNoSeriesLine): string {
    return incrementNo(line.lastNoUsed, line.incrementByNo, line.startingNo);
  }

  async function prepare(seriesCode: string): Promise<PreparedNumber> {
    const line = await noSeries.getOpenLine(seriesCode);
    if (!line) throw new SeriesNotFoundError(seriesCode);
    if (line.implementation !== 'Normal') throw new SeriesNotNormalError(seriesCode);
    const candidate = candidateFor(line);
    if (!isWithinRange(candidate, line.startingNo, line.endingNo)) throw new SeriesExhaustedError(seriesCode);
    return { seriesCode, candidate, line };
  }

  function bump(prepared: PreparedNumber): PreparedNumber {
    const candidate = incrementNo(prepared.candidate, prepared.line.incrementByNo, prepared.line.startingNo);
    if (!isWithinRange(candidate, prepared.line.startingNo, prepared.line.endingNo)) {
      throw new SeriesExhaustedError(prepared.seriesCode);
    }
    return { ...prepared, candidate };
  }

  async function commit(prepared: PreparedNumber, usedNumber: string, today = todayIso()): Promise<void> {
    let line = prepared.line;
    for (let attempt = 0; attempt < MAX_COMMIT_RETRIES; attempt += 1) {
      // advance-only: never lower Last_No_Used below what BC currently holds
      const target = compareNo(usedNumber, line.lastNoUsed) > 0 ? usedNumber : line.lastNoUsed;
      try {
        await noSeries.advanceLine(line, target, today);
        return;
      } catch (error) {
        if (!(error instanceof NoSeriesConflictError)) throw error;
        const fresh = await noSeries.getOpenLine(prepared.seriesCode);
        if (!fresh) throw new SeriesNotFoundError(prepared.seriesCode);
        line = fresh;
      }
    }
    throw new NoSeriesConflictError();
  }

  return { prepare, bump, commit };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/numberAssigner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/numberAssigner.ts nexus/src/lib/businessCentral/numberAssigner.test.ts
git commit -m "feat(bc): add NumberAssigner strategy (prepare/bump/commit with conflict retry)"
```

---

### Task 5: Item template server actions

**Files:**
- Create: `nexus/src/app/actions/itemTemplates.ts`
- Create: `nexus/src/lib/businessCentral/itemTemplateMapper.ts`
- Test: `nexus/src/lib/businessCentral/itemTemplateMapper.test.ts`

**Interfaces:**
- Consumes: `ItemTemplate` (Task 1); `BcItemCreatePayload` shape via `CreateBusinessCentralItemInput` (existing in `businessCentralItems.ts`).
- Produces:
  - `templateToCreateInput(template: ItemTemplate, overrides: { displayName: string; displayName2?: string | null }): Partial<CreateBusinessCentralItemInput>` (pure, in `itemTemplateMapper.ts`)
  - Server actions: `listItemTemplates(): Promise<ItemTemplate[]>`, `createItemTemplate(input): Promise<ItemTemplate>`, `updateItemTemplate(id, input): Promise<ItemTemplate>`, `deleteItemTemplate(id): Promise<void>`

- [ ] **Step 1: Write the failing test for the pure mapper**

```typescript
// itemTemplateMapper.test.ts
import { describe, expect, it } from 'vitest';
import { templateToCreateInput } from './itemTemplateMapper';
import type { ItemTemplate } from '@/types/database';

const template: ItemTemplate = {
  id: 't1', organization_id: 'o', bc_connection_id: 'c', name: 'Chocolate Bar', description: null,
  category_id: 'cat1', bc_item_category_code: 'FINISHED', default_type: 'Inventory',
  base_unit_of_measure_code: 'PCS', tax_group_code: 'FOOD', general_product_posting_group_code: 'RETAIL',
  inventory_posting_group_code: 'RESALE', price_includes_tax: false, blocked: false, is_active: true,
  created_by: null, updated_by: null, created_at: '', updated_at: '',
};

describe('templateToCreateInput', () => {
  it('maps template defaults plus the per-item display name', () => {
    const result = templateToCreateInput(template, { displayName: 'Dark 70%' });
    expect(result).toMatchObject({
      displayName: 'Dark 70%', type: 'Inventory', itemCategoryCode: 'FINISHED',
      baseUnitOfMeasureCode: 'PCS', taxGroupCode: 'FOOD', priceIncludesTax: false,
    });
  });
  it('omits null template fields rather than sending empty strings', () => {
    const bare = { ...template, base_unit_of_measure_code: null, tax_group_code: null };
    const result = templateToCreateInput(bare, { displayName: 'X' });
    expect(result.baseUnitOfMeasureCode).toBeUndefined();
    expect(result.taxGroupCode).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nexus && npx vitest run src/lib/businessCentral/itemTemplateMapper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `itemTemplateMapper.ts`**

```typescript
// itemTemplateMapper.ts
import type { ItemTemplate } from '@/types/database';
import type { CreateBusinessCentralItemInput } from '@/app/actions/businessCentralItems';

export function templateToCreateInput(
  template: ItemTemplate,
  overrides: { displayName: string; displayName2?: string | null },
): Partial<CreateBusinessCentralItemInput> {
  const out: Partial<CreateBusinessCentralItemInput> = {
    displayName: overrides.displayName,
    type: template.default_type,
    priceIncludesTax: template.price_includes_tax,
  };
  if (overrides.displayName2) out.displayName2 = overrides.displayName2;
  if (template.bc_item_category_code) out.itemCategoryCode = template.bc_item_category_code;
  if (template.base_unit_of_measure_code) out.baseUnitOfMeasureCode = template.base_unit_of_measure_code;
  if (template.tax_group_code) out.taxGroupCode = template.tax_group_code;
  return out;
}
```

> If `CreateBusinessCentralItemInput` does not already export `displayName2`/`taxGroupCode`/`baseUnitOfMeasureCode` with these exact names, open `businessCentralItems.ts` (interface at line ~70) and use the actual field names. Adjust the test and mapper together.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nexus && npx vitest run src/lib/businessCentral/itemTemplateMapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the server actions `itemTemplates.ts`**

```typescript
// itemTemplates.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import type { ItemTemplate } from '@/types/database';

export interface ItemTemplateInput {
  name: string;
  description?: string | null;
  categoryId?: string | null;
  bcItemCategoryCode?: string | null;
  defaultType?: string;
  baseUnitOfMeasureCode?: string | null;
  taxGroupCode?: string | null;
  generalProductPostingGroupCode?: string | null;
  inventoryPostingGroupCode?: string | null;
  priceIncludesTax?: boolean;
  blocked?: boolean;
  isActive?: boolean;
}

function toRow(input: ItemTemplateInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    category_id: input.categoryId ?? null,
    bc_item_category_code: input.bcItemCategoryCode ?? null,
    default_type: input.defaultType ?? 'Inventory',
    base_unit_of_measure_code: input.baseUnitOfMeasureCode ?? null,
    tax_group_code: input.taxGroupCode ?? null,
    general_product_posting_group_code: input.generalProductPostingGroupCode ?? null,
    inventory_posting_group_code: input.inventoryPostingGroupCode ?? null,
    price_includes_tax: input.priceIncludesTax ?? false,
    blocked: input.blocked ?? false,
    is_active: input.isActive ?? true,
  };
}

export async function listItemTemplates(): Promise<ItemTemplate[]> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .select('*')
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as ItemTemplate[];
}

export async function createItemTemplate(input: ItemTemplateInput): Promise<ItemTemplate> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .insert({
      ...toRow(input),
      organization_id: scope.orgId,
      bc_connection_id: scope.bcConnectionId,
      created_by: scope.user.id,
      updated_by: scope.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  revalidatePath('/items');
  return data as ItemTemplate;
}

export async function updateItemTemplate(id: string, input: ItemTemplateInput): Promise<ItemTemplate> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .update({ ...toRow(input), updated_by: scope.user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId)
    .select('*')
    .single();
  if (error) throw error;
  revalidatePath('/items');
  return data as ItemTemplate;
}

export async function deleteItemTemplate(id: string): Promise<void> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('item_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId);
  if (error) throw error;
  revalidatePath('/items');
}
```

> Confirm `requireActiveBusinessCentralScope` returns `orgId` and `user` — it spreads `requireOrganizationContext()` (see `environmentScope.ts`). If the context field is named differently (e.g. `organizationId`), match it.

- [ ] **Step 6: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add nexus/src/app/actions/itemTemplates.ts nexus/src/lib/businessCentral/itemTemplateMapper.ts nexus/src/lib/businessCentral/itemTemplateMapper.test.ts
git commit -m "feat(items): add item template CRUD actions and template->payload mapper"
```

---

### Task 6: Wire auto-numbering into item creation

**Files:**
- Modify: `nexus/src/app/actions/businessCentralItems.ts` (the `createBusinessCentralItem` action, ~line 409; and `CreateBusinessCentralItemInput`, ~line 70)
- Test: `nexus/src/app/actions/businessCentralItems.numbering.test.ts`

**Interfaces:**
- Consumes: `createBcNoSeriesAssigner` + error classes (Task 4); `createNoSeriesClientForOrg` (Task 3).
- Produces: `assignAndCreate(opts)` helper (exported for tests) implementing create-then-advance.

- [ ] **Step 1: Add `categoryId` to the create input**

In `CreateBusinessCentralItemInput` (interface ~line 70), add:

```typescript
  categoryId?: string | null; // packaging category; when its category has bc_no_series_code, auto-assign the number
```

- [ ] **Step 2: Write the failing test for `assignAndCreate`**

```typescript
// businessCentralItems.numbering.test.ts
import { describe, expect, it, vi } from 'vitest';
import { assignAndCreate } from './businessCentralItems';
import type { NumberAssigner, PreparedNumber } from '@/lib/businessCentral/numberAssigner';

function preparedStub(candidate: string): PreparedNumber {
  return { seriesCode: 'S', candidate, line: { seriesCode: 'S', lineNo: 1, startingNo: 'NX000001', endingNo: 'NX999999', lastNoUsed: 'NX000005', lastDateUsed: '', incrementByNo: 1, implementation: 'Normal', open: true, etag: 'e' } };
}

describe('assignAndCreate', () => {
  it('creates with the prepared number then commits the advance (create-then-advance)', async () => {
    const order: string[] = [];
    const assigner: NumberAssigner = {
      prepare: async () => { order.push('prepare'); return preparedStub('NX000006'); },
      bump: (p) => p,
      commit: async (_p, used) => { order.push('commit:' + used); },
    };
    const createInBc = vi.fn(async (num: string) => { order.push('create:' + num); return { number: num }; });
    const result = await assignAndCreate({ assigner, seriesCode: 'S', createInBc });
    expect(result.number).toBe('NX000006');
    expect(order).toEqual(['prepare', 'create:NX000006', 'commit:NX000006']);
  });

  it('does NOT commit when BC create fails (no number burned)', async () => {
    const commit = vi.fn();
    const assigner: NumberAssigner = { prepare: async () => preparedStub('NX000006'), bump: (p) => p, commit };
    const createInBc = vi.fn(async () => { throw new Error('BC down'); });
    await expect(assignAndCreate({ assigner, seriesCode: 'S', createInBc })).rejects.toThrow('BC down');
    expect(commit).not.toHaveBeenCalled();
  });

  it('bumps and retries on a duplicate-number create error', async () => {
    const isDuplicate = () => true;
    const assigner: NumberAssigner = {
      prepare: async () => preparedStub('NX000006'),
      bump: (p) => ({ ...p, candidate: 'NX000007' }),
      commit: async () => {},
    };
    const createInBc = vi.fn()
      .mockImplementationOnce(async () => { const e = new Error('exists'); (e as Record<string, unknown>).duplicate = true; throw e; })
      .mockImplementationOnce(async (num: string) => ({ number: num }));
    const result = await assignAndCreate({ assigner, seriesCode: 'S', createInBc, isDuplicate });
    expect(result.number).toBe('NX000007');
    expect(createInBc).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd nexus && npx vitest run src/app/actions/businessCentralItems.numbering.test.ts`
Expected: FAIL — `assignAndCreate` not exported.

- [ ] **Step 4: Implement `assignAndCreate` and wire it into `createBusinessCentralItem`**

Add near the top of `businessCentralItems.ts` (after imports):

```typescript
import { createBcNoSeriesAssigner, type NumberAssigner } from '@/lib/businessCentral/numberAssigner';
import { createNoSeriesClientForOrg } from '@/lib/businessCentral/noSeriesClient';

const MAX_DUPLICATE_RETRIES = 5;

export interface AssignAndCreateOptions {
  assigner: NumberAssigner;
  seriesCode: string;
  createInBc: (assignedNumber: string) => Promise<{ number: string }>;
  isDuplicate?: (error: unknown) => boolean;
}

export async function assignAndCreate(opts: AssignAndCreateOptions): Promise<{ number: string }> {
  const isDuplicate = opts.isDuplicate ?? defaultIsDuplicate;
  let prepared = await opts.assigner.prepare(opts.seriesCode);
  for (let attempt = 0; attempt < MAX_DUPLICATE_RETRIES; attempt += 1) {
    try {
      const created = await opts.createInBc(prepared.candidate);
      await opts.assigner.commit(prepared, created.number);
      return created;
    } catch (error) {
      if (!isDuplicate(error)) throw error; // create failed for another reason → no commit, no number burned
      prepared = opts.assigner.bump(prepared);
    }
  }
  throw new Error(`Could not find a free number in series '${opts.seriesCode}' after ${MAX_DUPLICATE_RETRIES} attempts`);
}

function defaultIsDuplicate(error: unknown): boolean {
  // BcApiError on a duplicate primary key surfaces as 400/409 with a duplicate message.
  const status = (error as { details?: { status?: number; message?: string } })?.details?.status;
  const message = (error as { details?: { message?: string } })?.details?.message ?? '';
  return status === 409 || /already exists|duplicate/i.test(message);
}
```

Then, inside `createBusinessCentralItem`, resolve whether the category has a series and route accordingly. Replace the single `const created = await client.createItem(buildBcCreatePayload(draft));` (~line 464) with:

```typescript
    const client = await createBcClientForOrg(orgId, connection.id);
    const seriesCode = await resolveSeriesCodeForCategory(supabase, orgId, connection.id, input.categoryId ?? null);

    let created;
    if (seriesCode && !input.number) {
      const noSeries = await createNoSeriesClientForOrg(orgId, connection.id);
      const assigner = createBcNoSeriesAssigner(noSeries);
      created = await assignAndCreate({
        assigner,
        seriesCode,
        createInBc: (assignedNumber) =>
          client.createItem(buildBcCreatePayload({ ...draft, bc_item_number: assignedNumber })),
      });
    } else {
      // manual number or no series mapped → today's behavior
      created = await client.createItem(buildBcCreatePayload(draft));
    }
```

Add the helper at the bottom of the file:

```typescript
async function resolveSeriesCodeForCategory(
  supabase: SupabaseClient,
  orgId: string,
  connectionId: string,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null;
  const { data, error } = await supabase
    .from('categories')
    .select('bc_no_series_code')
    .eq('id', categoryId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data?.bc_no_series_code ?? null;
}
```

> Confirm `buildBcCreatePayload` reads the item number from the field named `bc_item_number` on the draft (it does as of `businessCentralItems.ts`); if the draft field name differs, set that field instead. `created.number` is the BC-confirmed number used for the rest of the existing save logic.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd nexus && npx vitest run src/app/actions/businessCentralItems.numbering.test.ts`
Expected: PASS.

- [ ] **Step 6: Full test + typecheck**

Run: `cd nexus && npm run test && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add nexus/src/app/actions/businessCentralItems.ts nexus/src/app/actions/businessCentralItems.numbering.test.ts
git commit -m "feat(items): auto-assign item numbers from BC No. Series on create (create-then-advance)"
```

---

### Task 7: Template management UI (Settings)

**Files:**
- Create: `nexus/src/components/items/ItemTemplatesCard.tsx`
- Modify: `nexus/src/app/(protected)/admin/page.tsx` (render the card next to `BcEnvironmentsCard`)

**Interfaces:**
- Consumes: `listItemTemplates`, `createItemTemplate`, `updateItemTemplate`, `deleteItemTemplate` (Task 5); reference data already loaded for the page (categories, units, tax groups, posting groups).

- [ ] **Step 1: Build the card component**

Create `ItemTemplatesCard.tsx` as a client component (`'use client'`) following the structure of `BcEnvironmentsCard.tsx`:
- Loads templates via `listItemTemplates()` on mount (or accepts them as a prop if the page fetches server-side, matching how `BcEnvironmentsCard` receives its data — check that file and mirror it).
- Renders a list with **name** + the linked **category** and its `bc_no_series_code` (show "manual" when the category has none).
- A **New / Edit** form with: `name`, `description`, a **category** dropdown (the key field — drives the series), `bc_item_category_code` dropdown, `default_type` select (Inventory/Service/Non-Inventory), and dropdowns for `base_unit_of_measure_code`, `tax_group_code`, `general_product_posting_group_code`, `inventory_posting_group_code`, plus `price_includes_tax` / `blocked` checkboxes.
- Wire submit to `createItemTemplate` / `updateItemTemplate`, delete to `deleteItemTemplate`, each followed by a local refresh.
- Populate the dropdowns from the same reference-data source `ItemsClient`/the BC reference registry already exposes (e.g. the `references.itemCategories`, units, tax groups used around `ItemsClient.tsx:1171`). Reuse that data shape; do not refetch a new way.

- [ ] **Step 2: Render the card in the admin page**

In `nexus/src/app/(protected)/admin/page.tsx`, import and render `<ItemTemplatesCard ... />` immediately after `<BcEnvironmentsCard ... />`, passing whatever reference data that page already has (or letting the card load templates itself). Match the existing prop-passing/layout pattern in that file.

- [ ] **Step 3: Verify build + lint**

Run: `cd nexus && npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `cd nexus && npm run dev`, open the admin/settings page, and confirm: create a template, edit it, delete it; the list reflects each change; the category dropdown shows packaging categories and the saved template persists across reload.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/components/items/ItemTemplatesCard.tsx "nexus/src/app/(protected)/admin/page.tsx"
git commit -m "feat(items): add item template management card to admin settings"
```

---

### Task 8: Creation UI — template picker + number preview

**Files:**
- Modify: `nexus/src/components/items/ItemsClient.tsx` (the create-draft form, ~lines 576–588 and 1768–1855)

**Interfaces:**
- Consumes: `listItemTemplates` (Task 5); `templateToCreateInput` (Task 5); the modified `createBusinessCentralItem` accepting `categoryId` (Task 6).

- [ ] **Step 1: Add a template picker to the create form**

In the create-item draft form component (around `ItemsClient.tsx:1768`), add a **Template** `<select>` at the top, populated from `listItemTemplates()` (load once when the form opens). On selection, pre-fill the existing `draft` state from `templateToCreateInput(template, { displayName: draft.displayName })` merged into the current draft, and store the template's `category_id` on the draft as `categoryId`. Every field stays editable after pre-fill.

- [ ] **Step 2: Add the number preview + manual toggle**

Replace the always-manual BC item-number input with this behavior:
- Track `manualNumber: boolean` in the draft (default `false` when the chosen template's category has a series, else `true`).
- When `manualNumber` is `false`: render the number field read-only with helper text `Will be assigned from <seriesCode> on save` (look up the category's `bc_no_series_code` from the categories reference data already in `ItemsClient`). Do **not** call BC for a live preview; the text makes clear the final number is set on save.
- A **"Set manually"** checkbox flips `manualNumber` to `true` and reveals a normal text input that writes `draft.bcItemNumber`.
- When the category has no `bc_no_series_code`, force `manualNumber = true` (today's behavior) and keep the field required.

- [ ] **Step 3: Pass `categoryId` and clear the number on auto-assign**

In the `onCreate` handler (around `ItemsClient.tsx:576`), include `categoryId: draft.categoryId` in the `createBusinessCentralItem(...)` call, and send `number: draft.manualNumber ? draft.bcItemNumber : undefined`. Keep all existing fields (`displayName`, `type`, `itemCategoryCode`, etc.) as they are today.

- [ ] **Step 4: Relax the client-side required-number validation**

The current validation (`ItemsClient.tsx:1790`) requires `bcItemNumber`. Change it so the number is required **only when** `draft.manualNumber` is `true`; otherwise it is optional (BC assigns it).

- [ ] **Step 5: Verify build + lint + tests**

Run: `cd nexus && npm run lint && npx tsc --noEmit && npm run test`
Expected: no errors; existing `ItemsClient.interactions.test.tsx` still passes (update it if it asserted the number field was always required).

- [ ] **Step 6: Manual verification (end-to-end against NEXUS-TEST)**

Run: `cd nexus && npm run dev`. With a packaging category mapped to `bc_no_series_code = 'NEXUS-TEST'`:
1. Open **New item**, pick a template → fields pre-fill, number field shows "Will be assigned from NEXUS-TEST on save".
2. Enter a display name, click **Create**.
3. Confirm the item is created in BC with the next `NX######` number and appears in the list with that final number.
4. In BC, confirm `NEXUS-TEST` line `Last_No_Used` / `Last_Date_Used` advanced.
5. Toggle **Set manually**, create another item with a typed number → confirm it is used and the counter is **not** advanced.
6. Delete the test items in BC and reset `NEXUS-TEST` afterward.

- [ ] **Step 7: Commit**

```bash
git add nexus/src/components/items/ItemsClient.tsx nexus/src/components/items/ItemsClient.interactions.test.tsx
git commit -m "feat(items): template picker and No. Series number preview in item creation"
```

---

## Self-Review

**Spec coverage:**
- Number assignment (read → compute → guards → create → advance) → Tasks 2, 3, 4, 6. ✅
- Normal-vs-Sequence guard → Task 4 `SeriesNotNormalError` (`prepare`). ✅
- Advance-only / range / explicit `Last_Date_Used` → Task 2 (`isWithinRange`), Task 4 (`commit` advance-only), Task 3 (`advanceLine` sets date). ✅
- Pluggable strategy → Task 4 `NumberAssigner` interface; `assignAndCreate` depends on the interface. ✅
- Manual override skips advance → Task 6 routing (`!input.number`) + Task 8 toggle. ✅
- `categories.bc_no_series_code` + `item_templates` → Task 1. ✅
- Templates as `BcItemCreatePayload` defaults → Tasks 1, 5. ✅
- Template management UI → Task 7. Creation UX (picker, preview, manual toggle, no-series fallback) → Task 8. ✅
- Error-handling table (duplicate retry, 409 retry, create-failure no-burn, Sequence refusal, exhausted, no-series manual, web-service unreachable) → Task 4 + Task 6 (`assignAndCreate`, `defaultIsDuplicate`) and surfaced errors. ✅
- Testing strategy (unit formatting, strategy ordering/retries, template mapping, mocked integration) → Tasks 2–6 tests; manual E2E → Task 8. ✅

**Placeholder scan:** No TBD/TODO. UI Tasks 7–8 give concrete field lists, state changes, and exact insertion points rather than full re-listings of the 64k-line `ItemsClient.tsx` (re-pasting it would be noise); each has explicit verification. ✅

**Type consistency:** `BcNoSeriesLine`, `NoSeriesClient`, `PreparedNumber`, `NumberAssigner`, `ItemTemplate`, `assignAndCreate` names/signatures match across Tasks 2–6. `createNoSeriesClientForOrg` uses `bcClient.getCompany(...).name` for the OData company key. ✅

## Notes / assumptions to confirm during execution

- The OData company key uses `Company.Name` (short name). The verified URL used `Hawaii Candy Factory LLC`; if `getCompany().name` differs from `.displayName`, test reads against both and use whichever the published service accepts.
- RLS exact pattern in migration 039 must match the project's existing convention (copy from a recent table migration).
- `requireActiveBusinessCentralScope()` field names (`orgId`, `user.id`, `bcConnectionId`) must match `environmentScope.ts`/`currentUserAccess`.
- Admin vs Settings placement for the templates card: render where `BcEnvironmentsCard` already lives (`admin/page.tsx`).
```
