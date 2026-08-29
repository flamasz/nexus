# Business Central Customer & AR Read Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror Business Central customers, posted sales invoices, invoice lines, and customer ledger entries into Nexus, and surface them as a customer directory, a posted sales invoice list, and an AR aging dashboard.

**Architecture:** Four read-only mirror tables follow the existing `business_central_items` pattern (org + connection + company scoping, `bc_etag`, raw JSONB payload). One shared sync runner handles lock/cursor/upsert/event-logging, with a small adapter per entity. Because sync is manual and history is unbounded, the runner resumes from a persisted keyset cursor and stops on a time budget. Aging is a SQL view exposing `days_overdue` computed in the connection's time zone; bucketing lives in TypeScript.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase/Postgres, vitest, Tailwind.

**Spec:** [`docs/superpowers/specs/2026-07-24-bc-customer-ar-read-sync-design.md`](../specs/2026-07-24-bc-customer-ar-read-sync-design.md)

## Global Constraints

- **Read-only.** No task in this plan writes to Business Central. No task references Bill.com.
- **Migrations are additive and numbered from 041.** Existing migrations 015–040 are already applied; never edit them.
- SQL migrations use the lowercase style of migration `039_add_item_templates.sql` (`create table if not exists public.x`), not the uppercase style of `015`.
- Every new table gets `alter table ... enable row level security` plus an org-scoped select policy matching `item_templates_select`. Writes go through service-role server actions only.
- Test runner is **vitest**. Tests are colocated: `src/lib/x/foo.ts` → `src/lib/x/foo.test.ts`.
- The connection's current date **must** come from `business_central_connections.time_zone` (added in migration 040), never the server clock.
- The published OData service name for ledger entries is exactly **`CustomerLedgerEntries`**, identical in production and TEST.
- Lint and type-check must pass: `npm run lint` and `npx tsc --noEmit`.
- Do not modify `syncBusinessCentralItems`. Converting item sync to the new runner is explicitly out of scope.

## Deviation from the spec (recorded deliberately)

The spec states the aging view derives the bucket (`current` / `1-30` / …). This plan puts **`days_overdue` in the view and bucketing in TypeScript** (Task 2), because duplicating bucket boundaries in both SQL and TS guarantees eventual drift, and bucket boundaries are the part most worth unit-testing. The open-entry set is small by construction (that is what the partial index protects), so aggregating buckets in TS is cheap. "Today" still comes from SQL using the connection time zone, so there remains exactly one definition of each concept.

---

### Task 1: Mirror table migration and TypeScript row types

**Files:**
- Create: `nexus/supabase/migrations/041_add_customer_ar_sync.sql`
- Modify: `nexus/src/types/database.ts` (append new interfaces at end of file)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `business_central_customers`, `business_central_sales_invoices`, `business_central_sales_invoice_lines`, `business_central_customer_ledger_entries`, `business_central_sync_checkpoints`; TS interfaces `BusinessCentralCustomer`, `BusinessCentralSalesInvoice`, `BusinessCentralSalesInvoiceLine`, `BusinessCentralCustomerLedgerEntry`, `BusinessCentralSyncCheckpoint`, and type `SyncEntityType = 'customer' | 'sales_invoice' | 'sales_invoice_line' | 'customer_ledger_entry'`.

- [ ] **Step 1: Write the migration**

Create `nexus/supabase/migrations/041_add_customer_ar_sync.sql`:

```sql
-- 041_add_customer_ar_sync.sql
-- Read-only mirrors of BC customers, posted sales invoices, invoice lines,
-- and customer ledger entries, plus resumable sync checkpoints.

create table if not exists public.business_central_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid references public.business_central_connections(id) on delete cascade,
  bc_environment text not null,
  bc_company_id text not null,
  bc_customer_id text not null,
  bc_customer_number text,
  bc_etag text,
  bc_last_modified_at timestamptz,
  display_name text not null,
  type text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  postal_code text,
  country text,
  phone_number text,
  email text,
  website text,
  currency_id text,
  currency_code text,
  payment_terms_id text,
  payment_method_id text,
  shipment_method_id text,
  tax_liable boolean not null default false,
  tax_area_id text,
  tax_registration_number text,
  blocked text,
  balance numeric,
  overdue_amount numeric,
  bc_raw_payload jsonb not null default '{}'::jsonb,
  sync_status public.business_central_sync_status not null default 'never_synced',
  sync_error text,
  last_synced_at timestamptz,
  last_pulled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, bc_connection_id, bc_company_id, bc_customer_id)
);

create table if not exists public.business_central_sales_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid references public.business_central_connections(id) on delete cascade,
  bc_environment text not null,
  bc_company_id text not null,
  bc_invoice_id text not null,
  bc_invoice_number text,
  external_document_number text,
  bc_etag text,
  bc_last_modified_at timestamptz,
  invoice_date date,
  posting_date date,
  due_date date,
  bc_customer_id text,
  customer_number text,
  customer_name text,
  bill_to_customer_id text,
  bill_to_customer_number text,
  bill_to_name text,
  currency_code text,
  discount_amount numeric,
  total_amount_excluding_tax numeric,
  total_tax_amount numeric,
  total_amount_including_tax numeric,
  status text,
  bc_raw_payload jsonb not null default '{}'::jsonb,
  sync_status public.business_central_sync_status not null default 'never_synced',
  sync_error text,
  last_synced_at timestamptz,
  last_pulled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, bc_connection_id, bc_company_id, bc_invoice_id)
);

create table if not exists public.business_central_sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid references public.business_central_connections(id) on delete cascade,
  bc_environment text not null,
  bc_company_id text not null,
  bc_line_id text not null,
  bc_invoice_id text not null,
  bc_etag text,
  bc_last_modified_at timestamptz,
  sequence integer,
  line_type text,
  line_object_number text,
  description text,
  unit_of_measure_code text,
  quantity numeric,
  unit_price numeric,
  discount_amount numeric,
  discount_percent numeric,
  tax_percent numeric,
  amount_excluding_tax numeric,
  tax_amount numeric,
  amount_including_tax numeric,
  bc_raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, bc_connection_id, bc_company_id, bc_line_id)
);

create table if not exists public.business_central_customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid references public.business_central_connections(id) on delete cascade,
  bc_environment text not null,
  bc_company_id text not null,
  entry_no bigint not null,
  customer_no text not null,
  posting_date date,
  document_type text,
  document_no text,
  description text,
  due_date date,
  currency_code text,
  amount numeric,
  remaining_amount numeric,
  open boolean not null default false,
  closed_at_date date,
  external_document_no text,
  bc_raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, bc_connection_id, bc_company_id, entry_no)
);

create table if not exists public.business_central_sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bc_connection_id uuid not null references public.business_central_connections(id) on delete cascade,
  entity_type text not null,
  phase text not null default 'backfill',
  cursor_value text,
  records_synced bigint not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (bc_connection_id, entity_type)
);

-- Generalize the sync event log beyond items. item_id is left untouched so
-- existing item-sync writes keep working unchanged.
alter table public.business_central_sync_events
  add column if not exists entity_type text,
  add column if not exists entity_id uuid;

create index if not exists bc_customers_org_conn_idx
  on public.business_central_customers (organization_id, bc_connection_id);
create index if not exists bc_customers_number_idx
  on public.business_central_customers (organization_id, bc_connection_id, bc_customer_number);
create index if not exists bc_sales_invoices_org_conn_idx
  on public.business_central_sales_invoices (organization_id, bc_connection_id);
create index if not exists bc_sales_invoices_customer_idx
  on public.business_central_sales_invoices (organization_id, bc_connection_id, bc_customer_id);
create index if not exists bc_sales_invoice_lines_invoice_idx
  on public.business_central_sales_invoice_lines (organization_id, bc_connection_id, bc_invoice_id);
create index if not exists bc_cust_ledger_customer_idx
  on public.business_central_customer_ledger_entries (organization_id, bc_connection_id, customer_no);

-- The open set stays small while closed entries accumulate across full history.
create index if not exists bc_cust_ledger_open_idx
  on public.business_central_customer_ledger_entries (organization_id, bc_connection_id)
  where open;

alter table public.business_central_customers enable row level security;
alter table public.business_central_sales_invoices enable row level security;
alter table public.business_central_sales_invoice_lines enable row level security;
alter table public.business_central_customer_ledger_entries enable row level security;
alter table public.business_central_sync_checkpoints enable row level security;

-- Mirror the RLS pattern used by item_templates: members of the organization
-- can read; writes go through service-role server actions.
create policy bc_customers_select on public.business_central_customers
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
create policy bc_sales_invoices_select on public.business_central_sales_invoices
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
create policy bc_sales_invoice_lines_select on public.business_central_sales_invoice_lines
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
create policy bc_cust_ledger_select on public.business_central_customer_ledger_entries
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
create policy bc_sync_checkpoints_select on public.business_central_sync_checkpoints
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );
```

- [ ] **Step 2: Add the row types**

Append to `nexus/src/types/database.ts`:

```ts
export type SyncEntityType =
  | 'customer'
  | 'sales_invoice'
  | 'sales_invoice_line'
  | 'customer_ledger_entry';

export interface BusinessCentralCustomer {
  id: string;
  organization_id: string;
  bc_connection_id: string | null;
  bc_environment: string;
  bc_company_id: string;
  bc_customer_id: string;
  bc_customer_number: string | null;
  bc_etag: string | null;
  bc_last_modified_at: string | null;
  display_name: string;
  type: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone_number: string | null;
  email: string | null;
  website: string | null;
  currency_id: string | null;
  currency_code: string | null;
  payment_terms_id: string | null;
  payment_method_id: string | null;
  shipment_method_id: string | null;
  tax_liable: boolean;
  tax_area_id: string | null;
  tax_registration_number: string | null;
  blocked: string | null;
  balance: number | null;
  overdue_amount: number | null;
  bc_raw_payload: Record<string, unknown>;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  last_pulled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralSalesInvoice {
  id: string;
  organization_id: string;
  bc_connection_id: string | null;
  bc_environment: string;
  bc_company_id: string;
  bc_invoice_id: string;
  bc_invoice_number: string | null;
  external_document_number: string | null;
  bc_etag: string | null;
  bc_last_modified_at: string | null;
  invoice_date: string | null;
  posting_date: string | null;
  due_date: string | null;
  bc_customer_id: string | null;
  customer_number: string | null;
  customer_name: string | null;
  bill_to_customer_id: string | null;
  bill_to_customer_number: string | null;
  bill_to_name: string | null;
  currency_code: string | null;
  discount_amount: number | null;
  total_amount_excluding_tax: number | null;
  total_tax_amount: number | null;
  total_amount_including_tax: number | null;
  status: string | null;
  bc_raw_payload: Record<string, unknown>;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  last_pulled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralSalesInvoiceLine {
  id: string;
  organization_id: string;
  bc_connection_id: string | null;
  bc_environment: string;
  bc_company_id: string;
  bc_line_id: string;
  bc_invoice_id: string;
  bc_etag: string | null;
  bc_last_modified_at: string | null;
  sequence: number | null;
  line_type: string | null;
  line_object_number: string | null;
  description: string | null;
  unit_of_measure_code: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount_amount: number | null;
  discount_percent: number | null;
  tax_percent: number | null;
  amount_excluding_tax: number | null;
  tax_amount: number | null;
  amount_including_tax: number | null;
  bc_raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralCustomerLedgerEntry {
  id: string;
  organization_id: string;
  bc_connection_id: string | null;
  bc_environment: string;
  bc_company_id: string;
  entry_no: number;
  customer_no: string;
  posting_date: string | null;
  document_type: string | null;
  document_no: string | null;
  description: string | null;
  due_date: string | null;
  currency_code: string | null;
  amount: number | null;
  remaining_amount: number | null;
  open: boolean;
  closed_at_date: string | null;
  external_document_no: string | null;
  bc_raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BusinessCentralSyncCheckpoint {
  id: string;
  organization_id: string;
  bc_connection_id: string;
  entity_type: SyncEntityType;
  phase: 'backfill' | 'delta';
  cursor_value: string | null;
  records_synced: number;
  last_error: string | null;
  updated_at: string;
}
```

- [ ] **Step 3: Type-check**

Run: `cd nexus && npx tsc --noEmit`
Expected: exits 0, no output.

- [ ] **Step 4: Apply the migration to your Supabase project**

Apply `041_add_customer_ar_sync.sql` through the Supabase SQL editor or CLI, the same way migrations 038–040 were applied.
Expected: no errors. Verify with:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'business_central_%'
order by table_name;
```

Expected to include `business_central_customers`, `business_central_sales_invoices`, `business_central_sales_invoice_lines`, `business_central_customer_ledger_entries`, `business_central_sync_checkpoints`.

- [ ] **Step 5: Commit**

```bash
git add nexus/supabase/migrations/041_add_customer_ar_sync.sql nexus/src/types/database.ts
git commit -m "feat(ar): add customer and AR mirror tables with sync checkpoints"
```

---

### Task 2: Aging date and bucket helpers

Pure functions, no I/O. These own the two calculations most likely to be wrong: what "today" is in the connection's time zone, and where a bucket boundary falls.

**Files:**
- Create: `nexus/src/lib/businessCentral/aging.ts`
- Test: `nexus/src/lib/businessCentral/aging.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `todayInTimeZone(timeZone: string | null | undefined, now?: Date): string` returning `YYYY-MM-DD`; `type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'`; `agingBucket(daysOverdue: number | null): AgingBucket`; `AGING_BUCKETS: readonly AgingBucket[]`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/aging.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AGING_BUCKETS, agingBucket, todayInTimeZone } from './aging';

describe('todayInTimeZone', () => {
  it('returns the local date for the given time zone', () => {
    // 2026-03-04T05:00:00Z is still 2026-03-03 in Honolulu (UTC-10).
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone('Pacific/Honolulu', now)).toBe('2026-03-03');
    expect(todayInTimeZone('UTC', now)).toBe('2026-03-04');
  });

  it('falls back to UTC when no time zone is configured', () => {
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone(null, now)).toBe('2026-03-04');
    expect(todayInTimeZone(undefined, now)).toBe('2026-03-04');
  });

  it('falls back to UTC when the time zone is invalid', () => {
    const now = new Date('2026-03-04T05:00:00Z');
    expect(todayInTimeZone('Not/AZone', now)).toBe('2026-03-04');
  });
});

describe('agingBucket', () => {
  it('treats not-yet-due and due-today entries as current', () => {
    expect(agingBucket(-5)).toBe('current');
    expect(agingBucket(0)).toBe('current');
  });

  it('places each boundary in the lower bucket', () => {
    expect(agingBucket(1)).toBe('1-30');
    expect(agingBucket(30)).toBe('1-30');
    expect(agingBucket(31)).toBe('31-60');
    expect(agingBucket(60)).toBe('31-60');
    expect(agingBucket(61)).toBe('61-90');
    expect(agingBucket(90)).toBe('61-90');
    expect(agingBucket(91)).toBe('90+');
  });

  it('treats a missing due date as current', () => {
    expect(agingBucket(null)).toBe('current');
  });

  it('exposes buckets in display order', () => {
    expect(AGING_BUCKETS).toEqual(['current', '1-30', '31-60', '61-90', '90+']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/aging.test.ts`
Expected: FAIL — `Failed to resolve import "./aging"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/aging.ts`:

```ts
export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export const AGING_BUCKETS: readonly AgingBucket[] = [
  'current',
  '1-30',
  '31-60',
  '61-90',
  '90+',
] as const;

/**
 * The current date in the Business Central environment's time zone, as YYYY-MM-DD.
 *
 * Aging must not use the server clock: an invoice due today in Pacific/Honolulu
 * would otherwise read as one day overdue on a UTC server. Mirrors the formatting
 * already used for No. Series date stamping in businessCentralItems.ts.
 */
export function todayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  const zone = timeZone || 'UTC';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now);
  }
}

/**
 * Bucket an entry by how many days past its due date it is.
 * Boundaries land in the lower bucket: 30 days is "1-30", 31 is "31-60".
 */
export function agingBucket(daysOverdue: number | null): AgingBucket {
  if (daysOverdue === null || daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/aging.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/aging.ts nexus/src/lib/businessCentral/aging.test.ts
git commit -m "feat(ar): add time-zone-aware aging date and bucket helpers"
```

---

### Task 3: AR aging view

**Files:**
- Create: `nexus/supabase/migrations/042_add_ar_aging_view.sql`

**Interfaces:**
- Consumes: `business_central_customer_ledger_entries` and `business_central_connections.time_zone` from Task 1.
- Produces: view `business_central_ar_aging` with columns `id`, `organization_id`, `bc_connection_id`, `bc_company_id`, `customer_no`, `document_type`, `document_no`, `posting_date`, `due_date`, `currency_code`, `amount`, `remaining_amount`, `days_overdue`, `as_of_date`.

- [ ] **Step 1: Write the migration**

Create `nexus/supabase/migrations/042_add_ar_aging_view.sql`:

```sql
-- 042_add_ar_aging_view.sql
-- Open customer ledger entries with days_overdue computed in the connection's
-- own time zone. Bucketing lives in TypeScript (src/lib/businessCentral/aging.ts)
-- so the boundaries have exactly one definition.

create or replace view public.business_central_ar_aging as
select
  e.id,
  e.organization_id,
  e.bc_connection_id,
  e.bc_company_id,
  e.customer_no,
  e.document_type,
  e.document_no,
  e.posting_date,
  e.due_date,
  e.currency_code,
  e.amount,
  e.remaining_amount,
  (now() at time zone coalesce(conn.time_zone, 'UTC'))::date as as_of_date,
  case
    when e.due_date is null then null
    else ((now() at time zone coalesce(conn.time_zone, 'UTC'))::date - e.due_date)
  end as days_overdue
from public.business_central_customer_ledger_entries e
join public.business_central_connections conn on conn.id = e.bc_connection_id
where e.open;
```

- [ ] **Step 2: Apply and verify the migration**

Apply `042_add_ar_aging_view.sql` to Supabase, then run:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'business_central_ar_aging'
order by ordinal_position;
```

Expected: includes `days_overdue` and `as_of_date`.

- [ ] **Step 3: Verify the time zone actually applies**

With no rows yet, confirm the date expression differs by zone:

```sql
select (now() at time zone 'UTC')::date as utc_date,
       (now() at time zone 'Pacific/Honolulu')::date as hawaii_date;
```

Expected: between 00:00 and 10:00 UTC these differ by one day. If they are equal, re-run later in the UTC day — the expression is still correct.

- [ ] **Step 4: Commit**

```bash
git add nexus/supabase/migrations/042_add_ar_aging_view.sql
git commit -m "feat(ar): add AR aging view with connection-time-zone days_overdue"
```

---

### Task 4: Customer mapper

**Files:**
- Create: `nexus/src/lib/businessCentral/customerMapper.ts`
- Test: `nexus/src/lib/businessCentral/customerMapper.test.ts`

**Interfaces:**
- Consumes: `BusinessCentralCustomer` from Task 1.
- Produces: `interface BcCustomer` (BC API shape); `interface CustomerUpsertInput { organizationId; connectionId; environment; companyId; customer: BcCustomer; now: string }`; `mapBcCustomerToDb(input: CustomerUpsertInput): Partial<BusinessCentralCustomer>`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/customerMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapBcCustomerToDb, type BcCustomer } from './customerMapper';

const baseCustomer: BcCustomer = {
  id: 'cust-guid-1',
  number: 'C00010',
  displayName: 'Acme Corp',
  type: 'Company',
  addressLine1: '1 Main St',
  addressLine2: '',
  city: 'Honolulu',
  state: 'HI',
  postalCode: '96815',
  country: 'US',
  phoneNumber: '555-0100',
  email: 'ap@acme.test',
  website: '',
  taxLiable: true,
  taxAreaId: 'tax-guid',
  taxRegistrationNumber: 'TRN-1',
  currencyId: 'cur-guid',
  currencyCode: 'USD',
  paymentTermsId: 'pt-guid',
  paymentMethodId: 'pm-guid',
  shipmentMethodId: 'sm-guid',
  blocked: ' ',
  balance: 4200.5,
  lastModifiedDateTime: '2026-03-03T10:00:00Z',
  '@odata.etag': 'W/"etag-1"',
};

const input = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

describe('mapBcCustomerToDb', () => {
  it('maps identity, scope, and profile fields', () => {
    const row = mapBcCustomerToDb({ ...input, customer: baseCustomer });
    expect(row.organization_id).toBe('org-1');
    expect(row.bc_connection_id).toBe('conn-1');
    expect(row.bc_environment).toBe('TEST');
    expect(row.bc_company_id).toBe('company-1');
    expect(row.bc_customer_id).toBe('cust-guid-1');
    expect(row.bc_customer_number).toBe('C00010');
    expect(row.display_name).toBe('Acme Corp');
    expect(row.city).toBe('Honolulu');
    expect(row.bc_etag).toBe('W/"etag-1"');
    expect(row.bc_last_modified_at).toBe('2026-03-03T10:00:00Z');
  });

  it('converts empty strings to null', () => {
    const row = mapBcCustomerToDb({ ...input, customer: baseCustomer });
    expect(row.address_line_2).toBeNull();
    expect(row.website).toBeNull();
  });

  it('normalizes the BC blank blocked value to null', () => {
    const row = mapBcCustomerToDb({ ...input, customer: baseCustomer });
    expect(row.blocked).toBeNull();
  });

  it('keeps a real blocked value', () => {
    const row = mapBcCustomerToDb({
      ...input,
      customer: { ...baseCustomer, blocked: 'All' },
    });
    expect(row.blocked).toBe('All');
  });

  it('maps financial details when present and leaves them null otherwise', () => {
    const withDetails = mapBcCustomerToDb({
      ...input,
      customer: {
        ...baseCustomer,
        customerFinancialDetails: { balance: 4200.5, overdueAmount: 1200 },
      },
    });
    expect(withDetails.balance).toBe(4200.5);
    expect(withDetails.overdue_amount).toBe(1200);

    const withoutDetails = mapBcCustomerToDb({ ...input, customer: baseCustomer });
    expect(withoutDetails.overdue_amount).toBeNull();
  });

  it('retains the raw payload and stamps sync fields', () => {
    const row = mapBcCustomerToDb({ ...input, customer: baseCustomer });
    expect(row.bc_raw_payload).toEqual(baseCustomer);
    expect(row.sync_status).toBe('synced');
    expect(row.last_synced_at).toBe('2026-03-04T00:00:00Z');
    expect(row.last_pulled_at).toBe('2026-03-04T00:00:00Z');
    expect(row.sync_error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/customerMapper.test.ts`
Expected: FAIL — `Failed to resolve import "./customerMapper"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/customerMapper.ts`:

```ts
import { BusinessCentralCustomer } from '@/types/database';

export interface BcCustomerFinancialDetails {
  balance?: number;
  totalSalesExcludingTax?: number;
  overdueAmount?: number;
}

export interface BcCustomer {
  id: string;
  number?: string;
  displayName: string;
  type?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  taxLiable?: boolean;
  taxAreaId?: string;
  taxRegistrationNumber?: string;
  currencyId?: string;
  currencyCode?: string;
  paymentTermsId?: string;
  paymentMethodId?: string;
  shipmentMethodId?: string;
  blocked?: string;
  balance?: number;
  lastModifiedDateTime?: string;
  customerFinancialDetails?: BcCustomerFinancialDetails;
  '@odata.etag'?: string;
  [key: string]: unknown;
}

export interface CustomerUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  customer: BcCustomer;
  now: string;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapBcCustomerToDb(input: CustomerUpsertInput): Partial<BusinessCentralCustomer> {
  const { organizationId, connectionId, environment, companyId, customer, now } = input;
  const financials = customer.customerFinancialDetails;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_customer_id: customer.id,
    bc_customer_number: emptyToNull(customer.number),
    bc_etag: customer['@odata.etag'] ?? null,
    bc_last_modified_at: customer.lastModifiedDateTime || null,
    display_name: customer.displayName,
    type: emptyToNull(customer.type),
    address_line_1: emptyToNull(customer.addressLine1),
    address_line_2: emptyToNull(customer.addressLine2),
    city: emptyToNull(customer.city),
    state: emptyToNull(customer.state),
    postal_code: emptyToNull(customer.postalCode),
    country: emptyToNull(customer.country),
    phone_number: emptyToNull(customer.phoneNumber),
    email: emptyToNull(customer.email),
    website: emptyToNull(customer.website),
    currency_id: emptyToNull(customer.currencyId),
    currency_code: emptyToNull(customer.currencyCode),
    payment_terms_id: emptyToNull(customer.paymentTermsId),
    payment_method_id: emptyToNull(customer.paymentMethodId),
    shipment_method_id: emptyToNull(customer.shipmentMethodId),
    tax_liable: customer.taxLiable ?? false,
    tax_area_id: emptyToNull(customer.taxAreaId),
    tax_registration_number: emptyToNull(customer.taxRegistrationNumber),
    // BC uses a single blank space for "not blocked".
    blocked: emptyToNull(customer.blocked),
    balance: numberOrNull(financials?.balance ?? customer.balance),
    overdue_amount: numberOrNull(financials?.overdueAmount),
    bc_raw_payload: customer as unknown as Record<string, unknown>,
    sync_status: 'synced',
    sync_error: null,
    last_synced_at: now,
    last_pulled_at: now,
    updated_at: now,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/customerMapper.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/customerMapper.ts nexus/src/lib/businessCentral/customerMapper.test.ts
git commit -m "feat(ar): add BC customer mapper"
```

---

### Task 5: Sales invoice mapper and posted-only filter

**Files:**
- Create: `nexus/src/lib/businessCentral/salesInvoiceMapper.ts`
- Test: `nexus/src/lib/businessCentral/salesInvoiceMapper.test.ts`

**Interfaces:**
- Consumes: `BusinessCentralSalesInvoice` from Task 1.
- Produces: `interface BcSalesInvoice`; `mapBcSalesInvoiceToDb(input: SalesInvoiceUpsertInput): Partial<BusinessCentralSalesInvoice>`; `isPostedInvoice(invoice: BcSalesInvoice): boolean`; `POSTED_INVOICE_ODATA_FILTER: string`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/salesInvoiceMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  POSTED_INVOICE_ODATA_FILTER,
  isPostedInvoice,
  mapBcSalesInvoiceToDb,
  type BcSalesInvoice,
} from './salesInvoiceMapper';

const baseInvoice: BcSalesInvoice = {
  id: 'inv-guid-1',
  number: 'PS-INV-1042',
  externalDocumentNumber: 'PO-77',
  invoiceDate: '2026-03-03',
  postingDate: '2026-03-03',
  dueDate: '2026-04-02',
  customerId: 'cust-guid-1',
  customerNumber: 'C00010',
  customerName: 'Acme Corp',
  billToCustomerId: 'cust-guid-1',
  billToCustomerNumber: 'C00010',
  billToName: 'Acme Corp',
  currencyCode: 'USD',
  discountAmount: 0,
  totalAmountExcludingTax: 4000,
  totalTaxAmount: 200,
  totalAmountIncludingTax: 4200,
  status: 'Open',
  lastModifiedDateTime: '2026-03-03T10:00:00Z',
  '@odata.etag': 'W/"etag-inv-1"',
};

const input = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

describe('isPostedInvoice', () => {
  it('rejects drafts', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'Draft' })).toBe(false);
  });

  it('accepts posted statuses', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'Open' })).toBe(true);
    expect(isPostedInvoice({ ...baseInvoice, status: 'Paid' })).toBe(true);
    expect(isPostedInvoice({ ...baseInvoice, status: 'Canceled' })).toBe(true);
  });

  it('is case-insensitive about Draft', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: 'draft' })).toBe(false);
  });

  it('rejects an invoice with no status rather than guessing', () => {
    expect(isPostedInvoice({ ...baseInvoice, status: undefined })).toBe(false);
  });

  it('exposes a matching OData filter', () => {
    expect(POSTED_INVOICE_ODATA_FILTER).toBe("status ne 'Draft'");
  });
});

describe('mapBcSalesInvoiceToDb', () => {
  it('maps identity, dates, customer, and amounts', () => {
    const row = mapBcSalesInvoiceToDb({ ...input, invoice: baseInvoice });
    expect(row.bc_invoice_id).toBe('inv-guid-1');
    expect(row.bc_invoice_number).toBe('PS-INV-1042');
    expect(row.external_document_number).toBe('PO-77');
    expect(row.invoice_date).toBe('2026-03-03');
    expect(row.posting_date).toBe('2026-03-03');
    expect(row.due_date).toBe('2026-04-02');
    expect(row.bc_customer_id).toBe('cust-guid-1');
    expect(row.customer_name).toBe('Acme Corp');
    expect(row.total_amount_including_tax).toBe(4200);
    expect(row.status).toBe('Open');
  });

  it('nulls empty dates rather than storing empty strings', () => {
    const row = mapBcSalesInvoiceToDb({
      ...input,
      invoice: { ...baseInvoice, dueDate: '', postingDate: undefined },
    });
    expect(row.due_date).toBeNull();
    expect(row.posting_date).toBeNull();
  });

  it('retains the raw payload and stamps sync fields', () => {
    const row = mapBcSalesInvoiceToDb({ ...input, invoice: baseInvoice });
    expect(row.bc_raw_payload).toEqual(baseInvoice);
    expect(row.sync_status).toBe('synced');
    expect(row.last_pulled_at).toBe('2026-03-04T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/salesInvoiceMapper.test.ts`
Expected: FAIL — `Failed to resolve import "./salesInvoiceMapper"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/salesInvoiceMapper.ts`:

```ts
import { BusinessCentralSalesInvoice } from '@/types/database';

export interface BcSalesInvoice {
  id: string;
  number?: string;
  externalDocumentNumber?: string;
  invoiceDate?: string;
  postingDate?: string;
  dueDate?: string;
  customerId?: string;
  customerNumber?: string;
  customerName?: string;
  billToCustomerId?: string;
  billToCustomerNumber?: string;
  billToName?: string;
  currencyCode?: string;
  discountAmount?: number;
  totalAmountExcludingTax?: number;
  totalTaxAmount?: number;
  totalAmountIncludingTax?: number;
  status?: string;
  lastModifiedDateTime?: string;
  '@odata.etag'?: string;
  [key: string]: unknown;
}

export interface SalesInvoiceUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  invoice: BcSalesInvoice;
  now: string;
}

/**
 * BC's salesInvoices endpoint returns drafts alongside posted invoices.
 * Nexus mirrors posted invoices only.
 */
export const POSTED_INVOICE_ODATA_FILTER = "status ne 'Draft'";

export function isPostedInvoice(invoice: BcSalesInvoice): boolean {
  const status = invoice.status?.trim();
  if (!status) return false;
  return status.toLowerCase() !== 'draft';
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapBcSalesInvoiceToDb(
  input: SalesInvoiceUpsertInput
): Partial<BusinessCentralSalesInvoice> {
  const { organizationId, connectionId, environment, companyId, invoice, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_invoice_id: invoice.id,
    bc_invoice_number: emptyToNull(invoice.number),
    external_document_number: emptyToNull(invoice.externalDocumentNumber),
    bc_etag: invoice['@odata.etag'] ?? null,
    bc_last_modified_at: invoice.lastModifiedDateTime || null,
    invoice_date: emptyToNull(invoice.invoiceDate),
    posting_date: emptyToNull(invoice.postingDate),
    due_date: emptyToNull(invoice.dueDate),
    bc_customer_id: emptyToNull(invoice.customerId),
    customer_number: emptyToNull(invoice.customerNumber),
    customer_name: emptyToNull(invoice.customerName),
    bill_to_customer_id: emptyToNull(invoice.billToCustomerId),
    bill_to_customer_number: emptyToNull(invoice.billToCustomerNumber),
    bill_to_name: emptyToNull(invoice.billToName),
    currency_code: emptyToNull(invoice.currencyCode),
    discount_amount: numberOrNull(invoice.discountAmount),
    total_amount_excluding_tax: numberOrNull(invoice.totalAmountExcludingTax),
    total_tax_amount: numberOrNull(invoice.totalTaxAmount),
    total_amount_including_tax: numberOrNull(invoice.totalAmountIncludingTax),
    status: emptyToNull(invoice.status),
    bc_raw_payload: invoice as unknown as Record<string, unknown>,
    sync_status: 'synced',
    sync_error: null,
    last_synced_at: now,
    last_pulled_at: now,
    updated_at: now,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/salesInvoiceMapper.test.ts`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/salesInvoiceMapper.ts nexus/src/lib/businessCentral/salesInvoiceMapper.test.ts
git commit -m "feat(ar): add sales invoice mapper with posted-only filter"
```

---

### Task 6: Sales invoice line mapper

**Files:**
- Create: `nexus/src/lib/businessCentral/salesInvoiceLineMapper.ts`
- Test: `nexus/src/lib/businessCentral/salesInvoiceLineMapper.test.ts`

**Interfaces:**
- Consumes: `BusinessCentralSalesInvoiceLine` from Task 1.
- Produces: `interface BcSalesInvoiceLine`; `mapBcSalesInvoiceLineToDb(input: SalesInvoiceLineUpsertInput): Partial<BusinessCentralSalesInvoiceLine>`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/salesInvoiceLineMapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapBcSalesInvoiceLineToDb, type BcSalesInvoiceLine } from './salesInvoiceLineMapper';

const baseLine: BcSalesInvoiceLine = {
  id: 'line-guid-1',
  documentId: 'inv-guid-1',
  sequence: 10000,
  lineType: 'Item',
  lineObjectNumber: 'NX000123',
  description: '500ct box',
  unitOfMeasureCode: 'CASE',
  quantity: 500,
  unitPrice: 6,
  discountAmount: 0,
  discountPercent: 0,
  taxPercent: 5,
  amountExcludingTax: 3000,
  taxAmount: 150,
  amountIncludingTax: 3150,
  '@odata.etag': 'W/"etag-line-1"',
};

const input = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

describe('mapBcSalesInvoiceLineToDb', () => {
  it('maps the line and its parent invoice reference', () => {
    const row = mapBcSalesInvoiceLineToDb({ ...input, line: baseLine });
    expect(row.bc_line_id).toBe('line-guid-1');
    expect(row.bc_invoice_id).toBe('inv-guid-1');
    expect(row.sequence).toBe(10000);
    expect(row.line_type).toBe('Item');
    expect(row.line_object_number).toBe('NX000123');
    expect(row.quantity).toBe(500);
    expect(row.unit_price).toBe(6);
    expect(row.amount_including_tax).toBe(3150);
  });

  it('nulls empty text and non-numeric values', () => {
    const row = mapBcSalesInvoiceLineToDb({
      ...input,
      line: { ...baseLine, description: '', quantity: undefined },
    });
    expect(row.description).toBeNull();
    expect(row.quantity).toBeNull();
  });

  it('retains the raw payload', () => {
    const row = mapBcSalesInvoiceLineToDb({ ...input, line: baseLine });
    expect(row.bc_raw_payload).toEqual(baseLine);
    expect(row.updated_at).toBe('2026-03-04T00:00:00Z');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/salesInvoiceLineMapper.test.ts`
Expected: FAIL — `Failed to resolve import "./salesInvoiceLineMapper"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/salesInvoiceLineMapper.ts`:

```ts
import { BusinessCentralSalesInvoiceLine } from '@/types/database';

export interface BcSalesInvoiceLine {
  id: string;
  documentId: string;
  sequence?: number;
  lineType?: string;
  lineObjectNumber?: string;
  description?: string;
  unitOfMeasureCode?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  taxPercent?: number;
  amountExcludingTax?: number;
  taxAmount?: number;
  amountIncludingTax?: number;
  lastModifiedDateTime?: string;
  '@odata.etag'?: string;
  [key: string]: unknown;
}

export interface SalesInvoiceLineUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  line: BcSalesInvoiceLine;
  now: string;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapBcSalesInvoiceLineToDb(
  input: SalesInvoiceLineUpsertInput
): Partial<BusinessCentralSalesInvoiceLine> {
  const { organizationId, connectionId, environment, companyId, line, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_line_id: line.id,
    bc_invoice_id: line.documentId,
    bc_etag: line['@odata.etag'] ?? null,
    bc_last_modified_at: line.lastModifiedDateTime || null,
    sequence: numberOrNull(line.sequence),
    line_type: emptyToNull(line.lineType),
    line_object_number: emptyToNull(line.lineObjectNumber),
    description: emptyToNull(line.description),
    unit_of_measure_code: emptyToNull(line.unitOfMeasureCode),
    quantity: numberOrNull(line.quantity),
    unit_price: numberOrNull(line.unitPrice),
    discount_amount: numberOrNull(line.discountAmount),
    discount_percent: numberOrNull(line.discountPercent),
    tax_percent: numberOrNull(line.taxPercent),
    amount_excluding_tax: numberOrNull(line.amountExcludingTax),
    tax_amount: numberOrNull(line.taxAmount),
    amount_including_tax: numberOrNull(line.amountIncludingTax),
    bc_raw_payload: line as unknown as Record<string, unknown>,
    updated_at: now,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/salesInvoiceLineMapper.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/salesInvoiceLineMapper.ts nexus/src/lib/businessCentral/salesInvoiceLineMapper.test.ts
git commit -m "feat(ar): add sales invoice line mapper"
```

---

### Task 7: Customer ledger entry OData client and mapper

The ledger entry feed is a published OData page, not API v2.0. This follows `noSeriesClient.ts`, which consumes published Page 457 the same way.

**Files:**
- Create: `nexus/src/lib/businessCentral/customerLedgerClient.ts`
- Test: `nexus/src/lib/businessCentral/customerLedgerClient.test.ts`

**Interfaces:**
- Consumes: `createBcClientForOrg`, `BcClient` from `./client`; `BusinessCentralCustomerLedgerEntry` from Task 1.
- Produces: `class CustomerLedgerPageUnavailableError extends Error`; `interface BcCustomerLedgerEntry`; `interface CustomerLedgerClient { listEntriesAfter(entryNo: number, top: number): Promise<BcCustomerLedgerEntry[]> }`; `createCustomerLedgerClient(bcClient: BcClient, companyName: string, fetchImpl?: typeof fetch): CustomerLedgerClient`; `createCustomerLedgerClientForOrg(orgId: string, connectionId: string): Promise<CustomerLedgerClient>`; `mapBcLedgerEntryToDb(input: LedgerEntryUpsertInput): Partial<BusinessCentralCustomerLedgerEntry>`; `CUSTOMER_LEDGER_SERVICE_NAME`.

**Pattern note:** this mirrors `noSeriesClient.ts:47-50` exactly — `fetch` is injected as an optional third parameter defaulting to the global, and auth comes from `bcClient.getAccessToken()`. The client object returned by `createBcClient` exposes `config` and `getAccessToken` but **not** `fetchImpl`, so do not reach for `bcClient.fetchImpl`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/customerLedgerClient.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  CUSTOMER_LEDGER_SERVICE_NAME,
  CustomerLedgerPageUnavailableError,
  createCustomerLedgerClient,
  mapBcLedgerEntryToDb,
  type BcCustomerLedgerEntry,
} from './customerLedgerClient';
import type { BcClient } from './client';

function fakeBcClient(): BcClient {
  return {
    config: {
      apiBaseUrl: 'https://api.businesscentral.dynamics.com',
      environment: 'TEST',
      companyId: 'company-1',
      tenantId: 't',
      clientId: 'c',
      clientSecret: 's',
    },
    getAccessToken: vi.fn(async () => ({
      accessToken: 'token-1',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000,
    })),
  } as unknown as BcClient;
}

const rawEntry = {
  Entry_No: 4711,
  Customer_No: 'C00010',
  Posting_Date: '2026-03-03',
  Document_Type: 'Invoice',
  Document_No: 'PS-INV-1042',
  Description: 'Order 77',
  Due_Date: '2026-04-02',
  Currency_Code: '',
  Amount: 4200,
  Remaining_Amount: 4200,
  Open: true,
  Closed_at_Date: '0001-01-01',
  External_Document_No: 'PO-77',
};

describe('CUSTOMER_LEDGER_SERVICE_NAME', () => {
  it('matches the service published in BC', () => {
    expect(CUSTOMER_LEDGER_SERVICE_NAME).toBe('CustomerLedgerEntries');
  });
});

describe('createCustomerLedgerClient', () => {
  it('requests entries after the cursor, ordered and paged', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ value: [rawEntry] }), { status: 200 })
    );
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    const entries = await client.listEntriesAfter(4700, 500);

    expect(entries).toHaveLength(1);
    expect(entries[0].entryNo).toBe(4711);
    expect(entries[0].open).toBe(true);

    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("/ODataV4/Company('CRONUS')/CustomerLedgerEntries");
    expect(decodeURIComponent(url)).toContain('Entry_No gt 4700');
    expect(decodeURIComponent(url)).toContain('$orderby=Entry_No');
    expect(url).toContain('$top=500');
  });

  it('raises a targeted error when the page is not published', async () => {
    const fetchImpl = vi.fn(async () => new Response('Not Found', { status: 404 }));
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    await expect(client.listEntriesAfter(0, 500)).rejects.toBeInstanceOf(
      CustomerLedgerPageUnavailableError
    );
    await expect(client.listEntriesAfter(0, 500)).rejects.toThrow(/CustomerLedgerEntries/);
  });

  it('raises the same targeted error when access is denied', async () => {
    const fetchImpl = vi.fn(async () => new Response('Forbidden', { status: 403 }));
    const client = createCustomerLedgerClient(fakeBcClient(), 'CRONUS', fetchImpl as unknown as typeof fetch);

    await expect(client.listEntriesAfter(0, 500)).rejects.toBeInstanceOf(
      CustomerLedgerPageUnavailableError
    );
  });
});

describe('mapBcLedgerEntryToDb', () => {
  const input = {
    organizationId: 'org-1',
    connectionId: 'conn-1',
    environment: 'TEST',
    companyId: 'company-1',
    now: '2026-03-04T00:00:00Z',
  };

  const entry: BcCustomerLedgerEntry = {
    entryNo: 4711,
    customerNo: 'C00010',
    postingDate: '2026-03-03',
    documentType: 'Invoice',
    documentNo: 'PS-INV-1042',
    description: 'Order 77',
    dueDate: '2026-04-02',
    currencyCode: '',
    amount: 4200,
    remainingAmount: 4200,
    open: true,
    closedAtDate: '0001-01-01',
    externalDocumentNo: 'PO-77',
    raw: rawEntry,
  };

  it('maps entry fields and scope', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.entry_no).toBe(4711);
    expect(row.customer_no).toBe('C00010');
    expect(row.document_type).toBe('Invoice');
    expect(row.due_date).toBe('2026-04-02');
    expect(row.remaining_amount).toBe(4200);
    expect(row.open).toBe(true);
    expect(row.bc_connection_id).toBe('conn-1');
  });

  it('normalizes BC placeholder dates and empty strings to null', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.closed_at_date).toBeNull();
    expect(row.currency_code).toBeNull();
  });

  it('retains the raw payload', () => {
    const row = mapBcLedgerEntryToDb({ ...input, entry });
    expect(row.bc_raw_payload).toEqual(rawEntry);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/customerLedgerClient.test.ts`
Expected: FAIL — `Failed to resolve import "./customerLedgerClient"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/customerLedgerClient.ts`:

```ts
import { BusinessCentralCustomerLedgerEntry } from '@/types/database';
import { createBcClientForOrg, type BcClient } from './client';

/** Page 25 (Cust. Ledger Entries), published as an OData web service under this name. */
export const CUSTOMER_LEDGER_SERVICE_NAME = 'CustomerLedgerEntries';

/** BC's placeholder for "no date". */
const BC_NULL_DATE = '0001-01-01';

export class CustomerLedgerPageUnavailableError extends Error {
  constructor(status: number) {
    super(
      `Customer ledger entries are unavailable (HTTP ${status}). Publish page 25 ` +
        `(Cust. Ledger Entries) as an OData web service named "${CUSTOMER_LEDGER_SERVICE_NAME}" ` +
        `in this Business Central environment, and confirm the app registration has read ` +
        `access to the Cust. Ledger Entry table.`
    );
    this.name = 'CustomerLedgerPageUnavailableError';
  }
}

export interface BcCustomerLedgerEntry {
  entryNo: number;
  customerNo: string;
  postingDate: string;
  documentType: string;
  documentNo: string;
  description: string;
  dueDate: string;
  currencyCode: string;
  amount: number;
  remainingAmount: number;
  open: boolean;
  closedAtDate: string;
  externalDocumentNo: string;
  raw: Record<string, unknown>;
}

export interface CustomerLedgerClient {
  listEntriesAfter(entryNo: number, top: number): Promise<BcCustomerLedgerEntry[]>;
}

export interface LedgerEntryUpsertInput {
  organizationId: string;
  connectionId: string;
  environment: string;
  companyId: string;
  entry: BcCustomerLedgerEntry;
  now: string;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function mapEntry(row: Record<string, unknown>): BcCustomerLedgerEntry {
  return {
    entryNo: Number(row.Entry_No),
    customerNo: String(row.Customer_No ?? ''),
    postingDate: String(row.Posting_Date ?? ''),
    documentType: String(row.Document_Type ?? ''),
    documentNo: String(row.Document_No ?? ''),
    description: String(row.Description ?? ''),
    dueDate: String(row.Due_Date ?? ''),
    currencyCode: String(row.Currency_Code ?? ''),
    amount: Number(row.Amount ?? 0),
    remainingAmount: Number(row.Remaining_Amount ?? 0),
    open: Boolean(row.Open),
    closedAtDate: String(row.Closed_at_Date ?? ''),
    externalDocumentNo: String(row.External_Document_No ?? ''),
    raw: row,
  };
}

export function createCustomerLedgerClient(
  bcClient: BcClient,
  companyName: string,
  fetchImpl: typeof fetch = fetch
): CustomerLedgerClient {
  const base =
    `${trimTrailingSlash(bcClient.config.apiBaseUrl ?? 'https://api.businesscentral.dynamics.com')}` +
    `/v2.0/${encodeURIComponent(bcClient.config.environment)}` +
    `/ODataV4/Company('${encodeURIComponent(companyName)}')`;

  async function authHeader(): Promise<string> {
    const token = await bcClient.getAccessToken();
    return `${token.tokenType} ${token.accessToken}`;
  }

  return {
    async listEntriesAfter(entryNo: number, top: number): Promise<BcCustomerLedgerEntry[]> {
      const filter = encodeURIComponent(`Entry_No gt ${entryNo}`);
      const url =
        `${base}/${CUSTOMER_LEDGER_SERVICE_NAME}` +
        `?$filter=${filter}&$orderby=${encodeURIComponent('Entry_No')}&$top=${top}`;

      const response = await fetchImpl(url, {
        headers: {
          Authorization: await authHeader(),
          Accept: 'application/json',
        },
      });

      if (response.status === 404 || response.status === 403 || response.status === 401) {
        throw new CustomerLedgerPageUnavailableError(response.status);
      }
      if (!response.ok) {
        throw new Error(
          `Failed to read ${CUSTOMER_LEDGER_SERVICE_NAME}: HTTP ${response.status}`
        );
      }

      const body = (await response.json()) as { value?: Record<string, unknown>[] };
      return (body.value ?? []).map(mapEntry);
    },
  };
}

export async function createCustomerLedgerClientForOrg(
  orgId: string,
  connectionId: string
): Promise<CustomerLedgerClient> {
  const bcClient = await createBcClientForOrg(orgId, connectionId);
  const company = await bcClient.getCompany(bcClient.config.companyId);
  return createCustomerLedgerClient(bcClient, company.name);
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === BC_NULL_DATE) return null;
  return trimmed;
}

export function mapBcLedgerEntryToDb(
  input: LedgerEntryUpsertInput
): Partial<BusinessCentralCustomerLedgerEntry> {
  const { organizationId, connectionId, environment, companyId, entry, now } = input;

  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    entry_no: entry.entryNo,
    customer_no: entry.customerNo,
    posting_date: dateOrNull(entry.postingDate),
    document_type: emptyToNull(entry.documentType),
    document_no: emptyToNull(entry.documentNo),
    description: emptyToNull(entry.description),
    due_date: dateOrNull(entry.dueDate),
    currency_code: emptyToNull(entry.currencyCode),
    amount: entry.amount,
    remaining_amount: entry.remainingAmount,
    open: entry.open,
    closed_at_date: dateOrNull(entry.closedAtDate),
    external_document_no: emptyToNull(entry.externalDocumentNo),
    bc_raw_payload: entry.raw,
    updated_at: now,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/customerLedgerClient.test.ts`
Expected: PASS — 7 tests passed.

No change to `client.ts` is needed for this task: `config`, `getAccessToken`, and `getCompany` are already on the object `createBcClient` returns, and `fetch` is injected rather than read off the client.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/customerLedgerClient.ts nexus/src/lib/businessCentral/customerLedgerClient.test.ts
git commit -m "feat(ar): add customer ledger entry OData client and mapper"
```

---

### Task 8: Shared sync runner

The heart of the plan. Owns checkpointing, keyset resume, time budget, and per-entity error isolation. Tested entirely against fakes — no network, no database.

**Files:**
- Create: `nexus/src/lib/businessCentral/syncRunner.ts`
- Test: `nexus/src/lib/businessCentral/syncRunner.test.ts`

**Interfaces:**
- Consumes: `SyncEntityType` from Task 1.
- Produces:
  - `interface SyncContext { organizationId: string; connectionId: string; environment: string; companyId: string; now: string }`
  - `interface SyncEntityAdapter<TRemote> { entityType: SyncEntityType; table: string; conflictTarget: string; pageSize: number; fetchPage(cursor: string | null, top: number): Promise<TRemote[]>; map(ctx: SyncContext, remote: TRemote): Record<string, unknown>; cursorValue(remote: TRemote): string }`
  - `interface SyncEntityResult { entityType: SyncEntityType; recordsSynced: number; complete: boolean; cursor: string | null; error: string | null }`
  - `interface SyncRunnerDeps { checkpoints: CheckpointStore; upsert(table: string, rows: Record<string, unknown>[], conflictTarget: string): Promise<void>; nowMs(): number }`
  - `interface CheckpointStore { read(connectionId: string, entityType: SyncEntityType): Promise<{ cursor_value: string | null; records_synced: number } | null>; write(connectionId: string, entityType: SyncEntityType, patch: { cursor_value: string | null; records_synced: number; last_error: string | null }): Promise<void> }`
  - `runEntitySync<TRemote>(deps, adapter, ctx, budgetMs): Promise<SyncEntityResult>`
  - `runAllEntitySyncs(deps, adapters, ctx, budgetMs): Promise<SyncEntityResult[]>`

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/syncRunner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/syncRunner.test.ts`
Expected: FAIL — `Failed to resolve import "./syncRunner"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/syncRunner.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/syncRunner.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Run the whole suite to confirm nothing regressed**

Run: `cd nexus && npm test`
Expected: all tests pass, including the pre-existing 102.

- [ ] **Step 6: Commit**

```bash
git add nexus/src/lib/businessCentral/syncRunner.ts nexus/src/lib/businessCentral/syncRunner.test.ts
git commit -m "feat(ar): add resumable time-budgeted sync runner"
```

---

### Task 9: Entity adapters and the sync server action

**Files:**
- Create: `nexus/src/lib/businessCentral/arSyncAdapters.ts`
- Create: `nexus/src/app/actions/businessCentralReceivables.ts`
- Test: `nexus/src/lib/businessCentral/arSyncAdapters.test.ts`
- Modify: `nexus/src/lib/businessCentral/client.ts` (add `listResourcePage`)

**Interfaces:**
- Consumes: mappers from Tasks 4–7, runner types from Task 8.
- Produces: `buildArSyncAdapters(input: { bcClient: BcClient; ledgerClient: CustomerLedgerClient }): SyncEntityAdapter<any>[]`; server action `syncBusinessCentralReceivables(): Promise<SyncEntityResult[]>`; `getReceivablesSyncStatus(): Promise<BusinessCentralSyncCheckpoint[]>`.

- [ ] **Step 1: Add generic resource paging to the BC client**

`request` (`client.ts:267`) and `companyPath` (`client.ts:328`) are inner functions of `createBcClient`, so `listResourcePage` must be defined inside that same scope. The existing `withQuery` helper supports only `$top` and `$filter` — it has no `$orderby` — so this builds its own query string rather than reusing it.

In `nexus/src/lib/businessCentral/client.ts`, add next to `listAllItems` (inside `createBcClient`):

```ts
  async function listResourcePage<T>(
    resource: string,
    options: { filter?: string; orderBy: string; top: number },
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options.filter) params.set("$filter", options.filter);
    params.set("$orderby", options.orderBy);
    params.set("$top", String(options.top));
    const response = await request<BcListResponse<T>>(
      `${companyPath(`/${resource}`)}?${params.toString()}`,
    );
    return response.value ?? [];
  }
```

Then add `listResourcePage,` to the object returned at `client.ts:353`, alongside `config` and `getAccessToken`.

Note the resource is company-scoped via `companyPath`, matching how `listItems` reaches `/companies(<id>)/items`. `customers`, `salesInvoices`, and `salesInvoiceLines` all live under the company path.

- [ ] **Step 2: Write the failing adapter tests**

Create `nexus/src/lib/businessCentral/arSyncAdapters.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildArSyncAdapters } from './arSyncAdapters';
import type { BcClient } from './client';
import type { CustomerLedgerClient } from './customerLedgerClient';

const ctx = {
  organizationId: 'org-1',
  connectionId: 'conn-1',
  environment: 'TEST',
  companyId: 'company-1',
  now: '2026-03-04T00:00:00Z',
};

function fakeClients() {
  const listResourcePage = vi.fn(async () => []);
  const listEntriesAfter = vi.fn(async () => []);
  return {
    bcClient: { listResourcePage } as unknown as BcClient,
    ledgerClient: { listEntriesAfter } as unknown as CustomerLedgerClient,
    listResourcePage,
    listEntriesAfter,
  };
}

describe('buildArSyncAdapters', () => {
  it('returns the four entities in dependency order', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    expect(adapters.map((a) => a.entityType)).toEqual([
      'customer',
      'sales_invoice',
      'sales_invoice_line',
      'customer_ledger_entry',
    ]);
  });

  it('filters sales invoices to posted only and orders by last modified', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const invoices = adapters.find((a) => a.entityType === 'sales_invoice')!;

    await invoices.fetchPage('2026-03-01T00:00:00Z', 500);

    const call = listResourcePage.mock.calls[0];
    expect(call[0]).toBe('salesInvoices');
    expect(call[1].filter).toContain("status ne 'Draft'");
    expect(call[1].filter).toContain('lastModifiedDateTime gt 2026-03-01T00:00:00Z');
    expect(call[1].orderBy).toBe('lastModifiedDateTime');
    expect(call[1].top).toBe(500);
  });

  it('omits the cursor clause on a first run', async () => {
    const { bcClient, ledgerClient, listResourcePage } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    await customers.fetchPage(null, 500);

    expect(listResourcePage.mock.calls[0][1].filter).toBeUndefined();
  });

  it('drives ledger entries from the numeric entry cursor', async () => {
    const { bcClient, ledgerClient, listEntriesAfter } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const ledger = adapters.find((a) => a.entityType === 'customer_ledger_entry')!;

    await ledger.fetchPage('4700', 500);
    expect(listEntriesAfter).toHaveBeenCalledWith(4700, 500);

    await ledger.fetchPage(null, 500);
    expect(listEntriesAfter).toHaveBeenLastCalledWith(0, 500);
  });

  it('maps a customer through the customer mapper', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    const row = customers.map(ctx, {
      id: 'cust-1',
      displayName: 'Acme',
      lastModifiedDateTime: '2026-03-03T10:00:00Z',
    });

    expect(row.bc_customer_id).toBe('cust-1');
    expect(row.organization_id).toBe('org-1');
  });

  it('uses lastModifiedDateTime as the cursor for API v2.0 entities', () => {
    const { bcClient, ledgerClient } = fakeClients();
    const adapters = buildArSyncAdapters({ bcClient, ledgerClient });
    const customers = adapters.find((a) => a.entityType === 'customer')!;

    expect(
      customers.cursorValue({ id: 'c', displayName: 'x', lastModifiedDateTime: '2026-03-03T10:00:00Z' })
    ).toBe('2026-03-03T10:00:00Z');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/arSyncAdapters.test.ts`
Expected: FAIL — `Failed to resolve import "./arSyncAdapters"`.

- [ ] **Step 4: Write the adapters**

Create `nexus/src/lib/businessCentral/arSyncAdapters.ts`:

```ts
import type { BcClient } from './client';
import {
  mapBcCustomerToDb,
  type BcCustomer,
} from './customerMapper';
import {
  POSTED_INVOICE_ODATA_FILTER,
  mapBcSalesInvoiceToDb,
  type BcSalesInvoice,
} from './salesInvoiceMapper';
import {
  mapBcSalesInvoiceLineToDb,
  type BcSalesInvoiceLine,
} from './salesInvoiceLineMapper';
import {
  mapBcLedgerEntryToDb,
  type BcCustomerLedgerEntry,
  type CustomerLedgerClient,
} from './customerLedgerClient';
import type { SyncEntityAdapter } from './syncRunner';

export const AR_SYNC_PAGE_SIZE = 500;

function deltaFilter(cursor: string | null, extra?: string): string | undefined {
  const clauses: string[] = [];
  if (extra) clauses.push(extra);
  if (cursor) clauses.push(`lastModifiedDateTime gt ${cursor}`);
  return clauses.length ? clauses.join(' and ') : undefined;
}

export interface ArSyncAdapterInput {
  bcClient: BcClient;
  ledgerClient: CustomerLedgerClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildArSyncAdapters(input: ArSyncAdapterInput): SyncEntityAdapter<any>[] {
  const { bcClient, ledgerClient } = input;

  const customers: SyncEntityAdapter<BcCustomer> = {
    entityType: 'customer',
    table: 'business_central_customers',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_customer_id',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) =>
      bcClient.listResourcePage<BcCustomer>('customers', {
        filter: deltaFilter(cursor),
        orderBy: 'lastModifiedDateTime',
        top,
      }),
    map: (ctx, customer) =>
      mapBcCustomerToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        customer,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (customer) => customer.lastModifiedDateTime ?? '',
  };

  const salesInvoices: SyncEntityAdapter<BcSalesInvoice> = {
    entityType: 'sales_invoice',
    table: 'business_central_sales_invoices',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_invoice_id',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) =>
      bcClient.listResourcePage<BcSalesInvoice>('salesInvoices', {
        filter: deltaFilter(cursor, POSTED_INVOICE_ODATA_FILTER),
        orderBy: 'lastModifiedDateTime',
        top,
      }),
    map: (ctx, invoice) =>
      mapBcSalesInvoiceToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        invoice,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (invoice) => invoice.lastModifiedDateTime ?? '',
  };

  const salesInvoiceLines: SyncEntityAdapter<BcSalesInvoiceLine> = {
    entityType: 'sales_invoice_line',
    table: 'business_central_sales_invoice_lines',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,bc_line_id',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) =>
      bcClient.listResourcePage<BcSalesInvoiceLine>('salesInvoiceLines', {
        filter: deltaFilter(cursor),
        orderBy: 'lastModifiedDateTime',
        top,
      }),
    map: (ctx, line) =>
      mapBcSalesInvoiceLineToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        line,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (line) => line.lastModifiedDateTime ?? '',
  };

  const ledgerEntries: SyncEntityAdapter<BcCustomerLedgerEntry> = {
    entityType: 'customer_ledger_entry',
    table: 'business_central_customer_ledger_entries',
    conflictTarget: 'organization_id,bc_connection_id,bc_company_id,entry_no',
    pageSize: AR_SYNC_PAGE_SIZE,
    fetchPage: (cursor, top) => ledgerClient.listEntriesAfter(cursor ? Number(cursor) : 0, top),
    map: (ctx, entry) =>
      mapBcLedgerEntryToDb({
        organizationId: ctx.organizationId,
        connectionId: ctx.connectionId,
        environment: ctx.environment,
        companyId: ctx.companyId,
        entry,
        now: ctx.now,
      }) as Record<string, unknown>,
    cursorValue: (entry) => String(entry.entryNo),
  };

  // Dependency order: customers, then invoices, then their lines, then ledger entries.
  return [customers, salesInvoices, salesInvoiceLines, ledgerEntries];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/arSyncAdapters.test.ts`
Expected: PASS — 6 tests passed.

- [ ] **Step 6: Write the server action**

Create `nexus/src/app/actions/businessCentralReceivables.ts`:

```ts
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
```

- [ ] **Step 7: Type-check (expected to fail until Task 10)**

Run: `cd nexus && npx tsc --noEmit`
Expected: FAIL — `canViewReceivables` is not exported from `@/lib/auth/permissions`. This is resolved by Task 10; do not stub the permission here.

- [ ] **Step 8: Commit**

```bash
git add nexus/src/lib/businessCentral/arSyncAdapters.ts nexus/src/lib/businessCentral/arSyncAdapters.test.ts nexus/src/app/actions/businessCentralReceivables.ts nexus/src/lib/businessCentral/client.ts
git commit -m "feat(ar): add AR sync adapters and receivables sync action"
```

---

### Task 10: Permission keys

**Files:**
- Modify: `nexus/src/lib/auth/permissions.ts`
- Test: `nexus/src/lib/auth/permissions.test.ts` (append)

**Interfaces:**
- Consumes: existing `ResolvedUserAccess`, `ACCESS_KEYS`, `OVERRIDE_TO_ACCESS_KEY`.
- Produces: access keys `canViewCustomers`, `canViewReceivables`; override keys `viewCustomers`, `viewReceivables`; predicates `canViewCustomers(access)` and `canViewReceivables(access)` exported for `requirePermission`.

- [ ] **Step 1: Write the failing tests**

Append to `nexus/src/lib/auth/permissions.test.ts`:

```ts
describe('receivables permissions', () => {
  it('denies customers and receivables to a default non-admin user', () => {
    const access = resolveUserAccess({ role: 'user', permissions: null });
    expect(access.canViewCustomers).toBe(false);
    expect(access.canViewReceivables).toBe(false);
  });

  it('grants both to an admin', () => {
    const access = resolveUserAccess({ role: 'admin', permissions: null });
    expect(access.canViewCustomers).toBe(true);
    expect(access.canViewReceivables).toBe(true);
  });

  it('honours per-user overrides independently', () => {
    const access = resolveUserAccess({
      role: 'user',
      permissions: { functionalRoles: DEFAULT_FUNCTIONAL_ROLES, overrides: { viewCustomers: true } },
    });
    expect(access.canViewCustomers).toBe(true);
    expect(access.canViewReceivables).toBe(false);
  });
});
```

If `resolveUserAccess` or `DEFAULT_FUNCTIONAL_ROLES` is not already imported at the top of that test file, add it to the existing import from `./permissions`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/auth/permissions.test.ts`
Expected: FAIL — `canViewCustomers` is undefined.

- [ ] **Step 3: Add the keys**

In `nexus/src/lib/auth/permissions.ts`:

1. Add `'canViewCustomers'` and `'canViewReceivables'` to the `ACCESS_KEYS` array (after `'canAssignInvoices'`).
2. Add to `OVERRIDE_TO_ACCESS_KEY`:

```ts
  viewCustomers: 'canViewCustomers',
  viewReceivables: 'canViewReceivables',
```

3. Add `viewCustomers?: boolean;` and `viewReceivables?: boolean;` to the `PermissionOverrides` interface.
4. Add `canViewCustomers: boolean;` and `canViewReceivables: boolean;` to `ResolvedUserAccess`.
5. In `resolveUserAccess`, default both to `isAdmin` before overrides are applied, matching how the other admin-default keys are computed in that function.
6. Export the predicates at the end of the file:

```ts
export function canViewCustomers(access: ResolvedUserAccess): boolean {
  return access.canViewCustomers;
}

export function canViewReceivables(access: ResolvedUserAccess): boolean {
  return access.canViewReceivables;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/auth/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check the whole project**

Run: `cd nexus && npx tsc --noEmit`
Expected: exits 0 — the Task 9 failure is now resolved.

- [ ] **Step 6: Run the full suite**

Run: `cd nexus && npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add nexus/src/lib/auth/permissions.ts nexus/src/lib/auth/permissions.test.ts
git commit -m "feat(ar): add canViewCustomers and canViewReceivables permissions"
```

---

### Task 11: Customers list and detail pages, plus nav relabel

**Files:**
- Create: `nexus/src/app/(protected)/customers/page.tsx`
- Create: `nexus/src/app/(protected)/customers/[id]/page.tsx`
- Create: `nexus/src/components/customers/CustomersClient.tsx`
- Create: `nexus/src/components/customers/CustomerDetail.tsx`
- Modify: `nexus/src/app/actions/businessCentralReceivables.ts` (add read queries)
- Modify: `nexus/src/components/layout/AppNav.tsx`

**Interfaces:**
- Consumes: `canViewCustomers` from Task 10, `syncBusinessCentralReceivables` from Task 9.
- Produces: `getCustomersPageData(): Promise<{ customers: BusinessCentralCustomer[]; canSync: boolean }>`; `getCustomerDetail(id: string): Promise<{ customer: BusinessCentralCustomer; invoices: BusinessCentralSalesInvoice[]; ledgerEntries: BusinessCentralCustomerLedgerEntry[] } | null>`.

- [ ] **Step 1: Add the read queries to the server action file**

Append to `nexus/src/app/actions/businessCentralReceivables.ts`:

```ts
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

  const [{ data: invoices }, { data: ledgerEntries }] = await Promise.all([
    supabase
      .from('business_central_sales_invoices')
      .select('*')
      .eq('organization_id', orgId)
      .eq('bc_connection_id', connection.id)
      .eq('bc_customer_id', customer.bc_customer_id)
      .order('posting_date', { ascending: false }),
    supabase
      .from('business_central_customer_ledger_entries')
      .select('*')
      .eq('organization_id', orgId)
      .eq('bc_connection_id', connection.id)
      .eq('customer_no', customer.bc_customer_number ?? '')
      .order('posting_date', { ascending: false }),
  ]);

  return {
    customer: customer as BusinessCentralCustomer,
    invoices: (invoices ?? []) as BusinessCentralSalesInvoice[],
    ledgerEntries: (ledgerEntries ?? []) as BusinessCentralCustomerLedgerEntry[],
  };
}
```

Add the needed imports at the top of the file: `canViewCustomers` from `@/lib/auth/permissions`, and `BusinessCentralCustomer`, `BusinessCentralSalesInvoice`, `BusinessCentralCustomerLedgerEntry` from `@/types/database`.

- [ ] **Step 2: Create the customers list page**

Create `nexus/src/app/(protected)/customers/page.tsx`:

```tsx
import { getCustomersPageData } from '@/app/actions/businessCentralReceivables';
import { CustomersClient } from '@/components/customers/CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { customers, canSync } = await getCustomersPageData();
  return <CustomersClient customers={customers} canSync={canSync} />;
}
```

- [ ] **Step 3: Create the list client component**

Create `nexus/src/components/customers/CustomersClient.tsx`. Follow the visual conventions of `src/components/items/ItemsClient.tsx` (same table, input, and button primitives). It must:

- accept `{ customers: BusinessCentralCustomer[]; canSync: boolean }`
- filter client-side on `display_name`, `bc_customer_number`, and `email` via a search input
- render a table with columns: Number, Name, City, Currency, Balance, Overdue
- link each row to `/customers/${customer.id}`
- render a "Sync now" button when `canSync`, calling `syncBusinessCentralReceivables()` in a transition, disabling while pending, and showing per-entity results (`entityType`, `recordsSynced`, `complete`, `error`) afterwards
- show an empty state reading "No customers synced yet. Click Sync now to pull them from Business Central."

- [ ] **Step 4: Create the detail page and component**

Create `nexus/src/app/(protected)/customers/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getCustomerDetail } from '@/app/actions/businessCentralReceivables';
import { CustomerDetail } from '@/components/customers/CustomerDetail';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();
  return <CustomerDetail {...detail} />;
}
```

Create `nexus/src/components/customers/CustomerDetail.tsx` rendering three sections: profile and contact details, commercial terms (currency, payment terms, blocked status, balance, overdue amount), and two tables — invoices (number, posting date, due date, total including tax, status) and ledger entries (posting date, document type, document number, amount, remaining amount, open).

- [ ] **Step 5: Relabel the purchase invoices nav entry**

In `nexus/src/components/layout/AppNav.tsx`, change the label of the existing `/invoices` entry from "Invoices" to "Purchase invoices". Leave the route unchanged. Add a "Customers" entry pointing at `/customers`, shown only when the user has `canViewCustomers`, following however the existing entries gate on access.

- [ ] **Step 6: Verify**

Run: `cd nexus && npx tsc --noEmit && npm run lint`
Expected: both exit 0.

Run: `cd nexus && npm run dev`, sign in as an admin, visit `/customers`.
Expected: page renders with the empty state; "Sync now" is visible; the nav shows "Customers" and "Purchase invoices".

- [ ] **Step 7: Commit**

```bash
git add nexus/src/app/\(protected\)/customers nexus/src/components/customers nexus/src/components/layout/AppNav.tsx nexus/src/app/actions/businessCentralReceivables.ts
git commit -m "feat(ar): add customers list and detail pages"
```

---

### Task 12: AR aging dashboard

**Files:**
- Create: `nexus/src/app/(protected)/receivables/page.tsx`
- Create: `nexus/src/components/receivables/AgingDashboard.tsx`
- Create: `nexus/src/lib/businessCentral/agingSummary.ts`
- Test: `nexus/src/lib/businessCentral/agingSummary.test.ts`
- Modify: `nexus/src/app/actions/businessCentralReceivables.ts`

**Interfaces:**
- Consumes: `agingBucket`, `AGING_BUCKETS` from Task 2; the `business_central_ar_aging` view from Task 3.
- Produces: `interface AgingRow { id: string; customer_no: string; document_no: string | null; document_type: string | null; posting_date: string | null; due_date: string | null; currency_code: string | null; remaining_amount: number | null; days_overdue: number | null; as_of_date: string }`; `summarizeAging(rows: AgingRow[]): { buckets: Record<AgingBucket, { count: number; total: number }>; total: number }`; `getAgingPageData(): Promise<{ rows: AgingRow[]; asOfDate: string | null }>`.

- [ ] **Step 1: Write the failing summary tests**

Create `nexus/src/lib/businessCentral/agingSummary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { summarizeAging, type AgingRow } from './agingSummary';

function row(partial: Partial<AgingRow>): AgingRow {
  return {
    id: 'r1',
    customer_no: 'C00010',
    document_no: 'PS-INV-1',
    document_type: 'Invoice',
    posting_date: '2026-01-01',
    due_date: '2026-02-01',
    currency_code: 'USD',
    remaining_amount: 100,
    days_overdue: 0,
    as_of_date: '2026-03-04',
    ...partial,
  };
}

describe('summarizeAging', () => {
  it('totals each bucket', () => {
    const summary = summarizeAging([
      row({ id: 'a', days_overdue: 0, remaining_amount: 100 }),
      row({ id: 'b', days_overdue: 10, remaining_amount: 200 }),
      row({ id: 'c', days_overdue: 45, remaining_amount: 300 }),
      row({ id: 'd', days_overdue: 120, remaining_amount: 400 }),
    ]);

    expect(summary.buckets.current).toEqual({ count: 1, total: 100 });
    expect(summary.buckets['1-30']).toEqual({ count: 1, total: 200 });
    expect(summary.buckets['31-60']).toEqual({ count: 1, total: 300 });
    expect(summary.buckets['61-90']).toEqual({ count: 0, total: 0 });
    expect(summary.buckets['90+']).toEqual({ count: 1, total: 400 });
    expect(summary.total).toBe(1000);
  });

  it('treats a null remaining amount as zero', () => {
    const summary = summarizeAging([row({ remaining_amount: null })]);
    expect(summary.buckets.current.total).toBe(0);
    expect(summary.buckets.current.count).toBe(1);
  });

  it('returns zeroed buckets for no rows', () => {
    const summary = summarizeAging([]);
    expect(summary.total).toBe(0);
    expect(summary.buckets['90+']).toEqual({ count: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/agingSummary.test.ts`
Expected: FAIL — `Failed to resolve import "./agingSummary"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/agingSummary.ts`:

```ts
import { AGING_BUCKETS, agingBucket, type AgingBucket } from './aging';

export interface AgingRow {
  id: string;
  customer_no: string;
  document_no: string | null;
  document_type: string | null;
  posting_date: string | null;
  due_date: string | null;
  currency_code: string | null;
  remaining_amount: number | null;
  days_overdue: number | null;
  as_of_date: string;
}

export interface AgingSummary {
  buckets: Record<AgingBucket, { count: number; total: number }>;
  total: number;
}

export function summarizeAging(rows: AgingRow[]): AgingSummary {
  const buckets = Object.fromEntries(
    AGING_BUCKETS.map((bucket) => [bucket, { count: 0, total: 0 }])
  ) as Record<AgingBucket, { count: number; total: number }>;

  let total = 0;

  for (const row of rows) {
    const bucket = agingBucket(row.days_overdue);
    const amount = row.remaining_amount ?? 0;
    buckets[bucket].count += 1;
    buckets[bucket].total += amount;
    total += amount;
  }

  return { buckets, total };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/agingSummary.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Add the aging query**

Append to `nexus/src/app/actions/businessCentralReceivables.ts`:

```ts
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
```

Import `AgingRow` from `@/lib/businessCentral/agingSummary` at the top of the file.

- [ ] **Step 6: Create the page and dashboard**

Create `nexus/src/app/(protected)/receivables/page.tsx`:

```tsx
import { getAgingPageData } from '@/app/actions/businessCentralReceivables';
import { AgingDashboard } from '@/components/receivables/AgingDashboard';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const { rows, asOfDate } = await getAgingPageData();
  return <AgingDashboard rows={rows} asOfDate={asOfDate} />;
}
```

Create `nexus/src/components/receivables/AgingDashboard.tsx`. It must:

- accept `{ rows: AgingRow[]; asOfDate: string | null }`
- call `summarizeAging(rows)` and render one summary card per bucket in `AGING_BUCKETS` order, showing count and total
- render the total outstanding
- show "As of {asOfDate} (Business Central environment time zone)" so the date basis is never ambiguous
- render a table of open entries: Customer, Document, Type, Posting date, Due date, Days overdue, Remaining — sortable by remaining amount and days overdue
- link the customer column to `/customers` filtered by that customer number
- show an empty state reading "No open receivables. If you expected data here, check that customer ledger entries have synced."

- [ ] **Step 7: Verify**

Run: `cd nexus && npx tsc --noEmit && npm run lint && npm test`
Expected: all exit 0 / pass.

Visit `/receivables` in `npm run dev` as an admin.
Expected: renders the empty state with zeroed buckets.

- [ ] **Step 8: Commit**

```bash
git add nexus/src/lib/businessCentral/agingSummary.ts nexus/src/lib/businessCentral/agingSummary.test.ts nexus/src/app/\(protected\)/receivables nexus/src/components/receivables nexus/src/app/actions/businessCentralReceivables.ts
git commit -m "feat(ar): add AR aging dashboard"
```

---

### Task 13: Posted sales invoice list

**Files:**
- Create: `nexus/src/app/(protected)/receivables/invoices/page.tsx`
- Create: `nexus/src/components/receivables/SalesInvoicesClient.tsx`
- Modify: `nexus/src/app/actions/businessCentralReceivables.ts`
- Modify: `nexus/src/components/layout/AppNav.tsx`

**Interfaces:**
- Consumes: `canViewReceivables` from Task 10.
- Produces: `getSalesInvoicesPageData(): Promise<{ invoices: BusinessCentralSalesInvoice[] }>`.

- [ ] **Step 1: Add the query**

Append to `nexus/src/app/actions/businessCentralReceivables.ts`:

```ts
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
    .order('posting_date', { ascending: false })
    .limit(500);

  return { invoices: (data ?? []) as BusinessCentralSalesInvoice[] };
}
```

- [ ] **Step 2: Create the page**

Create `nexus/src/app/(protected)/receivables/invoices/page.tsx`:

```tsx
import { getSalesInvoicesPageData } from '@/app/actions/businessCentralReceivables';
import { SalesInvoicesClient } from '@/components/receivables/SalesInvoicesClient';

export const dynamic = 'force-dynamic';

export default async function SalesInvoicesPage() {
  const { invoices } = await getSalesInvoicesPageData();
  return <SalesInvoicesClient invoices={invoices} />;
}
```

- [ ] **Step 3: Create the client component**

Create `nexus/src/components/receivables/SalesInvoicesClient.tsx`, matching the table conventions used in Task 11. It must:

- accept `{ invoices: BusinessCentralSalesInvoice[] }`
- provide a search input filtering on `bc_invoice_number`, `customer_name`, and `external_document_number`
- provide a status filter (All plus each distinct `status` present in the data)
- provide from/to date inputs filtering on `posting_date`
- render columns: Invoice number, Customer, Posting date, Due date, Currency, Total incl. tax, Status
- link the customer name to that customer's detail page where `bc_customer_id` matches
- show a note when 500 rows are returned: "Showing the 500 most recent posted invoices."
- show an empty state reading "No posted sales invoices synced yet."

- [ ] **Step 4: Add the nav entry**

In `nexus/src/components/layout/AppNav.tsx`, add "Receivables" → `/receivables` and "Sales invoices" → `/receivables/invoices`, both gated on `canViewReceivables`.

- [ ] **Step 5: Verify**

Run: `cd nexus && npx tsc --noEmit && npm run lint && npm test`
Expected: all exit 0 / pass.

Visit `/receivables/invoices`.
Expected: renders the empty state; nav shows Customers, Receivables, Sales invoices, and Purchase invoices.

- [ ] **Step 6: Commit**

```bash
git add nexus/src/app/\(protected\)/receivables/invoices nexus/src/components/receivables/SalesInvoicesClient.tsx nexus/src/app/actions/businessCentralReceivables.ts nexus/src/components/layout/AppNav.tsx
git commit -m "feat(ar): add posted sales invoice list"
```

---

### Task 14: End-to-end verification against the real environment

No new code unless a defect is found. This is the task that proves the feature works, including the two things unit tests cannot cover: the published OData page and the app registration's permissions.

**Files:**
- Modify: only files needing fixes discovered here.

- [ ] **Step 1: Confirm migrations are applied**

Confirm 041 and 042 are applied to the target Supabase project.

Run in the SQL editor:

```sql
select count(*) from public.business_central_ar_aging;
```

Expected: returns `0` without error. An error means migration 042 is missing.

- [ ] **Step 2: Run a first sync against the TEST environment**

Start the app, select the **TEST** Business Central environment, and click **Sync now** on `/customers`.

Expected: results for all four entities. Record `recordsSynced` and `complete` for each.

If `customer_ledger_entry` returns the `CustomerLedgerPageUnavailableError` message, the OData page or the app registration permission is the cause — fix in BC per the message and re-run. **The other three entities must still report success**; if they do not, the degradation rule in `runAllEntitySyncs` is broken and must be fixed.

- [ ] **Step 3: Continue the backfill to completion**

Click **Sync now** repeatedly until every entity reports `complete: true`.

Expected: `recordsSynced` increases across clicks and never restarts from zero. If a click re-syncs records already pulled, the checkpoint is not persisting — inspect `business_central_sync_checkpoints`.

- [ ] **Step 4: Verify posted-only filtering**

```sql
select distinct status from public.business_central_sales_invoices;
```

Expected: no `Draft` rows.

- [ ] **Step 5: Reconcile aging against Business Central**

Pick three customers with open balances. Compare Nexus's `/receivables` totals against BC's own aged accounts receivable report for the same date.

Expected: totals match. Also compare `business_central_customers.overdue_amount` (BC's own figure) against the sum of that customer's overdue buckets in Nexus — these come from independent sources, so agreement is real evidence.

- [ ] **Step 6: Verify the time zone basis**

Confirm the connection's `time_zone` is set. Check that `as_of_date` on `/receivables` matches today's date **in that time zone**, not the server's.

```sql
select (now() at time zone 'UTC')::date as utc_date,
       (now() at time zone conn.time_zone)::date as env_date
from public.business_central_connections conn;
```

- [ ] **Step 7: Verify permissions**

Sign in as a non-admin user with no overrides.
Expected: `/customers`, `/receivables`, and `/receivables/invoices` are absent from the nav and refuse direct navigation with the permission error.

Grant `viewCustomers` only.
Expected: Customers becomes reachable; Receivables does not.

- [ ] **Step 8: Run the full checks**

Run: `cd nexus && npm test && npm run lint && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 9: Commit any fixes and update the backlog**

```bash
git add -u
git commit -m "fix(ar): corrections from end-to-end verification"
```

Add a `BACKLOG.md` entry recording that pieces A and B are done and that C (customer write-back), D (Bill.com connector), E (invoice push and payment status), and F (payment posting to BC) remain, referencing the feasibility spike document.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: data model → 1; aging view → 2, 3; mappers → 4, 5, 6, 7; sync runner, keyset cursors, time budget, locking → 8, 9; error handling and partial degradation → 8 (`runAllEntitySyncs`), 7 (`CustomerLedgerPageUnavailableError`), 14 (verified); routes → 11, 12, 13; nav relabel → 11; permissions → 10; testing → the test steps throughout plus 14; operational prerequisites → 14 steps 1, 2, 6.

**Deviations, both recorded above:** bucketing lives in TypeScript rather than the view (rationale at the top of this plan); Task 9 deliberately leaves the tree type-broken until Task 10 supplies the permission, rather than introducing a stub that would need removing.

**Type consistency.** `SyncEntityType` (Task 1) is used unchanged in Tasks 8, 9. `SyncEntityAdapter.fetchPage(cursor, top)` and `cursorValue(remote)` match between Tasks 8 and 9. `AgingBucket` and `agingBucket` (Task 2) are consumed unchanged in Task 12. `AgingRow` is defined once in Task 12 and imported by the server action. `CUSTOMER_LEDGER_SERVICE_NAME` is `'CustomerLedgerEntries'` in Tasks 7 and 14, matching the published service.

**Resolved before publication (was a carried risk).** An early draft assumed `client.ts` exposed `fetchImpl` on its returned object and that `withQuery` supported `$orderby`. Reading the file showed neither is true. Both were corrected against the real source rather than left for the implementer to discover:

- Task 7 injects `fetch` as an optional third parameter, matching `noSeriesClient.ts:47-50`. `client.ts` needs no change for it.
- Task 9 defines `listResourcePage` inside `createBcClient` (so it can reach the inner `request` and `companyPath` at `client.ts:267` and `:328`) and builds its own query string, because `withQuery` at `client.ts:540` handles only `$top` and `$filter`.
