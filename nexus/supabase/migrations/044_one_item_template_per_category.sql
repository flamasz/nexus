-- 044_one_item_template_per_category.sql
-- Make the one-template-per-category relationship real rather than merely
-- assumed by the UI. Categories are already environment-scoped via
-- bc_connection_id, so a category implies its environment and a plain unique
-- index on category_id is sufficient.
--
-- No WHERE predicate: Postgres unique indexes already treat NULLs as
-- distinct, so a plain unique index on a nullable column already permits
-- unlimited NULL rows without needing a partial predicate. A partial index
-- also cannot serve as an ON CONFLICT arbiter unless the statement repeats
-- the exact predicate, and supabase-js's `onConflict` option only emits a
-- bare column list — so a partial index here would make
-- `saveCategoryTemplate`'s upsert fail with Postgres error 42P10.

create unique index if not exists item_templates_one_per_category_idx
  on public.item_templates (category_id);
