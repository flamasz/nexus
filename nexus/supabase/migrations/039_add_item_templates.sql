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
