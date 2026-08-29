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
alter table public.business_central_item_sync_events
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
