-- 042_add_ar_aging_view.sql
-- Open customer ledger entries with days_overdue computed in the connection's
-- own time zone. Bucketing lives in TypeScript (src/lib/businessCentral/aging.ts)
-- so the boundaries have exactly one definition.

-- security_invoker = true makes Postgres evaluate row-level security using the
-- querying user's privileges instead of the view owner's. Supabase migrations
-- run as a privileged (BYPASSRLS) role, so without this option the org-scoped
-- bc_cust_ledger_select policy on business_central_customer_ledger_entries
-- would never be enforced for clients querying this view via PostgREST,
-- letting any authenticated user read every organization's receivables.
create or replace view public.business_central_ar_aging
with (security_invoker = true) as
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
left join public.business_central_connections conn on conn.id = e.bc_connection_id
where e.open;
