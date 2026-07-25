# Bill.com AR Sync — Feasibility Spike

**Date:** 2026-07-24
**Status:** Research complete. No implementation decision made beyond "custom integration is warranted."
**Context:** Precursor to a larger effort to sync Business Central customers, posted sales invoices, and customer ledger entries into Nexus, and to push AR data to Bill.com.

## Why this spike existed

Before designing a Bill.com integration, two things needed answering:

1. Does Bill.com already sync natively with Dynamics 365 Business Central? If so, custom middleware would be wasted work.
2. Is Bill.com's API accessible to us at all — plan gating, approval workflow, sandbox?

Both are now answered.

## Build-vs-buy decision

**Bill.com's native "Microsoft Dynamics" 2-way sync does support Business Central.** Public documentation lists only "Microsoft Dynamics" without qualifying the product, but this was confirmed directly.

**We are building custom anyway.** The native sync's rules and process do not align with our operational needs — we require control over when and how records move, which the packaged connector does not provide. This is a deliberate build-over-buy decision, not a gap-filling one.

Consequence: the native connector remains a fallback if the custom path stalls, and it sets a quality bar — our integration should be at least as reliable as the packaged one, or the tradeoff is not worth it.

## Access and commercial requirements

No partner agreement, approval workflow, or plan gating. Access is self-service.

- **Sandbox:** self-service signup. Developer keys work across any test organization and test user.
- **Production:** requires a Bill.com account signed up for "Accounts Payable & Receivable," a linked bank account, and a developer key generated in the web app under Settings → Sync & Integrations → Manage Developer Keys. Standard pricing applies after a 30-day trial.
- **Sandbox credentials do not work in production.** Separate keys per environment — this mirrors how `bc_connections` already scopes Business Central credentials per environment.

## API version

**Build on v3.**

v2 is in long-term support and Bill.com states it has no plans to deprecate it, but all new capability lands in v3 only. There is no forced migration deadline, so this is a greenfield choice rather than a migration.

## Authentication — the significant architectural constraint

Bill.com v3 uses **session-based auth**, not OAuth client credentials.

- `POST /v3/login` takes `username`, `password`, `organizationId`, and `devKey`, returning a `sessionId`.
- The `sessionId` expires after **35 minutes of inactivity**.
- Login is rate-limited to **200 calls per hour per developer key**.

**This differs from the existing Business Central client.** `nexus/src/lib/businessCentral/client.ts` uses OAuth client-credentials with a bearer token and a 60-second expiry skew. A Bill.com client cannot simply copy that shape: the session must be cached and reused across requests, and logging in per-request would exhaust the login rate limit under normal load.

Storing a username and password (rather than a client secret) also has a different security profile than the BC connection. Credential storage should follow the existing encrypted-secret pattern used for `bc_client_secret`.

## AR object model — maps cleanly to requirements

| Need | Bill.com v3 |
|---|---|
| Push customers | `Customer`, plus `CustomerBankAccount` and `CustomerContact` |
| Push AR invoices | `POST /v3/invoices` — accepts an existing customer `id` or inline new-customer data (`name`, `email`), plus an `invoiceLineItems` array (`quantity`, `description`, `price`) and `invoiceNumber`, `invoiceDate`, `dueDate` |
| Pull payment status | Invoice responses carry `status`, `totalAmount`, `dueAmount`, `scheduledAmount`, `creditAmount` |

Identifier prefixes are stable and worth relying on for validation: customers `0cu`, invoices `00e`, organizations `008`.

Additional capability not originally requested but potentially valuable:

- `POST /v3/invoices/{invoiceId}/payment-link` — generates a customer-facing payment link usable without a Bill.com account, supporting card and bank payment.
- `POST /v3/invoices/{invoiceId}/email` — sends payment reminders.
- A `sendEmail` flag on invoice creation controls customer notification.

## Payment status: webhooks available

Bill.com supports **webhooks** for real-time events, including payment creation. Payment status does not have to be polled.

Tradeoff to decide at design time: webhooks require a publicly reachable endpoint in the Nexus deployment plus signature verification and replay handling. Polling is simpler to build and needs no new attack surface, but adds latency and burns request quota. A reasonable path is polling first, webhooks as a later optimization — the data model is identical either way.

## Rate limits

| Limit | Value |
|---|---|
| API requests | 20,000 per developer key per hour |
| Login calls | 200 per developer key per hour |
| **Concurrent requests** | **3 per developer key per organization** |
| Spend & Expense API (not used here) | 60 per token per minute |

The hourly ceiling is generous and unlikely to bind. **The concurrency limit of 3 is the real constraint** — bulk sync operations must be serialized or lightly throttled rather than fanned out in parallel. Exceeding the hourly limit returns error `BDC_1144`.

## Business Central side — one gap worth flagging early

Business Central's standard API v2.0 covers most of what is needed, but **not customer ledger entries**:

- Available: `customers`, `salesInvoices`, `customerPayments`, `customerPaymentJournals`, and a `customerFinancialDetails` sub-resource exposing balance and overdue amount.
- **Not available:** raw customer ledger entries. These require publishing a custom OData page from Business Central.

This repo already has precedent for exactly that: `nexus/src/lib/businessCentral/noSeriesClient.ts` consumes a published Page 457 (`NoSeriesLines`) OData service. The same approach applies, but it is a **Business Central configuration task**, not solely a coding task, and needs to be sequenced accordingly.

Separately, `customerPaymentJournals` / `customerPayments` expose a post action, which gives a clean landing spot for writing Bill.com-collected payments back into Business Central through the payment journal.

## Confirmed requirement: Bill.com sync must be toggleable

Bill.com syncing must be independently enableable and disableable.

Design implication: model it as a per-organization Bill.com connection record that is **absent or disabled by default**, following the existing `bc_connections` pattern. When disabled, no credentials exist, no sync jobs run, and AR-push affordances are hidden from the UI. The Business Central read-sync work must not reference the Bill.com connector at all, so it remains fully functional with Bill.com off.

## Proposed decomposition

The full request spans six subsystems. Each warrants its own spec → plan → implementation cycle.

| | Piece | Depends on | Risk |
|---|---|---|---|
| A | Customer read sync — BC customers → Nexus (profile, terms, balance) | — | Low |
| B | AR read sync — posted sales invoices + customer ledger entries → Nexus, plus aging view | A | Low |
| C | Customer write-back — edit and create customers in BC | A | Medium |
| D | Bill.com connector — auth, credential storage, environment scoping, toggle, customer push | A | Medium |
| E | Invoice push + payment status pull — Nexus ↔ Bill.com AR | B, D | Medium |
| F | Payment posting into BC — cash receipt journal from Bill.com settlements | E | **High — writes to the general ledger** |

A and B are independently valuable: together they deliver customer visibility and AR aging with no Bill.com dependency and no write risk, and they define the data model the remaining four read from.

F deserves particular care at design time. A defect there writes incorrect entries into the accounting system, and unlike the read paths it is not self-healing on the next sync.

## Open questions for design

1. Which Bill.com environment does Nexus target first — sandbox only, or both sandbox and production behind the same connection model?
2. Polling or webhooks for payment status in piece E?
3. Does the customer ledger entry OData page need to be published in Business Central before A+B can be built, or can B ship against `customerFinancialDetails` first and add ledger detail later?
4. Sync direction conflicts: if a customer exists in both BC and Bill.com, what is the matching key and what happens on conflict?

## Sources

- [BILL v3 API reference overview](https://developer.bill.com/reference/api-reference-overview)
- [AR invoices](https://developer.bill.com/docs/ar-invoices)
- [BILL keys & tokens](https://developer.bill.com/docs/bill-keys-tokens)
- [Get started in production](https://developer.bill.com/docs/get-started-in-production)
- [API rate limits](https://developer.bill.com/docs/api-rate-limits)
- [Webhooks](https://developer.bill.com/docs/webhooks)
- [BILL accounting software integrations](https://www.bill.com/integrations)
- [BILL v2 API documentation (LTS)](https://developer.bill.com/v2/docs/home)
