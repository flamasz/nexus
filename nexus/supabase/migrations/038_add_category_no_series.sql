-- 038_add_category_no_series.sql
-- Map each packaging category to a BC No. Series code (per-environment via existing bc_connection_id).
alter table public.categories
  add column if not exists bc_no_series_code text;

comment on column public.categories.bc_no_series_code is
  'BC No. Series code this packaging category auto-assigns item numbers from. NULL = manual numbering.';
