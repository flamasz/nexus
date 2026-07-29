# Backlog

A running list of things to do. Reference items by number, e.g. "do #2" or "add X to the backlog".

## To do

1. **Test & ship `feature/bc-item-creation`** — feature is built and reviewed (see Done); branch kept local, not pushed. Manual test, then push + open a PR (target `feature/multi-bc-environments` since it stacks on it, or `main` after PR #1 merges).
   - **To test locally:** on branch `feature/bc-item-creation`, apply migrations **038, 039, 040** to Supabase; give a packaging category a `bc_no_series_code` (use `NEXUS-TEST` — a Normal series); `cd nexus && npm run dev`.
     - Settings/admin → **Item Templates**: create a template pointing at that category.
     - Items → **New item**: pick the template (fields pre-fill), number shows "Will be assigned from NEXUS-TEST on save"; create → confirm item lands in BC with the next `NX######` and `NEXUS-TEST` `Last_No_Used`/`Last_Date_Used` advanced. Toggle **Set manually** → typed number is used and the counter is NOT advanced.
     - Optionally set the environment's **Time zone** to `Pacific/Honolulu` and confirm `Last_Date_Used` matches the Hawaii date.
   - Pre-flight in BC: each mapped series must be **Normal (Allow Gaps = false)**.
2. **Merge the multi-BC-environment PR** — PR open at https://github.com/flamasz/nexus/pull/1. Review, then merge. ⚠️ Apply migrations 027–037 to Supabase on deploy.
3. **BC item-creation follow-ups** (the feature itself is built — see Done). Before/around merging `feature/bc-item-creation`:
   - **Pre-merge ops (not code):** apply migrations **038, 039, 040** on deploy; in BC, set each packaging category's mapped No. Series to **Normal (Allow Gaps = false)** — the code refuses non-Normal series with a clear error.
   - **Verify `defaultIsDuplicate` against the real BC sandbox** — confirm the exact duplicate-number error (status/code/message) BC returns on item insert and tighten the heuristic (`nexus/src/app/actions/businessCentralItems.ts`, add a `details.code` check). Safe direction is contained; this is about not mis-handling a real duplicate.
   - **Confirm the OData company key** — `createNoSeriesClientForOrg` uses `company.name`; verify it equals what the published NoSeriesLines service expects for the tenant (fails loud/safe if wrong).
   - **Optional:** scope `resolveSeriesCodeForCategory` by `bc_connection_id` too (currently org-only; low risk since categories are env-scoped).
   - **Observability:** a post-create commit failure leaves a real BC item with no Nexus row + advanced counter; self-heals on next sync — consider logging a reconciliation warning.
   - Full per-task findings ledger: `.superpowers/sdd/progress.md`.
4. **Phase 4: proper BC item-editing permissions** — replace the temporary admin gates with the dedicated item-manager permission.
   - `nexus/src/components/items/ItemsClient.tsx:137` → use `canEditBusinessCentralItemBcFields` instead of `access.isAdmin`
   - `nexus/src/app/actions/businessCentralItemsSpike.ts:37` → use the dedicated item-manager permission instead of `canManageCatalog`
5. **Phase 5: BC edit-conflict handling** — handle the case where Business Central is updated while an item has unsaved local edits, to prevent silent overwrites. See `nexus/src/components/items/ItemsClient.tsx:1383`.

6. **Verify & ship `feature/item-categories-page`** — the Item Categories page. Code complete: 7 of 8 tasks, 108 tests, lint/tsc/build clean, all five affected routes load, full per-task + whole-branch review (**verdict: ready to merge**). Branch is off `feature/bc-item-creation`.
   - **⚠️ Apply migration 044 to Supabase first.** Nothing on the page works without it — the template save needs that unique index as an `ON CONFLICT` arbiter.
   - **This closes the gap that blocked item-creation testing:** `categories.bc_no_series_code` previously had no editor anywhere, so per-category auto-numbering could only be enabled by editing the database. Backlog #1's test script can now be followed through real UI.
   - Then run the Task 8 checklist in `docs/superpowers/plans/2026-07-29-item-categories-page.md`. **Test the numbering failure cases before the success case** — a validator that accepts everything also passes the happy path. Note the final step writes a real item to BC and permanently advances the number series.
   - What moved: category settings left `/settings`, the Item Templates card left `/admin`. Both now live at `/item-categories`, reached from a button on the items page. `/admin` keeps BC Credentials and Environments.
7. **Item categories follow-ups** (non-blocking; from the whole-branch review). Findings ledger: `.superpowers/sdd/progress.md`.
   - **Coordinate migration numbering across the two sibling branches.** `feature/item-categories-page` adds 044 while `feature/bc-customer-ar-sync` adds 041–043, and neither contains the other's. No collision and no dependency, but checking out either alone and applying in order skips numbers. Sort this before both land in `main`.
   - **Dead write path:** `bcNoSeriesCode` on `createCategory`/`updateCategory` is now unreachable — the new page writes via `saveCategoryNumbering` instead. Two write paths for one column, one unwired. Remove it, or wire `CategoryForm` to use it.
   - No nav link to `/item-categories` — access is the items-page button by design. Revisit if that proves hard to find.

## Done

- **Replicate BC item creation in Nexus (templates + number series)** — built on branch `feature/bc-item-creation` (stacked on `feature/multi-bc-environments`). 11 commits `8e8679e..5e51db4`; 102/102 tests, lint+tsc clean; full subagent review (per-task + whole-branch). Item-creation templates + per-category auto-numbering that drives BC's real No. Series counter via the published Page 457 OData service ("A+", create-then-advance, Normal-only, advance-only/range/ETag guards, per-environment time-zone date stamp). Spec: `docs/superpowers/specs/2026-06-26-...-design.md`; plan: `docs/superpowers/plans/2026-06-26-...md`. Remaining items moved to To-do #4.
