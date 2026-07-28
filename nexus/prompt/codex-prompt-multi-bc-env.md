# Codex Agent Prompt: Multi-Environment Business Central Connections

> **Instructions:** This feature is large. It is split into **three phases** below. Run them one at a time — finish, test, and review each phase before starting the next. Copy one phase block at a time into your Codex CLI chat, or copy the whole document and ask the agent to do Phase 1 first.

---

## Context (shared by all phases)

### Location
Nexus is a Next.js 15 App Router app. Relevant code:

- BC server actions: `src/app/actions/businessCentralItems.ts` (~800 lines). Also check `src/app/actions/businessCentralItemsSpike.ts` — if it builds a BC client, it needs the same refactor.
- BC client: `src/lib/businessCentral/client.ts` — `createBcClient()`, `createBcClientFromEnv()`, `readBcClientConfigFromEnv()`.
- Org pill dropdown: `src/components/layout/Header.tsx` (top-right, `DropdownMenuContent`, currently lists organizations and a single "Business Central sync" status section).
- Settings page: `src/app/(protected)/settings/page.tsx` — a client component with stacked cards.
- Migrations: `nexus/supabase/migrations/`. Latest is `023_...`. BC schema was created in `015_add_business_central_item_sync.sql`.

### How BC works today (verified — read before changing anything)
- `business_central_connections` has **`UNIQUE (organization_id)`** — one row per org. The row stores `environment`, `company_id`, `company_name`, `api_base_url`, `sync_enabled`, and sync state (`last_verified_at`, `last_error`, `last_pulled_at`, `sync_in_progress_*`). **It does NOT store credentials.**
- Credentials (tenant ID, client ID, client secret) come **only from env vars** via `createBcClientFromEnv()`. There is no per-org credential storage yet.
- Every BC server action calls `createBcClientFromEnv()` with no arguments. The connection row is effectively a per-org "environment + sync state" record that mirrors the env vars.
- `business_central_items` already has `bc_connection_id` (FK, `ON DELETE SET NULL`), `bc_environment` (TEXT), and `bc_company_id` (TEXT).

### Goal
An organization has **one set of shared credentials** (tenant ID, client ID, client secret) and connects to **multiple BC environments** (e.g. TEST, PRODUCTION). Each environment has its own company. Users pick the active environment from the org pill dropdown. Admins configure credentials and environments in Settings.

### Constraints (all phases)
- **No new npm packages.** Use existing shadcn/ui components, Tailwind, Supabase, and Node built-ins.
- Match existing Settings card styling: outer card `bg-surface rounded-lg border border-border shadow-sm`, header row `px-6 py-4 border-b border-border`, primary button `px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-primary-foreground rounded-md transition-colors` (this is the "+ New Category" button style).
- The client secret must never be sent to the browser. Password-type inputs only; a blank secret field on edit means "keep existing".
- Do not break existing `business_central_items` data.

### Important data-modeling rules (do not get these wrong)
- **Tenant ID and client ID are shared** across all of an org's environments. **Company is per-environment** — each BC environment has its own companies with their own GUIDs, so a company ID from PRODUCTION will not exist in TEST. Company ID stays on the per-environment connection row, NOT in shared credentials.
- **Only the client secret is a true secret.** Tenant ID and client ID are identifiers — store them as plain columns. See the credential-storage section in Phase 1.

---

## Phase 1 — Database schema, credential storage, and the client factory

No UI in this phase. Goal: the data model and a function that can build a BC client for any org/environment.

### 1a. Schema migration
Create a new migration file `nexus/supabase/migrations/024_multi_bc_environments.sql`.

**Modify `business_central_connections` (this table now represents one environment):**
- Drop the `UNIQUE (organization_id)` constraint so an org can have multiple rows.
- Add `display_name TEXT NOT NULL` (user-facing label, e.g. "Production").
- Add `is_default BOOLEAN NOT NULL DEFAULT FALSE`.
- Add a partial unique index so at most one default per org:
  `CREATE UNIQUE INDEX idx_bc_connections_one_default_per_org ON business_central_connections (organization_id) WHERE is_default;`
- Keep `environment` (the BC environment name), `company_id`, `company_name`, `api_base_url`, and all sync-state columns — they are correctly per-environment already.

**Create `business_central_credentials` (shared credentials, one row per org):**
```
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
organization_id      UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE
tenant_id            TEXT NOT NULL
client_id            TEXT NOT NULL
client_secret_id     UUID            -- reference into Supabase Vault (see 1b)
default_api_base_url TEXT
created_at / updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
Add the `updated_at` trigger (`update_updated_at_column()`), matching the other BC tables.

**Add active-environment tracking to `users`:**
- `ALTER TABLE users ADD COLUMN active_bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;`

**Migrate existing rows:** for every existing `business_central_connections` row, set `display_name = environment` and `is_default = true`. (Existing rows have no credentials row and will fall back to env vars — see 1c.)

**RLS — tighten it, do not copy the existing `USING (true)` policies.** The current BC tables allow any authenticated user to read any org's rows. Do NOT extend that to `business_central_credentials`. Scope its policies to the user's own organization (and ideally restrict writes to admins). For `business_central_connections`, scope SELECT to the user's org as well. Look at how `categories` or `organizations` RLS policies scope by org and follow that pattern.

### 1b. Storing the client secret — use Supabase Vault
The client secret is the only true secret. Do **not** store it as a plaintext column.

**Primary approach — Supabase Vault** (built into Supabase, no npm packages, encrypted at rest with a key held outside the database tables):
- The migration enables the Vault extension if not already enabled.
- Store the secret with `vault.create_secret(secret, name, description)`; it returns a UUID. Save that UUID in `business_central_credentials.client_secret_id`.
- Read it back with the `vault.decrypted_secrets` view; update it with `vault.update_secret(...)`.
- The `vault` schema is privileged. Add small `SECURITY DEFINER` wrapper functions in the `public` schema (e.g. `public.set_bc_client_secret(org_id uuid, secret text)` and `public.get_bc_client_secret(org_id uuid)`) and call them from server actions using the **service-role** Supabase client (the app already uses `SUPABASE_SERVICE_ROLE_KEY` server-side for privileged queries).

**Fallback approach (only if Vault is unavailable in this project):** application-level encryption with Node's built-in `crypto`, AES-256-GCM, using a new env var `BC_CREDENTIALS_ENCRYPTION_KEY` as the master key. Store ciphertext, IV, and auth tag in columns on `business_central_credentials`. No npm package needed. If you use this, document `BC_CREDENTIALS_ENCRYPTION_KEY` in `nexus/CLAUDE.md`'s env section.

State clearly in your summary which approach you used and why.

### 1c. Client factory
In `src/lib/businessCentral/client.ts`, add a new resolver. Do not delete `createBcClientFromEnv()` / `readBcClientConfigFromEnv()` — they remain the fallback.

```
createBcClientForOrg(orgId, connectionId?) -> BcClient
```
Resolution logic:
1. Resolve the connection row: use `connectionId` if given; otherwise the org's `is_default` connection.
2. Look up `business_central_credentials` for the org.
   - **If a credentials row exists:** build the config from the stored credentials (tenant ID, client ID, decrypted client secret) plus the connection row (`environment`, `company_id`, `api_base_url`). This is the new path.
   - **If no credentials row exists:** fall back to `readBcClientConfigFromEnv()`, but if a connection row exists, override `environment` and `companyId` with the connection row's values. This keeps existing single-environment orgs working unchanged.
3. Return `createBcClient(config)`.

Note: the token cache in `client.ts` keys on `tenantId:clientId:apiBaseUrl`. Confirm that key is still correct when multiple environments share one tenant/client (it is — the token is per app registration, not per environment — but verify nothing else assumes a single global client).

### Phase 1 done when
- Migration applies cleanly and existing connection rows get `display_name` + `is_default`.
- `createBcClientForOrg()` exists with unit-test-level coverage in `client.test.ts` for both the credentials path and the env-fallback path.
- `npm run build` and `npm run lint` pass.

---

## Phase 2 — Settings UI for credentials and environments

Add two cards to `src/app/(protected)/settings/page.tsx`, below the existing "Order Number Format" card. Both are admin-only — gate them on `user.role === 'admin'` in the UI and re-check in every server action. Add the server actions to `businessCentralItems.ts` (or a new `businessCentralConnections.ts` if that file is getting too large — your call, state which).

### 2a. "Business Central Credentials" card
- Same card style as existing Settings sections.
- Fields: tenant ID, client ID, client secret, optional API base URL.
- The **client secret is a password input** and does **not** pre-fill on edit — a blank secret on save means "keep the existing secret". A non-blank value replaces it (via the Vault wrapper from Phase 1).
- One credentials row per org (upsert).
- The server action that reads credentials for display must **never** return the secret to the client — return only whether a secret is set.

### 2b. "Business Central Environments" card
- Same card style. Lists all `business_central_connections` rows for the org.
- Each row shows: display name, a "Default" badge if `is_default`, a status dot (green if `last_verified_at` is recent and no `last_error`, red if `last_error`), and actions: **Set default**, **Verify**, **Delete**.
- Each environment has a `display_name` and an `environment` (the BC environment name) and a `company_id`. Admins can add, edit, and rename.
- "Set default" flips `is_default` (respect the one-default-per-org index).
- "Verify" runs a connection test against that environment using `createBcClientForOrg(orgId, connectionId)` and updates that row's `last_verified_at` / `last_error`.
- "Delete" requires a confirmation dialog and is only allowed if another environment exists for the org. **Decide and implement what happens to that environment's `business_central_items`:** either block deletion when items exist, or cascade-delete them. Do not silently orphan them (`bc_connection_id` is `ON DELETE SET NULL`, which would leave dangling rows). State your choice.
- Add button "+ New Environment", styled like "+ New Category".

### Phase 2 done when
- An admin can enter credentials, add 2+ environments, set a default, verify each, and delete a non-default one.
- A non-admin sees neither card (or sees them read-only — pick one and state it).
- `npm run build` and `npm run lint` pass.

---

## Phase 3 — Environment selector in the org pill dropdown

Extend the dropdown in `Header.tsx`. Keep the existing `DropdownMenuContent` styling, item spacing, and hover states.

### 3a. Dropdown layout
```
[BC sync status — for the ACTIVE environment]
─────────────
Organizations
  Acme Corp          ← selected org, checkmark on the right (as today)
    Production        ← environments for the selected org, indented
    Test ✓            ← active environment has a checkmark
  Beta Inc            ← other orgs, no environments shown
```
- The selected org stays at top with its checkmark, exactly as now.
- Directly under the selected org, indented, list that org's environments. The active one has a checkmark.
- Other orgs are listed below, unchanged, with no environments.
- If the org has **no credentials configured**: show a "Configure Business Central" link to `/settings` under the selected org instead of an environment list.
- If credentials exist but **no environments** have been added: show "No environments" with a link to `/settings`.

### 3b. Active-environment persistence — match the existing org pattern
Look at `switchOrganization()` in `src/app/actions/organizations.ts`: it persists the active org by writing a **column on the `users` table** (`users.organization_id`), then redirects. It does **not** use localStorage or cookies.

Do the same for environments. **Do not use localStorage** — server actions and SSR cannot read it, and the Header receives BC status as a server-rendered prop.
- Add a server action `switchBcEnvironment(connectionId)` that writes `users.active_bc_connection_id` and then refreshes/redirects so server-side data reloads for the new environment.
- Server-side resolution of "the active environment": read the current user's `active_bc_connection_id`. If it is null, or points to a connection that does not belong to the user's current org, fall back to that org's `is_default` connection. Put this resolution in one shared helper and use it everywhere (the Header status, and every BC server action via `createBcClientForOrg`).

### 3c. Wire all BC operations to the active environment
- Every BC server action in `businessCentralItems.ts` (and `businessCentralItemsSpike.ts` if applicable) must build its client via `createBcClientForOrg(orgId, activeConnectionId)` instead of `createBcClientFromEnv()`. There are roughly six call sites — change all of them.
- Sync, item creation, pushing edits, reference refresh, and verify all target the active environment.
- The "Business Central sync" status section at the top of the dropdown (`BusinessCentralSyncStatusSection` in `Header.tsx`) must reflect the **active environment's** row (`last_verified_at`, `last_error`, `last_pulled_at`, `sync_in_progress_*`), not a single global connection.

### Phase 3 done when
- Switching environments in the dropdown changes which BC environment sync/create/push hit, verified end to end.
- The dropdown status reflects the active environment.
- An org with no credentials shows the "Configure Business Central" link; an org with credentials but no environments shows "No environments".
- `npm run build` and `npm run lint` pass.

---

## Backward compatibility (applies throughout)
- Orgs with **no `business_central_credentials` row** keep working off env vars via the fallback in `createBcClientForOrg()`. No behavior change for them.
- Existing `business_central_connections` rows become a single default environment per org (set in the Phase 1 migration).
- No changes to existing `business_central_items` rows. Note `business_central_items` has `UNIQUE (organization_id, bc_company_id, bc_item_id)` — confirm this still holds across environments (it does, because each environment's companies have distinct GUIDs) and do not change it unless you find a real collision.
