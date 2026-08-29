# Business Central Customer & AR Read Sync — Design

**Date:** 2026-07-24
**Status:** Approved design, ready for implementation planning.
**Scope:** Pieces A and B of the six-piece decomposition recorded in
[`2026-07-24-billcom-ar-sync-feasibility-spike.md`](./2026-07-24-billcom-ar-sync-feasibility-spike.md).

## Summary

Mirror Business Central customers, posted sales invoices, invoice lines, and customer ledger
entries into Nexus, and surface them as a customer directory, a posted sales invoice list, and an
AR aging dashboard.

Read-only. Nothing in this slice writes to Business Central, and nothing references Bill.com. The
data model defined here is what pieces C through F will read from.

## Goals

- Give the team customer visibility inside Nexus: profile, contact details, commercial terms, balance.
- Support AR collections with a real aging view — 30/60/90 buckets derived from ledger entries.
- Establish the mirrored data model that customer write-back (C) and the Bill.com connector (D/E/F) build on.

## Non-goals

- Any write to Business Central. Customer create/edit is piece C.
- Any Bill.com integration. This slice must be fully functional with Bill.com absent.
- Linking sales invoices to Nexus artwork or orders. Explicitly deferred; not a current requirement.
- Scheduled or background syncing. Manual only (see Decisions).

## Decisions

These were settled during design. Recording the reasoning so they are not relitigated.

| Decision | Choice | Why |
|---|---|---|
| Ledger entry source | Publish a custom OData page in BC (Page 25, *Cust. Ledger Entries*) | Ledger entries are absent from BC API v2.0. Only real entries give correct 30/60/90 buckets, credit memos, and partial payments. Repo precedent exists: `noSeriesClient.ts` consumes published Page 457. |
| History depth | Full history, all posted invoices and ledger entries | Chosen over a rolling window. Requires resumable backfill (see Sync engine). |
| Sync trigger | Manual button only | Matches existing item sync; no scheduler infrastructure. Consequence: backfill must resume across separate clicks. |
| Data model | Dedicated typed mirror tables; aging as a SQL view | Matches `business_central_items` conventions. With manual-only sync there is nothing for a materialized aging table to drift against. |
| Sync code structure | One shared sync runner + per-entity adapters | Avoids four near-identical copies of the ~70-line sync skeleton. Checkpoint/resume implemented once. |
| Permissions | New granular keys, default off, admin-only | Avoids repeating the temporary-admin-gate shortcut flagged in backlog item #4. |
| Invoice lines | Included in this slice | Not needed by aging or customer history, but piece E requires them for Bill.com `invoiceLineItems`, and backfilling lines across full history later means a second full re-pull. |

## Data model

All mirror tables follow the `business_central_items` shape: `organization_id`,
`bc_connection_id`, `bc_environment`, `bc_company_id`, the BC identifier, `bc_etag`,
`bc_last_modified_at`, full `bc_raw_payload` JSONB, sync status columns, and
`UNIQUE (organization_id, bc_connection_id, bc_company_id, <bc_id>)`.

### `business_central_customers`

Source: BC API v2.0 `customers`, plus the `customerFinancialDetails` sub-resource.

- Identity: `bc_customer_id` (GUID), `bc_customer_number`
- Profile: `display_name`, `type`, `address_line_1`, `address_line_2`, `city`, `state`,
  `postal_code`, `country`, `phone_number`, `email`, `website`
- Commercial: `currency_id`, `currency_code`, `payment_terms_id`, `payment_method_id`,
  `shipment_method_id`
- Tax: `tax_liable`, `tax_area_id`, `tax_registration_number`
- Status: `blocked`
- Financials: `balance`, `overdue_amount` — from `customerFinancialDetails`. Cheap to pull and
  serves as an independent check against our own aging arithmetic.

### `business_central_sales_invoices`

Source: BC API v2.0 `salesInvoices`.

**This endpoint returns drafts and posted invoices both.** The sync filters to posted only
(`status ne 'Draft'`) and stores `posting_date` distinctly from `invoice_date`.

- Identity: `bc_invoice_id`, `number`, `external_document_number`
- Dates: `invoice_date`, `posting_date`, `due_date`
- Customer: `bc_customer_id`, `customer_number`, `customer_name`, plus bill-to equivalents
- Amounts: `currency_code`, `total_amount_excluding_tax`, `total_tax_amount`,
  `total_amount_including_tax`, `discount_amount`
- Status: `status`

### `business_central_sales_invoice_lines`

Source: BC API v2.0 `salesInvoiceLines`. Line number, item/account reference, description,
quantity, unit price, discount, tax, line amounts, and a foreign key to the parent invoice row.

### `business_central_customer_ledger_entries`

Source: the published OData page (Page 25, *Cust. Ledger Entries*).

`entry_no`, `customer_no`, `posting_date`, `document_type` (Invoice / Payment / Credit Memo /
Refund / Finance Charge Memo / Reminder), `document_no`, `description`, `due_date`,
`currency_code`, `amount`, `remaining_amount`, `open`, `closed_at_date`, `external_document_no`.

This is the table aging is computed from.

### `business_central_sync_checkpoints`

New. Supports resumable backfill across separate manual sync invocations.

`(bc_connection_id, entity_type, phase, cursor_value, records_synced, updated_at)`, unique on
`(bc_connection_id, entity_type)`. `phase` is `backfill` or `delta`.

### `business_central_ar_aging` (view)

A view over `business_central_customer_ledger_entries` where `open = true`, deriving
`days_overdue` and a bucket of `current`, `1-30`, `31-60`, `61-90`, or `90+`.

Two implementation requirements:

1. **Partial index** on `(organization_id, bc_connection_id) WHERE open` — the open set stays
   small while closed entries accumulate across full history, so the view stays fast without
   materialization.
2. **"Today" comes from the connection's time zone**, not the server clock. Migration 040 already
   added `time_zone` to the connection for No. Series date stamping; reuse it so there is a single
   definition of the environment's current date. An invoice due today in `Pacific/Honolulu` must
   not read as one day overdue because the server runs UTC.

### Changes to existing objects

1. **`business_central_sync_events`** is item-scoped via an `item_id` foreign key. Add nullable
   `entity_type` and `entity_id` columns so all four new entities log to the same audit trail.
   `item_id` is left in place; existing item-sync writes are unchanged.
2. **`business_central_sync_status` enum** is reused rather than duplicated. The read-only mirror
   tables use only `never_synced`, `syncing`, `synced`, `failed`, and `deleted_in_bc`; the
   push-side values (`local_dirty`, `unpushed`) are simply unused here. Reusing the type means
   piece C's write-back needs no type migration.

## Sync engine

### Shared runner

`src/lib/businessCentral/syncRunner.ts` holds the lifecycle currently inlined in
`syncBusinessCentralItems`: acquire the connection lock, resolve the cursor, page through remote
records, upsert, log sync events, advance the checkpoint, release the lock, handle failure.

Each entity supplies an adapter:

```ts
interface SyncEntityAdapter<TRemote, TRow> {
  entityType: 'customer' | 'sales_invoice' | 'sales_invoice_line' | 'customer_ledger_entry';
  table: string;
  conflictTarget: string;
  cursorField: string;              // ordering key used for keyset resume
  fetchPage(client, opts): Promise<{ records: TRemote[] }>;
  map(ctx, remote): TRow;
  remoteId(remote): string;
  cursorValue(remote): string;
}
```

Entities sync in dependency order: customers → sales invoices → invoice lines → ledger entries.

### Cursors are keyset, not `@odata.nextLink`

Because sync is manual and a full-history backfill spans multiple separate clicks — potentially
minutes or hours apart — an opaque OData skip token is the wrong thing to persist, since those
expire between invocations.

The checkpoint stores a real ordering key instead: `lastModifiedDateTime` for API v2.0 entities,
`Entry_No` for ledger entries. Pages are requested with `$orderby` on that field and resumed with
`filter: <cursorField> gt <cursor_value>`, which stays valid indefinitely.

The cursor is a **single** field, not a composite. Records sharing the exact cursor value at a page
boundary may therefore be fetched again on resume. This is accepted rather than solved: every write
is an idempotent upsert on a stable conflict target, so reprocessing a handful of records is
harmless, and a single-field filter keeps the OData query simple and indexable. The alternative —
composite keyset pagination — buys nothing here.

Delta sync after backfill completes uses the same mechanism, filtering on the entity's
last-modified field against the stored cursor.

### Time-budgeted execution

Each sync invocation processes pages until roughly 60 seconds have elapsed, then checkpoints and
returns progress to the caller (`{ entityType, recordsSynced, complete: boolean }`). The UI reports
remaining work and prompts the user to click Sync again.

Server actions have runtime ceilings. A full-history first pull will not complete in a single
invocation, and the design does not pretend otherwise.

### Locking

Reuses the existing `sync_in_progress_by` / `sync_in_progress_since` / `sync_in_progress_timeout_at`
columns on `business_central_connections` with the same 10-minute timeout as item sync. A sync
already in progress is rejected with the user and start time named.

## Error handling

- **Transport failures** reuse the BC client's existing retry backoff and the
  `business_central_error_class` enum. No new error taxonomy.
- **Checkpoints are preserved on failure, never rolled back.** A network fault mid-backfill costs
  the current page, not the whole run.
- **Partial degradation is deliberate.** If the ledger-entry OData page has not been published in
  Business Central, that entity fails with an actionable error naming the exact page to publish,
  while customers, invoices, and lines still sync successfully. This keeps a BC configuration task
  from blocking customer data, and lets the feature be built and tested before the page exists.
- Failures write a sync event and set `last_error` on the connection, matching item sync.

## UI

### Routes

| Route | Contents |
|---|---|
| `/customers` | Customer list with search |
| `/customers/[id]` | Profile, commercial terms, balance, that customer's invoice and ledger history |
| `/receivables` | AR aging dashboard — buckets, total outstanding, sortable by amount and days overdue |
| `/receivables/invoices` | Posted sales invoice list, filterable by number, customer, date range, status |

### Navigation disambiguation

The existing `/invoices` route is *purchase* invoices (supplier and manufacturer), entered
manually. Its nav label changes to **"Purchase invoices."** Route and functionality are unchanged;
label only. Two nav entries called "invoices" meaning opposite sides of the ledger is a live
confusion risk once AR lands.

## Permissions

Two new keys added to `ACCESS_KEYS` and `OVERRIDE_TO_ACCESS_KEY` in `src/lib/auth/permissions.ts`:

| Access key | Override key | Default |
|---|---|---|
| `canViewCustomers` | `viewCustomers` | false (admin: true) |
| `canViewReceivables` | `viewReceivables` | false (admin: true) |

Both are grantable per user through the existing override UI. Piece C will add
`canManageCustomers` alongside them.

Triggering a sync reuses the existing `requireBcEdit` gate that item sync uses — same class of
action against the same connection.

New tables receive org-scoped RLS policies matching the existing Business Central tables.

## Testing

Follows the existing per-module colocated test pattern.

- **Mapper unit tests** — `customerMapper`, `salesInvoiceMapper`, `salesInvoiceLineMapper`,
  `ledgerEntryMapper` — pure functions against captured BC payloads, mirroring `itemMapper.test.ts`.
- **Aging bucket tests**, including the time-zone boundary explicitly: an invoice due today in
  `Pacific/Honolulu` reads as current, not one day overdue, when the server runs UTC. This is the
  defect this design is most likely to ship, so it is tested first.
- **Sync runner tests** against a fake adapter and fake Supabase client: resume from checkpoint,
  lock contention rejection, mid-page failure preserves the cursor, time-budget exit reports
  accurate progress, delta filter built correctly from a stored cursor.
- **Degradation test**: ledger page unavailable — customers, invoices, and lines still complete,
  and the ledger error names the page to publish.
- **Posted-only filter test**: draft sales invoices returned by the endpoint are not mirrored.

## Operational prerequisites

Not code. These must be sequenced alongside implementation.

1. ~~**Publish Page 25 (*Cust. Ledger Entries*) as an OData web service**~~ — **done (2026-07-26).**
   Published in both production and TEST under the service name **`CustomerLedgerEntries`**.

   The client hardcodes this service name as a named constant, matching how `noSeriesClient.ts`
   embeds `NoSeriesLines` in its URL. Because the name is identical across both environments, it
   does not need to be a per-connection setting; if the environments ever diverge, promoting the
   constant to a column on `business_central_connections` is a contained change.

   Resulting URL shape:
   `{apiBaseUrl}/v2.0/{environment}/ODataV4/Company('{companyName}')/CustomerLedgerEntries`

2. **Verify the app registration can read customer ledger entries.** Publishing the page exposes
   it; permission sets decide whether Nexus's service credentials may read it. In BC under
   *Microsoft Entra Applications*, the registration matching the connection's client ID must be
   `Enabled` and hold a permission set granting read on the **Cust. Ledger Entry** table (table 21)
   — `D365 BUS FULL ACCESS` suffices. Required in both environments.

   Note that testing the OData URL in a browser does **not** verify this: the browser authenticates
   as the signed-in user, not as the service principal. The first ledger sync from Nexus is the
   authoritative test, and the degradation path in Error handling surfaces a clear error rather
   than a silent empty result.

3. **Confirm each connection's `time_zone`** is set correctly, since aging buckets depend on it.
4. Apply the new migrations on deploy.

## Open questions

None blocking. Deferred to their own slices:

- Customer matching key between BC and Bill.com, and conflict behaviour — piece D.
- Polling versus webhooks for Bill.com payment status — piece E.
- Whether item sync should later adopt the shared runner and its resume capability. The runner is
  designed to make this possible; converting item sync is out of scope here.
