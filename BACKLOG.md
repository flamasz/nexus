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
6. **Ship `feature/bc-customer-ar-sync`** — BC customer + AR read sync (pieces A+B). **Code complete and verified against the live BC TEST environment.** 188 tests, lint/tsc/build clean, full per-task + whole-branch review, all 14 tasks done. Migrations 041/042/043 applied to TEST.
   - Verified in TEST: ~1,975 customers, ~412 posted sales invoices, 1,507 ledger entries, 1,806+ invoice lines. Aging buckets render, three customers reconcile against BC's own aged-AR report, and dates match BC.
   - **Remaining: decide the merge path.** Branch is local and stacked on `feature/bc-item-creation` (it needs migration 040's `time_zone` column), which itself is stacked on `feature/multi-bc-environments` (PR #1). Nothing pushed yet.
   - **On production deploy:** apply migrations 041, 042, 043. 042 requires **Postgres 15+** (`security_invoker`) — it fails loudly, not silently, if older. 041 is not re-runnable (`create policy` has no `IF NOT EXISTS`), so a partial apply then retry will error.
7. **BC AR sync follow-ups** (non-blocking; from the whole-branch review). Full findings ledger: `.superpowers/sdd/progress.md`.
   - **Shared validation helper across all four AR mappers** — none validate required BC id fields or numerics at runtime. A malformed payload yields `undefined` for a NOT NULL column and fails with a raw DB constraint error rather than a clear one. Fails loud, isolated to one entity. The ledger mapper also lacks `numberOrNull`, so `Number(row.Entry_No)` can be `NaN` and an empty `Amount` becomes `0`.
   - **AR sync events are never written.** Migration 041 added `entity_type`/`entity_id` to `business_central_item_sync_events` precisely so all four AR entities could log there, but no AR code writes one — dead schema and a missing audit trail.
   - **Normalize `customer_no` on ingest.** `customerMapper` trims `bc_customer_number`; the ledger mapper stores `customerNo` raw. The read sites are guarded, but `AgingDashboard`'s customer links are a second consumer that would miss on a padded value.
   - **Invoice lines are not posted-filtered** — draft-invoice lines get mirrored with no parent row. Harmless today (nothing reads lines) but piece E inherits the orphans.
   - **Derive `overdue_amount` from our own ledger entries.** BC rejects `$expand=customerFinancialDetails` on `customer`, so that column can never populate from BC and the Overdue UI was removed. We have the ledger data to compute it ourselves, which would also restore the independent cross-check on our aging arithmetic that the spec wanted.
   - **Invoice lines have their own sync path** (`salesInvoiceLineSync.ts`), outside the shared runner, because BC cannot query `salesInvoiceLines` as a flat collection. If more nested BC data is ever synced, teaching the shared runner one-to-many properly would be the better design.
   - Minor: `nullif(trim(time_zone),'')` hardening in view 042; delete unused `todayInTimeZone`; paginate the customers list; `days_overdue ?? 0` renders a missing due date as "0" (reads as not-overdue).

## Done

- **Replicate BC item creation in Nexus (templates + number series)** — built on branch `feature/bc-item-creation` (stacked on `feature/multi-bc-environments`). 11 commits `8e8679e..5e51db4`; 102/102 tests, lint+tsc clean; full subagent review (per-task + whole-branch). Item-creation templates + per-category auto-numbering that drives BC's real No. Series counter via the published Page 457 OData service ("A+", create-then-advance, Normal-only, advance-only/range/ETag guards, per-environment time-zone date stamp). Spec: `docs/superpowers/specs/2026-06-26-...-design.md`; plan: `docs/superpowers/plans/2026-06-26-...md`. Remaining items moved to To-do #4.
