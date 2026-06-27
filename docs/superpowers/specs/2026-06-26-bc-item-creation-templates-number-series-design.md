# Design: Replicate BC item creation in Nexus (templates + number series)

**Date:** 2026-06-26
**Status:** Approved design — ready for implementation plan
**Branch context:** builds on `feature/multi-bc-environments` (everything is BC-environment scoped)

## Goal

Let users create Business Central items from inside Nexus the way they do in BC:

1. **Item-creation templates** — saved bundles of default field values, so users don't re-enter the same fields every time.
2. **Number series** — Nexus auto-assigns the item number the way BC's No. Series does, with the assigned number kept in sync with BC's real counter.

## Key decisions (settled during brainstorming)

- **Nexus is the source of truth for *assigning* numbers**, but **BC's `No. Series Line` remains the live counter** — Nexus drives it rather than keeping a parallel counter that could drift.
- **Items are created in both Nexus and BC**, so collision avoidance is mandatory.
- **Number series is selected per app packaging category** (the `categories` table), not per BC item category.
- **No AL extension is required.** A BC admin published the standard **Page 457 "No. Series Lines"** as an OData web service; Nexus reads and `PATCH`es it. An AL `GetNextNo` endpoint can be slotted in later behind the same interface.

## Feasibility — verified against production BC

Tested with the stored BC integration credentials against
`…/Production/ODataV4/Company('Hawaii Candy Factory LLC')/NoSeriesLines`:

| Check | Result |
|---|---|
| Read series lines (fields: `Series_Code, Line_No, Starting_No, Ending_No, Last_Date_Used, Last_No_Used, Increment_by_No, Allow_Gaps_in_Nos, Implementation, @odata.etag`) | ✅ 200 |
| Write permission (no-op PATCH) | ✅ 200 — integration user has Modify on No. Series Line |
| Advance `Last_No_Used` (`NX000005`→`NX000010`) on a Normal series | ✅ persists, passes BC format validation |
| Set `Last_Date_Used` explicitly | ✅ persists |
| Optimistic concurrency (stale ETag) | ✅ **409 Conflict** (`Request_EntityChanged`) → re-read + retry |
| Out-of-range value (`ZZ000001`) | ⚠️ **accepted** — BC does NOT range-validate over OData |
| Auto-update of `Last_Date_Used` when number changes | ⚠️ **No** — must be set explicitly |

### Critical constraint: Normal vs Sequence series

Of 142 series lines in this BC: **80 are `Implementation = Sequence`** (Allow Gaps = true), **62 are `Normal`**.

- **Normal** → `Last_No_Used` *is* the counter; PATCH controls the next number. **Required for this feature.**
- **Sequence** → the real counter is a hidden DB sequence; PATCHing `Last_No_Used` does **not** control the next number and won't prevent collisions.

**Design rule:** every series Nexus drives (one per packaging category) must be configured in BC as **Normal (Allow Gaps in Nos. = false)**. This is a per-series checkbox a BC admin sets. The implementation must verify `Implementation = "Normal"` at assign time and refuse to auto-assign (falling back to manual entry with a clear message) if a mapped series is `Sequence`.

## Architecture

### Number assignment — BC stays the counter, Nexus drives it

When a user creates an item whose category maps to a series, the server action runs this sequence:

1. **Read** the mapped BC series line via OData → current `Last_No_Used`, `Starting_No`, `Ending_No`, `Increment_by_No`, `Implementation`, `@odata.etag`.
2. **Verify** `Implementation = "Normal"`. If not, abort auto-assign → fall back to manual entry with a clear message.
3. **Compute** `candidate = increment(Last_No_Used)` formatted with the series prefix/padding derived from `Starting_No` and `Increment_by_No`. If `Last_No_Used` is empty, start from `Starting_No`.
4. **Guard in Nexus** (BC does not): candidate must be **within `Starting_No`..`Ending_No`** and **strictly greater** than current `Last_No_Used` (advance-only). If the range is exhausted, abort before any write with a clear message.
5. **Create the item in BC** with that explicit `number`.
   - On **duplicate** error (`number` already exists): bump to the next candidate and retry (bounded retry count).
6. **Advance BC's counter:** PATCH the series line with `Last_No_Used = candidate`, `Last_Date_Used = today`, using `If-Match` with the etag from step 1.
   - On **409 Conflict**: re-read the line, re-apply the advance-only rule (never move the counter backward), and PATCH again (bounded retry).
7. **Persist** the created item + assigned number into `business_central_items` (existing path) and record a sync event capturing the number and series code.

**Ordering rationale:**

- **Create-then-advance** (not reserve-then-create): a failed BC create never consumes a number, so no gaps appear in the `Allow Gaps = false` series.
- **Advance-only + range checks live in Nexus**, because the feasibility test proved BC does not enforce them over OData.

### Pluggable strategy

The "get the next number" step sits behind a `NumberAssigner` interface with a single implementation now —
`BcNoSeriesLinePatchAssigner` (the sequence above). A future `BcGetNextNoAssigner` (AL unbound action / custom API) can replace it with no changes to the creation flow.

### Manual override

An authorized user may toggle "Set manually" and type a specific number. Manual numbers **skip** the counter advance (steps 1–6 above are bypassed; the number is pushed as-is). Used for exceptions and matching pre-existing numbers.

## Data model

### `categories` — one new column (migration `038_add_category_no_series.sql`)

- `bc_no_series_code text null` — the BC No. Series code this packaging category assigns from. `null` ⇒ no auto-numbering (manual entry, like today). Already per-environment because `categories` rows carry `bc_connection_id`.

No prefix/range/increment/last-used is stored in Nexus — all read live from BC's series line at assign time, so it cannot drift.

### `item_templates` — new table (migration `039_add_item_templates.sql`)

Environment-scoped, mirroring how `categories`/items are scoped.

| Column | Purpose |
|---|---|
| `id` (uuid, pk) | identity |
| `organization_id` (uuid) | tenant scope |
| `bc_connection_id` (uuid) | environment scope |
| `name` (text), `description` (text null) | what the user picks |
| `category_id` (uuid → `categories.id`) | drives the number series (via the new column) + packaging category |
| `bc_item_category_code` (text null) | BC item category written onto the item |
| `default_type` (text) | Inventory / Service / Non-Inventory |
| `base_unit_of_measure_code` (text null) | e.g. `PCS` |
| `tax_group_code` (text null) | |
| `general_product_posting_group_code` (text null) | |
| `inventory_posting_group_code` (text null) | |
| `price_includes_tax` (bool, default false) | |
| `blocked` (bool, default false) | |
| `is_active` (bool, default true) | lifecycle |
| `created_by`, `updated_by` (uuid null), `created_at`, `updated_at` | audit |

These map 1:1 onto the existing `BcItemCreatePayload` fields. `displayName`/`displayName2` are per-item and intentionally **not** on the template.

### Reused unchanged

- `business_central_items` already stores `bc_item_number`.
- Existing sync-events table records the create; we ensure the assigned number + series code are captured.

## UX

### Template management (Settings)

- A new **"Item Templates"** card next to existing Settings cards (BC environments, categories), scoped to the active environment.
- List shows name + category/series. New/Edit form uses dropdowns populated from already-synced BC reference data (categories, units of measure, tax groups, posting groups). The packaging-category picker is the key field.
- Gated by the item-manager permission (Phase 4 backlog item; until then, the same admin gate categories use).

### Item creation (Items page)

A **"New item"** button opens the creation panel (extends the existing draft form in `ItemsClient.tsx`):

1. **Pick a template** → pre-fills all default fields; every field stays overridable.
2. **Number field**:
   - Category has a Normal series → read-only **preview**: *"Will be assigned from `CHOC ING` — next ≈ `CHOC0042`"*, with a note that the final number is confirmed on save.
   - **"Set manually" toggle** → type a specific number (skips counter advance).
   - Category has no series → plain manual input (today's behavior).
3. **Enter `displayName`** (+ optional `displayName2`).
4. **Create** → runs the assignment sequence; on success the item appears with its **final** number.

## Error handling & edge cases

| Situation | Behavior |
|---|---|
| Duplicate number on BC create | Silent retry: bump to next candidate (bounded retries), then surface a clear error if still failing. |
| BC user advanced the counter mid-create (PATCH 409) | Re-read line, re-apply advance-only, PATCH again (bounded retries). |
| BC create fails (validation/connection) | Clear error; **no number consumed** (create-then-advance); draft preserved for retry. |
| Mapped series is `Sequence`, not `Normal` | Auto-assign refused with a clear message ("series X uses Allow Gaps — set it to Normal in BC to enable auto-numbering"); user may enter a number manually. |
| Series range exhausted / candidate out of range | Blocked before any BC call with a clear message ("series X has no numbers left — update its range in BC"). |
| Category has no `bc_no_series_code` | Manual number entry, exactly like today. |
| Number-series web service unreachable / 401 | Surface a clear connection error; do not create the item without a number. |
| Preview vs final number differ (counter moved) | Expected and acceptable; preview is best-effort, final number is authoritative and shown on success. |

## Testing strategy

- **Unit — number formatting/increment:** prefix/padding derivation from `Starting_No`, increment, advance-only comparison, range/exhaustion checks. Table-driven; no network.
- **Unit — `NumberAssigner` strategy:** mock the OData client; assert the read → compute → create → advance ordering, the create-then-advance guarantee (no advance on create failure), duplicate-retry, and 409 re-read/retry paths.
- **Unit — templates:** template → `BcItemCreatePayload` mapping; overrides win over template defaults.
- **Integration (mocked BC):** full create flow through the server action against a faked OData/items API, covering each error-handling row above.
- **Manual verification against `NEXUS-TEST`:** the feasibility script already proves read/advance/concurrency/cleanup; reuse it as a manual smoke check. Optionally, the deeper end-to-end (point Inventory Setup → Item Nos. at `NEXUS-TEST`, create a blank-number item, confirm BC hands out the expected next number, then revert) if absolute proof of BC consumption is wanted.
- Follow the repo's existing test conventions (co-located `*.test.ts(x)` as in `client.test.ts`, `itemMapper.test.ts`).

## Out of scope (YAGNI)

- Editing BC series ranges from Nexus (do it in BC).
- Bulk/CSV item creation.
- Template versioning/history.
- Driving `Sequence`-implementation series (requires the AL `GetNextNo` strategy; deferred).

## Prerequisites / dependencies on BC admin

- Page 457 "No. Series Lines" published as an OData web service (**done**).
- Integration user has Modify on the No. Series Line table (**verified**).
- Each packaging category's series configured as **Normal (Allow Gaps in Nos. = false)** in BC.
