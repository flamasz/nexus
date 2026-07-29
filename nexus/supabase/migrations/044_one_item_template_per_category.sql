-- 044_one_item_template_per_category.sql
-- Make the one-template-per-category relationship real rather than merely
-- assumed by the UI. Categories are already environment-scoped via
-- bc_connection_id, so a category implies its environment and a plain unique
-- index on category_id is sufficient. Partial, because category_id is
-- nullable and NULLs must stay unconstrained.

create unique index if not exists item_templates_one_per_category_idx
  on public.item_templates (category_id)
  where category_id is not null;
