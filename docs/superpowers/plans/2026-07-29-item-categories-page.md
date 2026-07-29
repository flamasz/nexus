# Item Categories Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A master-detail page giving each packaging category one home for its settings, its Business Central number series, and its item-template defaults — closing the gap where `bc_no_series_code` has no editor anywhere in the app.

**Architecture:** New env-scoped route `/item-categories` mirroring the items page layout. Three independently-saved blocks in the detail pane write to two existing tables (`categories`, `item_templates`). The number series is validated against Business Central on save, reusing the Page 457 OData client and error types that item creation already uses. Replaces category management on `/settings` and the Item Templates card on `/admin`.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase/Postgres, vitest, Tailwind.

**Spec:** [`docs/superpowers/specs/2026-07-28-item-categories-page-design.md`](../specs/2026-07-28-item-categories-page-design.md)

## Global Constraints

- **Permission gate is `access.canManageCatalog`**, obtained via `requireActiveBusinessCentralScope()`. This is exactly what `app/actions/categories.ts` already enforces on create/update/delete. Do NOT use `canManageCategories` — it exists but only drives UI affordances in `OrderBlock.tsx`, and gating on it would render a page whose saves are refused.
- **Everything is environment-scoped.** Category queries filter on BOTH `organization_id` and `bc_connection_id`, matching existing `categories.ts`. Current data: 13 categories in TEST, 1 in Production.
- Category actions use `createClient()` from `@/lib/supabase/server` (the request-scoped client honouring RLS), **not** `createServiceClient()`. Follow existing `categories.ts`.
- Migrations are additive, numbered from **044**. Migrations 015–043 are applied; never edit them. Use the lowercase style of 039–043.
- Test runner is **vitest**, tests colocated (`src/lib/x/foo.ts` → `foo.test.ts`).
- `npx tsc --noEmit` must exit 0. `npm run lint` must add no new warnings beyond the 4 pre-existing. `npm test` must not drop below its baseline.
- **A real page load is part of done.** `npm run build` alone is insufficient — production build and Turbopack dev use different transforms, and a `'use server'` export error shipped in this project with tsc, tests, AND build all green while the page would not load. Verify with `curl -o /dev/null -w "%{http_code}" http://localhost:3000/<route>`; a 307 auth redirect means it compiled, a 500 means it did not.

## Deviation from the spec (recorded deliberately)

The spec says delete must **refuse** when a category is referenced. The existing `deleteCategory` instead **nulls out `items.category_id` and then deletes** — and migration 005 is titled *"Make category_id nullable to allow category deletion"*, with FKs declared `ON DELETE SET NULL`. Detach-then-delete is a deliberate decision, not an oversight.

This plan **preserves that behaviour** and adds a confirmation dialog stating how many items will be detached. Reversing an intentional design choice is out of scope for a UI consolidation.

---

### Task 1: Unique constraint on item_templates.category_id

**Files:**
- Create: `nexus/supabase/migrations/044_one_item_template_per_category.sql`

**Interfaces:**
- Consumes: `item_templates` from migration 039.
- Produces: a unique index guaranteeing at most one template per category.

- [ ] **Step 1: Write the migration**

```sql
-- 044_one_item_template_per_category.sql
-- Make the one-template-per-category relationship real rather than merely
-- assumed by the UI. Categories are already environment-scoped via
-- bc_connection_id, so a category implies its environment and a plain unique
-- index on category_id is sufficient.
--
-- Deliberately NOT a partial index. Two reasons:
--  1. Unnecessary — Postgres treats NULLs as distinct in a unique index, so
--     unlimited rows with a null category_id are already permitted.
--  2. Harmful — Postgres excludes partial indexes from ON CONFLICT arbiter
--     inference unless the statement repeats the predicate, and supabase-js's
--     `onConflict` option emits only a bare column list. A partial index here
--     would make saveCategoryTemplate's upsert fail with error 42P10.

create unique index if not exists item_templates_one_per_category_idx
  on public.item_templates (category_id);
```

- [ ] **Step 2: Apply and verify**

Apply to Supabase, then confirm:

```sql
select indexname from pg_indexes
where tablename = 'item_templates' and indexname = 'item_templates_one_per_category_idx';
```

Expected: one row. There are currently zero templates, so no duplicate reconciliation is needed.

- [ ] **Step 3: Commit**

```bash
git add nexus/supabase/migrations/044_one_item_template_per_category.sql
git commit -m "feat(categories): one item template per category"
```

---

### Task 2: Teach the category actions about bc_no_series_code

The actual blocker. The field is absent from `categories.ts` entirely, so no UI could persist it even if one existed.

**Files:**
- Modify: `nexus/src/app/actions/categories.ts`

**Interfaces:**
- Consumes: existing `createCategory` / `updateCategory`.
- Produces: both accept an optional `bcNoSeriesCode?: string | null`, persisted to the `bc_no_series_code` column.

- [ ] **Step 1: Extend `createCategory`**

Add `bcNoSeriesCode?: string | null;` to its `data` parameter type, and add to the `.insert({ ... })` object:

```ts
      bc_no_series_code: data.bcNoSeriesCode || null,
```

Note `|| null`, not `?? null` — an empty string must clear to null, because blank means manual numbering. This must match `updateCategory` in Step 2; using `??` here would persist `''` on create while update cleared it.

- [ ] **Step 2: Extend `updateCategory`**

Add `bcNoSeriesCode?: string | null;` to its `data` parameter type.

**Important:** `updateCategory` currently does `.update({ ...data, updated_at: ... })`, spreading the camelCase input straight into the query. A key named `bcNoSeriesCode` would be sent to Postgres verbatim and fail, because the column is `bc_no_series_code`. Replace the blanket spread with an explicit mapping so the column names are correct and unknown keys cannot leak through:

```ts
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.width !== undefined) updates.width = data.width;
  if (data.height !== undefined) updates.height = data.height;
  if (data.depth !== undefined) updates.depth = data.depth;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.color !== undefined) updates.color = data.color || null;
  if (data.bcNoSeriesCode !== undefined) {
    updates.bc_no_series_code = data.bcNoSeriesCode || null;
  }
```

Then `.update(updates)`. Note `bcNoSeriesCode` uses `|| null` so an empty string clears it — blank means manual numbering.

- [ ] **Step 3: Type-check and run the suite**

Run: `cd nexus && npx tsc --noEmit && npm test`
Expected: tsc exits 0; tests pass at baseline. Existing callers pass no `bcNoSeriesCode`, so the explicit mapping must leave their behaviour identical — if any existing category test fails, the mapping dropped a field it should have kept.

- [ ] **Step 4: Commit**

```bash
git add nexus/src/app/actions/categories.ts
git commit -m "feat(categories): persist bc_no_series_code on create and update"
```

---

### Task 3: Number series validation

Validates a series code against Business Central so a bad value is caught by the admin who typed it, rather than later by whoever tries to create an item.

**Files:**
- Create: `nexus/src/lib/businessCentral/noSeriesValidation.ts`
- Test: `nexus/src/lib/businessCentral/noSeriesValidation.test.ts`

**Interfaces:**
- Consumes: `NoSeriesClient` and `BcNoSeriesLine` from `./noSeriesClient`; `SeriesNotFoundError` and `SeriesNotNormalError` from `./numberAssigner`.
- Produces: `normalizeSeriesCode(raw: string | null | undefined): string | null`; `validateSeriesCode(noSeries: NoSeriesClient, raw: string | null | undefined): Promise<string | null>`.

- [ ] **Step 1: Write the failing tests**

Create `nexus/src/lib/businessCentral/noSeriesValidation.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { normalizeSeriesCode, validateSeriesCode } from './noSeriesValidation';
import { SeriesNotFoundError, SeriesNotNormalError } from './numberAssigner';
import type { BcNoSeriesLine, NoSeriesClient } from './noSeriesClient';

function line(overrides: Partial<BcNoSeriesLine> = {}): BcNoSeriesLine {
  return {
    seriesCode: 'NEXUS-TEST',
    lineNo: 10000,
    startingNo: 'NX000001',
    endingNo: 'NX999999',
    lastNoUsed: 'NX000004',
    lastDateUsed: '2026-07-29',
    incrementByNo: 1,
    implementation: 'Normal',
    open: true,
    etag: 'W/"e"',
    ...overrides,
  };
}

function fakeClient(result: BcNoSeriesLine | null): NoSeriesClient {
  return {
    getOpenLine: vi.fn(async () => result),
    advanceLine: vi.fn(),
  } as unknown as NoSeriesClient;
}

describe('normalizeSeriesCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeSeriesCode('  nexus-test  ')).toBe('NEXUS-TEST');
  });

  it('treats blank and whitespace-only as null (manual numbering)', () => {
    expect(normalizeSeriesCode('')).toBeNull();
    expect(normalizeSeriesCode('   ')).toBeNull();
    expect(normalizeSeriesCode(null)).toBeNull();
    expect(normalizeSeriesCode(undefined)).toBeNull();
  });
});

describe('validateSeriesCode', () => {
  it('returns null for a blank code without calling BC', async () => {
    const client = fakeClient(null);
    await expect(validateSeriesCode(client, '')).resolves.toBeNull();
    expect(client.getOpenLine).not.toHaveBeenCalled();
  });

  it('accepts a Normal series and returns the normalized code', async () => {
    const client = fakeClient(line());
    await expect(validateSeriesCode(client, ' nexus-test ')).resolves.toBe('NEXUS-TEST');
    expect(client.getOpenLine).toHaveBeenCalledWith('NEXUS-TEST');
  });

  it('rejects a code BC does not know', async () => {
    const client = fakeClient(null);
    await expect(validateSeriesCode(client, 'NOPE')).rejects.toBeInstanceOf(SeriesNotFoundError);
  });

  it('rejects a series that allows gaps, naming the requirement', async () => {
    const client = fakeClient(line({ implementation: 'Sequence' }));
    await expect(validateSeriesCode(client, 'NEXUS-TEST')).rejects.toBeInstanceOf(
      SeriesNotNormalError
    );
    await expect(validateSeriesCode(client, 'NEXUS-TEST')).rejects.toThrow(/Allow Gaps/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd nexus && npx vitest run src/lib/businessCentral/noSeriesValidation.test.ts`
Expected: FAIL — `Failed to resolve import "./noSeriesValidation"`.

- [ ] **Step 3: Write the implementation**

Create `nexus/src/lib/businessCentral/noSeriesValidation.ts`:

```ts
import type { NoSeriesClient } from './noSeriesClient';
import { SeriesNotFoundError, SeriesNotNormalError } from './numberAssigner';

/**
 * Blank means manual numbering, so it normalizes to null rather than ''.
 * BC series codes are uppercase, so we uppercase to avoid a code that looks
 * correct to the admin but does not match on lookup.
 */
export function normalizeSeriesCode(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

/**
 * Confirms a series exists in Business Central and is Normal (Allow Gaps off).
 *
 * Item creation already refuses anything else — see numberAssigner — but it
 * does so at item-creation time, which puts the error in front of whoever
 * happens to be creating an item rather than the admin who configured it.
 * Validating on save moves the failure to the person who can fix it.
 *
 * Returns the normalized code, or null when blank (manual numbering).
 */
export async function validateSeriesCode(
  noSeries: NoSeriesClient,
  raw: string | null | undefined
): Promise<string | null> {
  const code = normalizeSeriesCode(raw);
  if (!code) return null;

  const line = await noSeries.getOpenLine(code);
  if (!line) throw new SeriesNotFoundError(code);
  if (line.implementation !== 'Normal') throw new SeriesNotNormalError(code);

  return code;
}
```

Both error constructors take a single `seriesCode: string` — verified in `numberAssigner.ts`:
- `SeriesNotFoundError` → `No. Series 'X' has no line in BC`
- `SeriesNotNormalError` → `No. Series 'X' is not Normal (Allow Gaps must be off) — set it to Normal in BC to enable auto-numbering`

Reuse them as-is. Do not define new error types and do not reword these — they are shared with item creation, so one definition keeps both surfaces consistent.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd nexus && npx vitest run src/lib/businessCentral/noSeriesValidation.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/businessCentral/noSeriesValidation.ts nexus/src/lib/businessCentral/noSeriesValidation.test.ts
git commit -m "feat(categories): validate No. Series against BC on save"
```

---

### Task 4: Server actions for the page

**Files:**
- Create: `nexus/src/app/actions/itemCategories.ts`

**Interfaces:**
- Consumes: `requireActiveBusinessCentralScope`, `createClient`, `createNoSeriesClientForOrg`, `validateSeriesCode`, `Category`, `ItemTemplate`, `DimensionUnit`.
- Produces:
  - `interface ItemCategoryRow { category: Category; template: ItemTemplate | null }` — **lives in `nexus/src/types/itemCategories.ts`, NOT in the actions file.** A `'use server'` module may only export async functions; keeping types out of it removes any question about how the Turbopack transform handles them.
  - `getItemCategoriesPageData(): Promise<{ rows: ItemCategoryRow[]; canManage: boolean }>`
  - `getCategoryItemCount(categoryId: string): Promise<number>` — exact count for ONE category via a head-only count query. Used by the delete confirmation. Deliberately not a bulk count on page load: PostgREST caps rows (typically 1000), so tallying every `items` row in JavaScript would silently undercount on a large org — and that number is what the user sees before agreeing to detach.
  - `saveCategorySettings(id, { name, width, height, depth, unit, color }): Promise<Category>`
  - `saveCategoryNumbering(id, { bcNoSeriesCode }): Promise<Category>`
  - `saveCategoryTemplate(categoryId, input): Promise<ItemTemplate>`
  - `createItemCategory(name: string): Promise<Category>`
  - `deleteItemCategory(id: string): Promise<void>`

- [ ] **Step 1: Write the actions file**

Create `nexus/src/app/actions/itemCategories.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createNoSeriesClientForOrg } from '@/lib/businessCentral/noSeriesClient';
import { validateSeriesCode } from '@/lib/businessCentral/noSeriesValidation';
import { createClient } from '@/lib/supabase/server';
import { Category, DimensionUnit, ItemTemplate } from '@/types/database';

export interface ItemCategoryRow {
  category: Category;
  template: ItemTemplate | null;
  itemCount: number;
}

async function requireManage() {
  const scope = await requireActiveBusinessCentralScope();
  if (!scope.access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }
  return scope;
}

export async function getItemCategoriesPageData(): Promise<{
  rows: ItemCategoryRow[];
  canManage: boolean;
}> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('name', { ascending: true });
  if (error) throw error;

  const categoryIds = (categories ?? []).map((c) => c.id);

  const [{ data: templates }, { data: items }] = await Promise.all([
    supabase.from('item_templates').select('*').in('category_id', categoryIds.length ? categoryIds : ['']),
    supabase
      .from('items')
      .select('category_id')
      .eq('organization_id', orgId)
      .eq('bc_connection_id', bcConnectionId)
      .in('category_id', categoryIds.length ? categoryIds : ['']),
  ]);

  const templateByCategory = new Map<string, ItemTemplate>();
  for (const t of (templates ?? []) as ItemTemplate[]) {
    if (t.category_id) templateByCategory.set(t.category_id, t);
  }

  const counts = new Map<string, number>();
  for (const row of items ?? []) {
    const key = (row as { category_id: string | null }).category_id;
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    rows: ((categories ?? []) as Category[]).map((category) => ({
      category,
      template: templateByCategory.get(category.id) ?? null,
      itemCount: counts.get(category.id) ?? 0,
    })),
    canManage: access.canManageCatalog,
  };
}

export async function saveCategorySettings(
  id: string,
  input: {
    name: string;
    width: number | null;
    height: number | null;
    depth: number | null;
    unit: DimensionUnit;
    color: string | null;
  }
): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();
  const name = input.name.trim();
  if (!name) throw new Error('Category name is required');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .update({
      name,
      width: input.width,
      height: input.height,
      depth: input.depth,
      unit: input.unit,
      color: input.color || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export async function saveCategoryNumbering(
  id: string,
  input: { bcNoSeriesCode: string | null }
): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();

  // Validated against BC BEFORE persisting, so an invalid or gap-allowing
  // series is never stored. Throws SeriesNotFoundError / SeriesNotNormalError,
  // both of which carry admin-readable messages.
  const noSeries = await createNoSeriesClientForOrg(orgId, bcConnectionId);
  const code = await validateSeriesCode(noSeries, input.bcNoSeriesCode);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ bc_no_series_code: code, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export interface CategoryTemplateInput {
  bcItemCategoryCode: string | null;
  defaultType: string;
  baseUnitOfMeasureCode: string | null;
  taxGroupCode: string | null;
  generalProductPostingGroupCode: string | null;
  inventoryPostingGroupCode: string | null;
  priceIncludesTax: boolean;
  blocked: boolean;
}

export async function saveCategoryTemplate(
  categoryId: string,
  input: CategoryTemplateInput
): Promise<ItemTemplate> {
  const { orgId, bcConnectionId } = await requireManage();
  const supabase = await createClient();

  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('id', categoryId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();
  if (catError) throw catError;

  const { data, error } = await supabase
    .from('item_templates')
    .upsert(
      {
        organization_id: orgId,
        bc_connection_id: bcConnectionId,
        // One template per category, so the template's name is derived rather
        // than separately editable — there is nothing to disambiguate.
        name: (category as { name: string }).name,
        category_id: categoryId,
        bc_item_category_code: input.bcItemCategoryCode,
        default_type: input.defaultType,
        base_unit_of_measure_code: input.baseUnitOfMeasureCode,
        tax_group_code: input.taxGroupCode,
        general_product_posting_group_code: input.generalProductPostingGroupCode,
        inventory_posting_group_code: input.inventoryPostingGroupCode,
        price_includes_tax: input.priceIncludesTax,
        blocked: input.blocked,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category_id' }
    )
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as ItemTemplate;
}

export async function createItemCategory(name: string): Promise<Category> {
  const { orgId, bcConnectionId } = await requireManage();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: trimmed,
      unit: 'mm' as DimensionUnit,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
    })
    .select()
    .single();
  if (error) throw error;

  revalidatePath('/item-categories');
  return data as Category;
}

export async function deleteItemCategory(id: string): Promise<void> {
  const { orgId, bcConnectionId } = await requireManage();
  const supabase = await createClient();

  // Detach rather than refuse: migration 005 ("Make category_id nullable to
  // allow category deletion") and the ON DELETE SET NULL foreign keys make
  // this the intended behaviour. The UI confirms the affected item count first.
  const { error: detachError } = await supabase
    .from('items')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);
  if (detachError) throw detachError;

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);
  if (error) throw error;

  revalidatePath('/item-categories');
}
```

Its signature is verified as `createNoSeriesClientForOrg(orgId: string, connectionId?: string)`, so passing `bcConnectionId` positionally as written is correct.

- [ ] **Step 2: Type-check**

Run: `cd nexus && npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add nexus/src/app/actions/itemCategories.ts
git commit -m "feat(categories): server actions for the item categories page"
```

---

### Task 5: The three detail blocks

**Files:**
- Create: `nexus/src/components/itemCategories/CategorySettingsBlock.tsx`
- Create: `nexus/src/components/itemCategories/CategoryNumberingBlock.tsx`
- Create: `nexus/src/components/itemCategories/CategoryTemplateBlock.tsx`

**Interfaces:**
- Consumes: the save actions from Task 4; `Category` and `ItemTemplate` types; `CATEGORY_COLORS` / `COLOR_KEYS` from `@/lib/categoryColors`.
- Produces: three client components, each `{ category, onSaved }` (the template block additionally takes `template: ItemTemplate | null`).

- [ ] **Step 1: Read the conventions to match**

Run: `cd nexus && sed -n '1,60p' src/components/customers/CustomerDetail.tsx`

Match the primitives it imports from `@/components/ui/...`, its card/section markup, and its class conventions. This project has an established dark UI design system — introduce no new visual patterns, no bespoke CSS, no new libraries.

- [ ] **Step 2: Build `CategorySettingsBlock`**

A bordered card headed "Category settings" containing:
- **Name** — text input, required
- **Dimensions** — three numeric inputs (W, H, D), each nullable, plus a **unit** select of `mm` / `cm` / `in` (the `DimensionUnit` union)
- **Badge colour** — a select or swatch picker over `COLOR_KEYS` from `@/lib/categoryColors`, rendering each option with its own colour classes so the choice is visible

A **Save** button, disabled unless the block is dirty and enabled only when `canManage`. On submit call `saveCategorySettings`, show the error text inline on failure, and call `onSaved(updatedCategory)` on success. Use `useTransition` and disable the button while pending so a double-click cannot double-submit.

- [ ] **Step 3: Build `CategoryNumberingBlock`**

A bordered card headed "Numbering" containing a single **No. Series code** text input bound to `category.bc_no_series_code`, with helper text explaining that leaving it blank means item numbers are entered manually, and that the series must be **Normal (Allow Gaps off)** in Business Central.

Its **Save** calls `saveCategoryNumbering`. This action performs a live BC round trip, so:
- show a pending state that makes clear it is checking against Business Central
- on success, show a brief confirmation including the normalized (uppercased) code that was stored, since the input may differ from what was saved
- on failure, render the thrown error message verbatim — `SeriesNotFoundError` and `SeriesNotNormalError` already carry admin-readable text naming the code and the Allow Gaps requirement. Do NOT replace them with a generic message.

- [ ] **Step 4: Build `CategoryTemplateBlock`**

A bordered card headed "Item template defaults" with fields for: BC item category code, default type (text, defaulting to `Inventory`), base unit of measure, tax group, general product posting group, inventory posting group, and checkboxes for price-includes-tax and blocked.

When `template` is null, show empty fields and a note that no template exists yet and saving will create one. Its **Save** calls `saveCategoryTemplate`, which upserts.

- [ ] **Step 5: Verify**

Run: `cd nexus && npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add nexus/src/components/itemCategories
git commit -m "feat(categories): detail blocks for settings, numbering and template"
```

---

### Task 6: Page shell, route, and items-page entry button

**Files:**
- Create: `nexus/src/app/(protected)/item-categories/page.tsx`
- Create: `nexus/src/components/itemCategories/ItemCategoriesClient.tsx`
- Modify: `nexus/src/components/items/ItemsClient.tsx`

**Interfaces:**
- Consumes: `getItemCategoriesPageData`, `createItemCategory`, `deleteItemCategory`, and the three blocks from Task 5.

- [ ] **Step 1: Create the route**

Create `nexus/src/app/(protected)/item-categories/page.tsx`:

```tsx
import { getItemCategoriesPageData } from '@/app/actions/itemCategories';
import { ItemCategoriesClient } from '@/components/itemCategories/ItemCategoriesClient';

export const dynamic = 'force-dynamic';

export default async function ItemCategoriesPage() {
  const { rows, canManage } = await getItemCategoriesPageData();
  return <ItemCategoriesClient rows={rows} canManage={canManage} />;
}
```

- [ ] **Step 2: Build `ItemCategoriesClient`**

A master-detail shell mirroring the items page layout. It must:

- accept `{ rows: ItemCategoryRow[]; canManage: boolean }`
- render a searchable left list filtering on category name; each row shows the colour badge and the numbering state using the existing convention — `Name (SERIES)` when `bc_no_series_code` is set, `Name (manual)` when null. That makes the list itself answer "which categories have auto-numbering?"
- select the first category by default, and reflect the selected id in the URL via a `?id=` search param so the view is linkable — follow however `ItemsClient.tsx` already does this rather than inventing a mechanism
- render the three blocks stacked in the detail pane, in order: settings, numbering, template
- provide a **New category** action (name only) calling `createItemCategory`, then select the created row
- provide **Delete** in the detail pane. It must confirm first, and the confirmation must state how many items will be detached from this category — deletion detaches rather than refuses, and the user should know that before agreeing. Fetch the number by calling `getCategoryItemCount(category.id)` when the confirmation opens; there is deliberately no bulk count on the row (see Task 4). Show a loading state while the count resolves rather than a misleading zero, and do not block deletion if the count query fails — fall back to a confirmation that warns items may be detached without naming a number
- show an empty state when there are no categories at all
- gate every mutating affordance on `canManage`

- [ ] **Step 3: Add the entry button on the items page**

In `nexus/src/components/items/ItemsClient.tsx`, the header element spans roughly lines 331–427. Insert a link/button **after the closing `</header>` tag and before the items list** — below the header bar, above the list, as specified.

It links to `/item-categories`, is labelled "Item categories", and is rendered only when the user can manage the catalogue. Read how `ItemsClient` already accesses `access` and match it; do not add a new prop if one is already available.

- [ ] **Step 4: Verify, including a real page load**

Run: `cd nexus && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean; the suite at or above baseline.

Then, with the dev server running:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/item-categories
```

Expected: `307` (the auth redirect — proves it compiled). A `500` means a dev-only compile failure that `npm run build` did not catch. This step is mandatory.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/app/\(protected\)/item-categories nexus/src/components/itemCategories/ItemCategoriesClient.tsx nexus/src/components/items/ItemsClient.tsx
git commit -m "feat(categories): item categories page and items-page entry point"
```

---

### Task 7: Remove the superseded surfaces

The riskiest task, because it takes away screens people may be using. Everything before this was additive.

**Files:**
- Modify: `nexus/src/app/(protected)/settings/page.tsx`
- Modify: `nexus/src/app/(protected)/admin/page.tsx`
- Possibly delete: `nexus/src/components/items/ItemTemplatesCard.tsx`

- [ ] **Step 1: Remove category management from `/settings`**

Strip the category list, the `CategoryForm` usage, and the now-unused imports (`CategoryForm`, `getCategories`, `updateCategory`, `deleteCategory`, `getCategoryColorClasses`, `formatDimensions`, and the related state and handlers). Leave the order-settings portion of that page untouched.

Do NOT delete `CategoryForm.tsx` itself without checking for other consumers:

```bash
cd nexus && grep -rn "CategoryForm" src | grep -v "components/packaging/CategoryForm.tsx"
```

`OrderBlock.tsx` is known to create and edit categories inline, so `CategoryForm` is very likely still needed. Removing a component another screen depends on would break order entry.

- [ ] **Step 2: Remove the Item Templates card from `/admin`**

Delete the `ItemTemplatesCard` import and its `<ItemTemplatesCard />` usage from `admin/page.tsx`. Leave `BcCredentialsCard` and `BcEnvironmentsCard` in place — those are connection configuration, not catalogue.

Then check whether the card file is now orphaned:

```bash
cd nexus && grep -rn "ItemTemplatesCard" src | grep -v "components/items/ItemTemplatesCard.tsx"
```

If nothing references it, delete the file and its tests. If something does, leave it.

- [ ] **Step 3: Check for orphaned template actions**

Run: `cd nexus && grep -rn "createItemTemplate\|updateItemTemplate\|deleteItemTemplate\|listItemTemplates" src`

The item-creation flow in `ItemsClient.tsx` reads templates, so `listItemTemplates` is probably still used. Report what remains; delete only genuinely unreferenced exports and leave the rest.

- [ ] **Step 4: Verify**

Run: `cd nexus && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all clean. Removing code commonly leaves unused imports — lint must be clean, not merely error-free.

Then load all three affected routes against the dev server:

```bash
for r in /settings /admin /item-categories /items; do
  printf "%s -> " "$r"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$r"
done
```

Expected: every route returns 307, not 500.

- [ ] **Step 5: Commit**

```bash
git add -u nexus/src
git commit -m "refactor(categories): retire category settings and templates card"
```

---

### Task 8: End-to-end verification against Business Central

No new code unless a defect is found. This proves the thing the whole page exists for.

- [ ] **Step 1: Confirm migration 044 is applied**

Verify `item_templates_one_per_category_idx` exists (Task 1, Step 2).

- [ ] **Step 2: Create a category through the new page**

Sign in as an admin, select the **TEST** environment, open `/items`, click **Item categories**, then **New category**. Save settings — name, dimensions, a badge colour — and confirm the values persist across a reload.

- [ ] **Step 3: Test the numbering validation — the failure cases first**

In the Numbering block:
- Enter a series code that does not exist in BC. **Expected:** save is refused with a message naming the code. Nothing is stored.
- Point it at a series whose **Allow Gaps is on**, if you have one. **Expected:** refused with a message naming the Allow Gaps requirement.
- Enter a valid **Normal** series in lowercase. **Expected:** saved, and the confirmation shows the code uppercased.
- Clear the field. **Expected:** saved as manual, no BC round trip needed.

Testing the failures before the success matters: a validator that accepts everything also passes the happy path.

- [ ] **Step 4: Confirm the list reflects numbering state**

The left list should now show that category as `Name (SERIES)` rather than `Name (manual)`.

- [ ] **Step 5: Save template defaults, then verify the whole point of the feature**

Fill in the template block and save. Then go to `/items` → **New item**, pick that category's template, and confirm:
- fields pre-fill from the template
- the number preview reads that it will be assigned from your series
- creating the item lands it in BC with the next number, and the series' `Last_No_Used` advances

This is the item-creation feature being exercised end to end through real UI for the first time — previously it could only have been tested by editing the database directly. **Note it writes a real item to BC and permanently advances the counter.**

- [ ] **Step 6: Confirm the removals did not orphan anything**

Check `/settings` still manages order settings, `/admin` still manages BC credentials and environments, and that creating or editing a category inline from an order still works (that path uses `CategoryForm`).

- [ ] **Step 7: Commit any fixes and update the backlog**

```bash
git add -u
git commit -m "fix(categories): corrections from end-to-end verification"
```

Record in `BACKLOG.md` that the item categories page is done, and that it unblocks manual testing of `feature/bc-item-creation`.

---

## Self-Review

**Spec coverage.** Route and env-scoped master-detail → Task 6. Unique template constraint → Task 1. The `bc_no_series_code` action gap → Task 2. BC validation on save → Task 3, wired in Task 4. Three per-block saves → Tasks 4 and 5. List numbering state, create, delete → Task 6. Removals → Task 7. Permissions (`canManageCatalog`) → Global Constraints, enforced in Task 4's `requireManage`. Testing → Task 3's unit tests plus the verification steps in Tasks 6, 7 and 8.

**Deviations, both recorded above:** delete detaches rather than refuses (preserving migration 005's deliberate design); and the template's `name` is derived from the category rather than separately editable, since one template per category leaves nothing to disambiguate.

**Where this plan deliberately has no unit tests.** Only Task 3 is unit-tested. The server actions in Task 4 depend on a request-scoped Supabase client and there is no existing precedent in this repo for testing server actions in isolation — the established pattern tests pure modules (mappers, calculations, validation) and verifies actions through use. Inventing a mocking harness here would be new infrastructure beyond this feature's scope. Task 8 is what covers them, which is why its failure cases are enumerated rather than left to judgement.

**Amendments made during implementation** (Task 4's review found all three):
1. Migration 044 is a plain, not partial, unique index — a partial index cannot serve as an `ON CONFLICT` arbiter, which would have made every template save fail with error 42P10. The predicate was also unnecessary, since Postgres already treats NULLs as distinct in a unique index.
2. `ItemCategoryRow` and `CategoryTemplateInput` live in `nexus/src/types/itemCategories.ts`, not in the `'use server'` actions file. The Task 4 code block below still shows them inline — the types file is authoritative.
3. `itemCount` was removed from `ItemCategoryRow` in favour of `getCategoryItemCount(categoryId)`, because a bulk JS tally silently undercounts past PostgREST's row cap. The Task 4 code block below still shows the bulk count — the amended shape is authoritative.

**Type consistency.** `ItemCategoryRow` is defined once (in the types module) and consumed unchanged in Task 6. `CategoryTemplateInput` is defined in Task 4 and consumed in Task 5. `validateSeriesCode` / `normalizeSeriesCode` signatures match between Tasks 3 and 4. `DimensionUnit` is the existing `"mm" | "cm" | "in"` union. `COLOR_KEYS` comes from the existing `categoryColors` module.

**Verified against real source while writing, rather than assumed:** the permission key actually enforced by `categories.ts` (`canManageCatalog`, not `canManageCategories`); that `updateCategory`'s blanket `{...data}` spread would send a camelCase key to Postgres and therefore needs replacing; that `SeriesNotNormalError` already exists with an Allow-Gaps message worth reusing; that `deleteCategory` detaches items rather than refusing; and that `items` — not `packaging_items` — is the current table name, despite what `nexus/CLAUDE.md` says.
