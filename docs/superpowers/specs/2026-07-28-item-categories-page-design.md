# Item Categories Page — Design

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation planning.

## Summary

A single master-detail page for managing packaging categories: the category's own settings, its Business Central number series, and its item-creation template defaults. It replaces category management on `/settings` and the Item Templates card on `/admin`.

## Why this exists

`categories.bc_no_series_code` was added by migration 038 and is displayed by the Item Templates card, but **nothing in the application can set it** — the field is absent from the category form *and* from the categories server actions.

The consequence is that the headline feature of `feature/bc-item-creation` — per-category automatic item numbering — cannot be enabled by an administrator at all. Every category falls back to manual numbering unless someone edits the database directly. This page is what makes that feature usable.

A secondary motivation: the same category is currently managed across two screens (`/settings` for name/dimensions/colour, `/admin` for template defaults) with the numbering field homeless. Consolidating gives categories one place to live.

## Goals

- Provide the missing editor for `bc_no_series_code`.
- Give categories a single home covering settings, numbering, and item template defaults.
- Validate the number series against Business Central at configuration time rather than at item-creation time.

## Non-goals

- No changes to how categories are consumed by packaging items, order lines, or artwork.
- No new permission keys.
- No usage-statistics block. Referenced-category protection surfaces only as a delete guard.
- No changes to BC Credentials or BC Environments management, which remain on `/admin`.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Category source | The existing `categories` table | Already shared by packaging items and purchase order lines. No new table, no migration for the data itself. |
| Template cardinality | One template per category | Categories are already environment-scoped (`bc_connection_id`), so a category implies its environment. "One per category per environment" therefore collapses to `unique(category_id)`. |
| Existing surfaces | Replaced | Category editing leaves `/settings`; `ItemTemplatesCard` leaves `/admin`. One home per concept. |
| Save granularity | Per block | The blocks write to two different tables. A template failure must not discard category edits, and errors belong next to the fields that caused them. |
| No. Series validation | Verified against BC on save | Turns a documented manual pre-flight into something the app enforces (see below). |
| Permissions | Reuse the existing `canManageCatalog` | This is what `app/actions/categories.ts` already enforces on create, update, and delete. No new key. |

## Data model

No new tables. Both `categories` and `item_templates` already carry everything needed.

**One schema change:** a unique constraint on `item_templates.category_id` (where not null), making the one-to-one relationship real rather than merely assumed by the UI. There are currently zero templates, so nothing needs reconciling.

**One server-action gap to close:** `app/actions/categories.ts` does not accept `bc_no_series_code` at all. It must be added — this is the actual blocker, not merely a missing form field.

Categories are environment-scoped and the page follows that: it lists categories belonging to the active BC connection, and switching environments switches the list. Current data is 13 categories in TEST and 1 in Production.

## Number series validation

When the numbering block is saved with a non-empty series code, the action verifies it against Business Central using the existing `createNoSeriesClientForOrg` (the published Page 457 OData service already used by item creation). Two conditions are checked:

1. The series code exists.
2. It is **Normal** — `Allow Gaps = false`.

Both are already hard requirements of the item-creation code, which refuses anything else. Validating here moves the failure from item-creation time to configuration time, so the person who sees the error is the person who typed the value, while they are still looking at the field.

A validation failure rejects the save with a specific message naming the series code and the reason. Blanking the field is always allowed and means manual numbering.

Cost: one BC round trip per numbering save. Acceptable for an administrative action.

## UI

### Layout

Master-detail, mirroring the items page: searchable category list on the left, selected category's detail on the right.

**Entry point:** a button on the items page, positioned below the header bar and above the items list, gated on the same permission as the page.

### List

- Search by category name.
- Each row shows the category's colour badge and its numbering state, reusing the existing `Name (SERIES)` / `(manual)` convention from the templates card. The list therefore answers "which categories have auto-numbering?" at a glance.
- A **New category** action creates a minimal record (name only) and selects it; remaining fields are filled through the normal blocks rather than a separate creation form.

### Detail blocks

Three stacked bordered cards, each with its own heading and its own Save button, disabled until that block is dirty.

**1. Category settings** — name, width/height/depth + unit, badge colour. Writes `categories`.

**2. Numbering** — `bc_no_series_code`, with inline validation feedback from the BC check. Writes `categories`.

**3. Item template defaults** — BC item category code, default type, base unit of measure, tax group, general product posting group, inventory posting group, price-includes-tax, blocked. Writes `item_templates`, upserting on first save so a category with no existing template works without a separate create step.

### Delete

Lives in the detail pane. It must refuse when the category is referenced by packaging items or order lines, with a message stating the count — deleting a category out from under existing orders would orphan real data.

## Files

| File | Responsibility |
|---|---|
| `app/(protected)/item-categories/page.tsx` | Route, data fetch, permission gate |
| `components/itemCategories/ItemCategoriesClient.tsx` | Master-detail shell, search, new, delete |
| `components/itemCategories/CategorySettingsBlock.tsx` | Name, dimensions, colour |
| `components/itemCategories/CategoryNumberingBlock.tsx` | Number series + validation feedback |
| `components/itemCategories/CategoryTemplateBlock.tsx` | Item template defaults |
| `app/actions/itemCategories.ts` | Per-block save actions, create, delete |

Blocks are separate components deliberately. `ItemsClient.tsx` has grown to roughly 1,400 lines and is difficult to work in; this page should not repeat that.

## Removals

- Category management is removed from `/settings`.
- `ItemTemplatesCard` is removed from `/admin`.

BC Credentials and BC Environments stay on `/admin` — those are connection configuration, not catalogue.

These removals are the riskiest part of the change, because everything else is additive. They can be sequenced as a follow-up step if the new page should prove itself first.

## Permissions

Reuse the existing **`canManageCatalog`**. That is what `app/actions/categories.ts` already enforces on create, update, and delete, so gating the page on anything else would produce a screen that renders but whose saves are refused. The page, the items-page entry button, and every new server action use that one gate.

Worth recording, and worth *not* propagating: `canManageCategories` exists as a separate key and is used for UI affordances in `OrderBlock.tsx`, while the underlying category actions check `canManageCatalog`. This design does not attempt to resolve that inconsistency; it follows what the actions actually enforce.

## Testing

- **Per-block save actions**, including that saving one block does not clobber another block's fields.
- **Number series validation** against a fake BC client: a valid Normal series is accepted; a non-existent code is rejected with a clear message; a gap-allowing series is rejected naming the Allow Gaps requirement; a blank value is accepted and means manual.
- **Delete guard** — a category referenced by a packaging item or an order line refuses deletion and reports the count.
- **Unique constraint** — a second template for the same category is rejected.
- **A real page load against the dev server**, not only `npm run build`. Production `next build` and Turbopack dev use different transforms; a `'use server'` export error shipped earlier in this project with `tsc`, tests, and build all green while the page would not load. Loading the route is part of the definition of done.

## Open questions

None blocking.
