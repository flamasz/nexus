# Backlog

A running list of things to do. Reference items by number, e.g. "do #2" or "add X to the backlog".

## To do

1. **Merge the multi-BC-environment PR** — PR open at https://github.com/flamasz/nexus/pull/1. Review, then merge. ⚠️ Apply migrations 027–037 to Supabase on deploy.
2. **Phase 4: proper BC item-editing permissions** — replace the temporary admin gates with the dedicated item-manager permission.
   - `nexus/src/components/items/ItemsClient.tsx:137` → use `canEditBusinessCentralItemBcFields` instead of `access.isAdmin`
   - `nexus/src/app/actions/businessCentralItemsSpike.ts:37` → use the dedicated item-manager permission instead of `canManageCatalog`
3. **Phase 5: BC edit-conflict handling** — handle the case where Business Central is updated while an item has unsaved local edits, to prevent silent overwrites. See `nexus/src/components/items/ItemsClient.tsx:1383`.
4. **Replicate BC item creation in Nexus (templates + number series)** — _brainstorming in progress; not yet implemented._
   - **Goal:** item-creation templates (like BC item templates) + Nexus-generated item numbers that mimic BC number series.
   - **Decisions so far:**
     - Nexus is the source of truth for number assignment.
     - Items will be created in **both** Nexus and BC → must avoid number collisions.
     - Number series is selected **per app packaging category** (the `categories` table, not BC item categories).
     - AL-extension deployment to BC is **uncertain** — design must work without it, with AL as an optional future upgrade.
   - **Chosen approach — "A+" (mirror + reconcile + push-guard, plus write BC's counter back):** Nexus stores a number series per packaging category (prefix / last-used / increment / padding, modeled on BC series lines), generates + previews the number, pushes the item to BC with that explicit number, then updates BC's "Last No. Used" / "Last Date Used" so BC stays accurate. Structure the "get next number" step as a pluggable strategy so an AL `GetNextNo` endpoint can drop in later.
   - **Research finding (how to update BC's counter without an AL extension):** publish BC's standard **"No. Series Lines" page (Page 457)** as an OData web service (BC admin config, no AL) and `PATCH` "Last No. Used"/"Last Date Used". Guards required: only ever advance the counter (never rewind), stay within the line's Start/End range, use ETag/`If-Match` for concurrency + retry. Fallbacks: plain A (reconcile + retry, BC counter left stale) or omit the number on create (BC assigns + advances its own counter, but no in-Nexus preview).
   - **Feasibility — CONFIRMED (A+ is viable, no AL needed):** BC admin published Page 457 "No. Series Lines" as an OData web service. Endpoint: `…/Production/ODataV4/Company('Hawaii Candy Factory LLC')/NoSeriesLines`. Tested with the stored BC integration creds: **read ✅ (200)**, **write ✅** (no-op PATCH returned 200 → integration user has Modify on No. Series Line), **ETag/`If-Match` concurrency ✅**. Exposed fields: `Series_Code, Line_No, Starting_Date, Starting_No, Ending_No, Last_Date_Used, Last_No_Used, Warning_No, Increment_by_No, Allow_Gaps_in_Nos, Implementation, Open`.
   - **⚠️ Key constraint found — Normal vs Sequence implementation:** of 142 series lines, 80 are `Implementation=Sequence` (Allow Gaps=true) and 62 are `Normal`. PATCHing `Last_No_Used` only controls the next number for **Normal** series; for **Sequence** series BC's real counter is a hidden DB sequence and the PATCH won't prevent collisions. **Design rule:** the series Nexus drives (one per packaging category) must be configured in BC as **Normal (Allow Gaps in Nos = false)**.
   - **Hard proof — DONE (A+ write-back fully verified on a real Normal series `NEXUS-TEST`):** advance PATCH of `Last_No_Used` (`NX000005`→`NX000010`) persists and passes BC format validation ✅; `Last_Date_Used` settable explicitly ✅; optimistic concurrency works — stale ETag → **409 Conflict** (`Request_EntityChanged`) → re-read + retry ✅. **Two guards BC does NOT do (Nexus must):** (a) BC accepted an **out-of-range** value (`ZZ000001`) → Nexus must enforce Start/End range + advance-only itself; (b) `Last_Date_Used` is **not** auto-updated on number change → Nexus must PATCH it explicitly. `NEXUS-TEST` reset to clean; safe to delete in BC.
   - **NEXT:** resume the brainstorming → design doc → implementation-plan flow, treating A+ as the chosen mechanism. Design covers: (a) per-category number-series model in Nexus mirroring BC series lines, (b) pluggable "get next number" strategy, (c) PATCH write-back to BC with advance-only + range + ETag guards, (d) item-creation templates, (e) creation UI.

## Done

_(nothing yet)_
