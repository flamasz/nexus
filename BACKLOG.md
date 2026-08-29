# Backlog

A running list of things to do. Reference items by number, e.g. "do #2" or "add X to the backlog".

## To do

1. **Ship `feature/bc-item-creation`** — ✅ **manual test PASSED 2026-08-27** (see Done for evidence); branch kept local, not pushed. Remaining: push + open a PR against `main` (PR #1 merged 2026-07-28, so `main` already carries multi-BC-environments).
   - The test was run from `feature/item-categories-page`, which is what supplies the UI to set `bc_no_series_code`. This feature's runtime code is fully exercised, but it cannot be *configured* without the categories page — **ship the two together**, or bc-item-creation lands unusable.
   - Pre-flight in BC: each mapped series must be **Normal (Allow Gaps = false)**, and page 457 must be published as OData service `NoSeriesLines` (done in both environments 2026-08-27).
2. **BC item-creation follow-ups** (the feature itself is built — see Done). Before/around merging `feature/bc-item-creation`:
   - **Pre-merge ops (not code):** apply migrations **038, 039, 040** on deploy; in BC, set each packaging category's mapped No. Series to **Normal (Allow Gaps = false)** — the code refuses non-Normal series with a clear error.
   - **Verify `defaultIsDuplicate` against the real BC sandbox** — confirm the exact duplicate-number error (status/code/message) BC returns on item insert and tighten the heuristic (`nexus/src/app/actions/businessCentralItems.ts`, add a `details.code` check). Safe direction is contained; this is about not mis-handling a real duplicate.
   - ~~**Confirm the OData company key**~~ — ✅ resolved 2026-08-27. `createNoSeriesClientForOrg` uses `company.name`, and both the `NoSeriesLines` read and the `Last_No_Used` PATCH succeeded against TEST, so the key is correct for this tenant.
   - **Optional:** scope `resolveSeriesCodeForCategory` by `bc_connection_id` too (currently org-only; low risk since categories are env-scoped).
   - **Observability:** a post-create commit failure leaves a real BC item with no Nexus row + advanced counter; self-heals on next sync — consider logging a reconciliation warning.
   - Full per-task findings ledger: `.superpowers/sdd/progress.md`.
4. **Phase 4: proper BC item-editing permissions** — replace the temporary admin gates with the dedicated item-manager permission.
   - `nexus/src/components/items/ItemsClient.tsx:137` → use `canEditBusinessCentralItemBcFields` instead of `access.isAdmin`
   - `nexus/src/app/actions/businessCentralItemsSpike.ts:37` → use the dedicated item-manager permission instead of `canManageCatalog`
5. **Phase 5: BC edit-conflict handling** — handle the case where Business Central is updated while an item has unsaved local edits, to prevent silent overwrites. See `nexus/src/components/items/ItemsClient.tsx:1383`.

6. **Ship `feature/item-categories-page`** — ✅ **Task 8 verification PASSED 2026-08-27** (see Done for evidence). All 8 tasks complete; nothing left but shipping. Branch is off `feature/bc-item-creation` — see #1, the two ship together.
   - ⚠️ **On deploy: apply migration 044.** Nothing on the page works without it — the template save needs that unique index as an `ON CONFLICT` arbiter.
   - ⚠️ **On deploy: publish page 457 as OData service `NoSeriesLines`** in every environment, with read *and* write on the No. Series Line table. This was the blocker that held Task 8 up for three weeks; it is a per-environment step that no migration performs.
   - What moved: category settings left `/settings`, the Item Templates card left `/admin`. Both now live at `/item-categories`, reached from a button on the items page. `/admin` keeps BC Credentials and Environments.
7. **Item categories follow-ups** (non-blocking; from the whole-branch review). Findings ledger: `.superpowers/sdd/progress.md`.
   - **Coordinate migration numbering across the two sibling branches.** `feature/item-categories-page` adds 044 while `feature/bc-customer-ar-sync` adds 041–043, and neither contains the other's. No collision and no dependency, but checking out either alone and applying in order skips numbers. Sort this before both land in `main`.
   - **Dead write path:** `bcNoSeriesCode` on `createCategory`/`updateCategory` is now unreachable — the new page writes via `saveCategoryNumbering` instead. Two write paths for one column, one unwired. Remove it, or wire `CategoryForm` to use it.
   - No nav link to `/item-categories` — access is the items-page button by design. Revisit if that proves hard to find.

## Done

- **Merge the multi-BC-environment PR** — PR #1 merged to `main` 2026-07-28. Migrations 027–037 apply on deploy.
- **End-to-end verification of BC auto-numbering (Task 8)** — passed 2026-08-27 against the live TEST environment, after publishing page 457 as OData service `NoSeriesLines` in both environments. Evidence:
  - **Failure cases first** (deliberately, before the happy path): `CHOC-BARKK` → `SeriesNotFoundError`; `J-PL` → `SeriesNotNormalError` ("Allow Gaps must be off"). The second one proves the OData read genuinely reached BC — the Allow-Gaps state can only come from page 457.
  - **Success case:** item **B-2007** ("Haupia Pie Bark - Bag") created in BC from a template. `business_central_items` row has a real `bc_item_id`/`bc_etag`, `sync_status: synced`, `sync_error: null`; sync event `direction: create, status: success`. Template fields landed in BC: `BAG`, `CHOCOLATE-FG`, `CHOC-FG`, `TAXABLE`, `Inventory`. No orphan — the feared "BC item with no Nexus row + advanced counter" did not occur.
  - **Counter advanced correctly:** `Last_No_Used` = `B-2007`, `Last_Date_Used` = the Hawaii date (row written 07:29 UTC on the 28th, so this confirms the per-environment `Pacific/Honolulu` stamping).
  - **Manual override:** typed number used, counter did **not** advance.
- **Replicate BC item creation in Nexus (templates + number series)** — built on branch `feature/bc-item-creation` (stacked on `feature/multi-bc-environments`). 11 commits `8e8679e..5e51db4`; 102/102 tests, lint+tsc clean; full subagent review (per-task + whole-branch). Item-creation templates + per-category auto-numbering that drives BC's real No. Series counter via the published Page 457 OData service ("A+", create-then-advance, Normal-only, advance-only/range/ETag guards, per-environment time-zone date stamp). Spec: `docs/superpowers/specs/2026-06-26-...-design.md`; plan: `docs/superpowers/plans/2026-06-26-...md`. Remaining items moved to To-do #4.
