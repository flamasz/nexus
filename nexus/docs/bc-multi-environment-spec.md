# Deep Interview Spec: Multi-Environment Business Central Connections

## Metadata
- Rounds: 8 (+ Round 0 topology gate)
- Final Ambiguity Score: ~12%
- Type: brownfield
- Generated: 2026-05-20
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 0.35 | 0.32 |
| Constraint Clarity | 0.88 | 0.25 | 0.22 |
| Success Criteria | 0.85 | 0.25 | 0.21 |
| Context Clarity | 0.90 | 0.15 | 0.14 |
| **Total Clarity** | | | **0.88** |
| **Ambiguity** | | | **0.12** |

## Topology
| Component | Status | Description | Coverage Note |
|-----------|--------|-------------|---------------|
| Data layer | active | Schema migration, `business_central_credentials` table, Vault secret storage, `createBcClientForOrg()` factory, one-time env-var seed | Built first |
| Settings UI | active | Admin-only cards: credentials entry + environment CRUD (add/edit/verify/delete) | Built second |
| Environment switcher | active | Org pill dropdown extension, per-user active-environment persistence, rewiring all BC operations + `/items` filtering | Built third |

## Goal
Let an organization hold one shared set of Business Central credentials and connect to multiple BC environments (e.g. TEST, PRODUCTION). Each user independently selects an active environment from the org pill dropdown; all BC viewing and sync operations are scoped to that user's active environment. Credentials are entered once per org in an admin-only Settings section; environments are managed there too.

## Constraints
- No new npm packages — existing shadcn/ui, Tailwind, Supabase, Node built-ins only.
- Client secret stored in **Supabase Vault**, encrypted at rest; never sent to the browser.
- Tenant ID and client ID are shared per org; **company is per-environment** (distinct company GUIDs per BC environment).
- Three reviewable phases, built and reviewed in order: Data layer → Settings UI → Environment switcher.
- `npm run build` and `npm run lint` must pass at the end of each phase.
- Match existing Settings card styling (`bg-surface rounded-lg border border-border shadow-sm`, etc.).

## Non-Goals
- No backward-compatible env-var fallback code path — it is removed entirely (see Decision 7).
- No cross-environment combined item view — `/items` shows one environment at a time.
- No production-data migration concerns — only a dev/test setup exists today.
- No per-environment credentials — credentials are shared across an org's environments.

## Key Decisions (resolved in interview)
1. **Topology** — 3 components, built in order: Data layer, Settings UI, Environment switcher.
2. **Live state** — only the developer's dev/test setup exists; no production org, no real synced data to protect.
3. **Deleting an environment** — keep its `business_central_items`, mark them orphaned. `bc_connection_id` is already `ON DELETE SET NULL`; orphaned items (null connection) become read-only history. Deletion still requires another environment to exist + a confirm dialog.
4. **Active environment scope** — per-user choice. Each user picks their own environment; every sync/create/push/verify operation is scoped to the acting user's active environment. Per-environment item rows never collide because each environment uses a distinct company GUID.
5. **Per-org credentials** — build the full `business_central_credentials` table now, even though one org uses it.
6. **Secret storage** — Supabase Vault. Enable the Vault extension; store the secret via `vault.create_secret`, keep only its UUID in `business_central_credentials.client_secret_id`; access through `SECURITY DEFINER` wrappers in the `public` schema called by the service-role client.
7. **Env-var transition** — automatic. A one-time seed step (run in app context, since SQL cannot read env vars or write Vault) copies current env-var credentials into the new credentials table + creates a default environment row for the dev org. After seeding, the env-var code path (`createBcClientFromEnv`, `readBcClientConfigFromEnv`, the fallback branch) is deleted.
8. **Items view** — the `/items` page and BC item lists show only the active environment's items. Switching environments swaps the visible list.
9. **Access** — the credentials + environments Settings cards are admin-only (hidden for non-admins): only admins can add/edit/verify/delete. Environment *switching* in the dropdown is available to all users. Server actions re-check `role === 'admin'` for all management operations.

## Acceptance Criteria
- [ ] Migration adds `business_central_credentials`, drops `business_central_connections` `UNIQUE(organization_id)`, adds `display_name` + `is_default` + a one-default-per-org partial unique index, adds `users.active_bc_connection_id`.
- [ ] Existing `business_central_connections` rows get `display_name = environment` and `is_default = true`.
- [ ] Supabase Vault stores the client secret; the secret never appears in any table column or any client response.
- [ ] One-time seed step copies env-var credentials into the new tables; afterward env-var code paths are removed and the build still passes.
- [ ] `createBcClientForOrg(orgId, connectionId)` builds a client from stored credentials + a connection row, with unit coverage in `client.test.ts`.
- [ ] Admin can enter/update credentials (secret is a password input, blank = keep existing) and add/edit/verify/delete environments in Settings; non-admins do not see these cards.
- [ ] Deleting an environment is blocked unless another exists, requires confirmation, and leaves its items as read-only orphaned records.
- [ ] Org pill dropdown lists environments indented under the selected org; active environment has a checkmark; "Configure Business Central" / "No environments" links appear when appropriate.
- [ ] Switching environment writes `users.active_bc_connection_id` and refreshes server-rendered data.
- [ ] All BC server actions (`businessCentralItems.ts` + `businessCentralItemsSpike.ts` if applicable) target the acting user's active environment; the `/items` page shows only that environment's items.
- [ ] The dropdown's BC sync status section reflects the active environment's row.
- [ ] `npm run build` and `npm run lint` pass after each phase.

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| Active environment is global/per-org | Per-user vs per-org? | Per-user; operations scoped to acting user's environment |
| Env-var fallback must be preserved | Simplifier: is it dead weight? | Removed entirely after auto-seed |
| Credentials must move to DB now | Contrarian: defer until 2nd org? | Rejected — full per-org credentials built now |
| Deleting an environment is destructive to items | What happens to synced items? | Items kept, marked orphaned (read-only) |
| Secret storage mechanism unspecified | Vault vs app-level encryption? | Supabase Vault |
| Production data at risk | What is actually live? | Only dev/test setup; no production data |

## Technical Context
- BC server actions: `nexus/src/app/actions/businessCentralItems.ts` (~800 lines), possibly `businessCentralItemsSpike.ts`.
- BC client: `nexus/src/lib/businessCentral/client.ts` — `createBcClient`, `createBcClientFromEnv`, `readBcClientConfigFromEnv`. Token cache keys on `tenantId:clientId:apiBaseUrl` (safe across environments sharing one app registration).
- `business_central_connections` (migration `015`) currently `UNIQUE(organization_id)`, stores environment + company + sync state, no credentials.
- `business_central_items` has `bc_connection_id` (`ON DELETE SET NULL`), `bc_environment`, `bc_company_id`; `UNIQUE(organization_id, bc_company_id, bc_item_id)`.
- Org pill dropdown: `nexus/src/components/layout/Header.tsx`. `switchOrganization()` persists active org as `users.organization_id` — the pattern to mirror for environment switching.
- Settings page: `nexus/src/app/(protected)/settings/page.tsx` — client component, stacked cards.
- Existing BC RLS policies use `USING (true)` — must NOT be copied for the credentials table; scope to the owning org.
- New migration file: `nexus/supabase/migrations/024_multi_bc_environments.sql`.

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Organization | core domain | id, name | has one BusinessCentralCredentials; has many BusinessCentralConnections |
| BusinessCentralCredentials | core domain (new) | organization_id, tenant_id, client_id, client_secret_id (Vault ref), default_api_base_url | belongs to Organization |
| BusinessCentralConnection (Environment) | core domain | id, organization_id, display_name, environment, company_id, company_name, api_base_url, is_default, sync state | belongs to Organization; has many BusinessCentralItems |
| User | core domain | id, organization_id, role, active_bc_connection_id | belongs to Organization; selects one active BusinessCentralConnection |
| BusinessCentralItem | core domain | bc_connection_id, bc_environment, bc_company_id, ... | belongs to a BusinessCentralConnection; orphaned when connection deleted |
| VaultSecret | external system | id, decrypted_secret | referenced by BusinessCentralCredentials.client_secret_id |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|-----------------|
| 1 | 4 | 4 | - | - | N/A |
| 3 | 5 | 1 | 0 | 4 | 100% |
| 5 | 6 | 1 | 0 | 5 | 100% |
| 7 | 6 | 0 | 0 | 6 | 100% |

Domain model converged — same 6 entities stable across the final rounds.

## Interview Transcript
<details>
<summary>Full Q&A (Round 0 + 7 rounds)</summary>

**Round 0 — Topology:** Confirmed 3 components (Data layer, Settings UI, Environment switcher), built in order.

**Round 1 — Live state:** Only the developer's dev/test setup exists; no production org or data.

**Round 2 — Delete environment:** Keep items, mark orphaned (read-only history).

**Round 3 — Active environment scope:** Per-user; each user works in their own environment; syncs apply only to that environment.

**Round 4 — Credentials scope (Contrarian):** Build full per-org credentials in the DB now.

**Round 5 — Secret storage:** Supabase Vault.

**Round 6 — Env-var fallback (Simplifier):** Auto-migrate env vars into the new tables, then remove the env-var code path.

**Round 7 — Items view:** `/items` shows only the active environment's items.

**Round 8 — BC access:** Admins manage credentials + environments; any user can switch their own active environment.
</details>
