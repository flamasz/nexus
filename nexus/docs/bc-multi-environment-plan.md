# Consensus Plan: Multi-Environment Business Central Connections

Status: pending approval
Source spec: `.omc/specs/deep-interview-multi-bc-env.md`
Mode: consensus / deliberate (schema migration + secret storage = high-risk)

## Requirements Summary

Let one organization hold a single shared set of Business Central credentials (tenant ID, client ID, client secret) and connect to multiple BC environments (e.g. TEST, PRODUCTION). Each user independently picks an active environment from the org pill dropdown; all BC viewing and sync operations are scoped to that user's active environment. Admins manage credentials and environments in Settings. Built in three reviewable phases: Data layer → Settings UI → Environment switcher.

## RALPLAN-DR Summary

### Principles
1. **One code path, no dead branches** — after the env-var seed, there is exactly one way to build a BC client.
2. **Secrets never touch a table column or a client payload** — the client secret lives only in Supabase Vault.
3. **Mirror existing patterns** — environment switching follows the established `switchOrganization()` → `users` column pattern.
4. **Each phase ships green** — `npm run build` + `npm run lint` pass at every phase boundary.
5. **Fail safe, not silent** — a missing credential or environment surfaces a clear error, never a wrong-environment write.

### Decision Drivers
1. Only a dev/test setup exists today — no production data to protect, so migration can be aggressive.
2. Security: a client secret is moving from env vars into a database for the first time.
3. Beginner developer maintaining this — favor fewer moving parts and conventional patterns.

### Viable Options

**Option A — Phase 1 swaps the client factory; env-var path removed at Phase 2 start.** Chosen (with the synthesis below).
- Pros: a single client code path from Phase 2 on; Phases 2-3 build on a stable factory; matches Principle 1; Phase 1 still ships CI-green because the fallback survives until Phase 2.
- Cons: Phase 1 touches `businessCentralItems.ts` call sites, slightly larger than "schema only"; the fallback lives for one extra phase (negligible — ~10 lines).

**Option B — Keep env-var fallback through Phase 3, remove it last.**
- Pros: Phase 1 is purely additive (schema + factory), lower risk per phase.
- Cons: a dual code path lives for two phases; the fallback branch is tested then deleted — wasted effort; violates Principle 1.

**Invalidation of B:** The spec explicitly resolved (Decision 7) to auto-migrate env vars and remove the env-var path. Carrying a fallback for two phases contradicts that decision and the "one code path" principle. B is rejected.

### Architecture seam (resolves the phase-overlap)
A single helper `resolveActiveBcConnection(orgId, userId)` is introduced in Phase 1. In Phase 1 it returns the org's default connection. In Phase 3 its internals are upgraded to read `users.active_bc_connection_id` (falling back to default). **Call sites never change after Phase 1** — only the helper's body changes. This is the clean seam that lets Phase 1 own the full factory swap while Phase 3 owns per-user selection.

### Synthesis: env-var deletion moves to Phase 2 start (Architect/Critic finding)
Option A as first drafted deleted `createBcClientFromEnv` *within* Phase 1 — but that makes Phase 1 un-verifiable from a clean checkout (the DB-backed path is only provable after a manual seed against the dev DB, which CI cannot reproduce). **Revised:** Phase 1 introduces `createBcClientForOrg` and rewires call sites but **keeps `createBcClientFromEnv`/`readBcClientConfigFromEnv` as the resolver's fallback**, so Phase 1 ships green from a clean checkout. The env-var functions and their tests are deleted at the **start of Phase 2**, after the seed is verified on the dev box. This still honors spec Decision 7 (the env-var path *is* removed) and keeps every phase boundary CI-green.

## Acceptance Criteria

### Phase 1 — Data layer
- [ ] Migration `024_multi_bc_environments.sql` applies cleanly on a copy of the current DB.
- [ ] `business_central_connections`: `UNIQUE(organization_id)` dropped; `display_name TEXT NOT NULL` + `is_default BOOLEAN NOT NULL DEFAULT FALSE` added; partial unique index `WHERE is_default` enforces one default per org.
- [ ] Existing connection rows backfilled: `display_name = environment`, `is_default = true`.
- [ ] `business_central_credentials` table created (`organization_id` UNIQUE, `tenant_id`, `client_id`, `client_secret_id UUID`, `default_api_base_url`, timestamps, `updated_at` trigger).
- [ ] `users.active_bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL` added.
- [ ] Supabase Vault extension enabled; `public.set_bc_client_secret(org_id, secret)` and `public.get_bc_client_secret(org_id)` `SECURITY DEFINER` wrappers created.
- [ ] RLS on `business_central_credentials` scoped to the owning org; writes restricted to admins. RLS on `business_central_connections` SELECT scoped to the owning org. The `USING(true)` pattern is NOT reused.
- [ ] One-time seed script `nexus/scripts/seed-bc-credentials.ts` copies env-var credentials into `business_central_credentials` + ensures a default `business_central_connections` row exists; idempotent.
- [ ] `createBcClientForOrg(orgId, connectionId?)` added to `client.ts`; `resolveActiveBcConnection(orgId, userId)` helper added (returns org default in Phase 1).
- [ ] All `createBcClientFromEnv()` call sites in `businessCentralItems.ts` AND `businessCentralItemsSpike.ts` (5 sites at lines 46,64,73,83,96) rewired to `createBcClientForOrg`.
- [ ] `createBcClientFromEnv` / `readBcClientConfigFromEnv` are KEPT in Phase 1 as the resolver's fallback (deleted at Phase 2 start, not here).
- [ ] `npm run build` + `npm run lint` pass from a clean checkout (no manual seed required to compile).
- [ ] `client.test.ts` adds coverage for `createBcClientForOrg` (credentials present); existing `readBcClientConfigFromEnv` tests remain green.

### Phase 2 — Settings UI
- [ ] At Phase 2 start (after the seed is verified on the dev box): delete `createBcClientFromEnv`, `readBcClientConfigFromEnv`, the env-var fallback branch in the resolver, AND the `readBcClientConfigFromEnv` test cases in `client.test.ts` (the `.toThrow()` assertions) — in one commit so the build stays green. Update `nexus/CLAUDE.md` env section: BC env vars are seed-only.
- [ ] **Legacy connection logic fixed for the dropped unique constraint (Phase 1 carryover).** Migration 024 dropped `UNIQUE(organization_id)` on `business_central_connections`. The legacy code in `businessCentralItems.ts` still assumes one connection per org and breaks at runtime: `verifyBusinessCentralConnection` upserts with `{ onConflict: 'organization_id' }` (throws "no unique or exclusion constraint matching the ON CONFLICT specification"), and `getConnection`/`requireConnection` use `.maybeSingle()` on org (throws once an org has 2+ environments). Phase 2 must either replace these with the new connection-aware logic (per-`connectionId` reads, `createBcConnection`/`verifyBcConnection(connectionId)` from the new actions file) or delete the dead legacy paths. Until this lands the "Verify connection" path is non-functional — acceptable only between Phase 1 and Phase 2 because the dev connection already exists via the seed.
- [ ] New server actions (in `businessCentralConnections.ts`): `getBcCredentials`, `upsertBcCredentials`, `listBcConnections`, `createBcConnection`, `updateBcConnection`, `deleteBcConnection`, `setDefaultBcConnection`, `verifyBcConnection(connectionId)` — all management actions re-check `role === 'admin'`.
- [ ] `getBcCredentials` returns tenant/client IDs + `hasSecret: boolean` only — never the secret.
- [ ] Settings page shows a "Business Central Credentials" card and a "Business Central Environments" card, admin-only (hidden for non-admins), matching existing card styling.
- [ ] Credentials secret field is a password input; blank on save keeps the existing secret.
- [ ] Environments card lists rows with display name, default badge, status dot (green = verified recently & no error, red = `last_error`), and Set default / Verify / Delete actions; "+ New Environment" button.
- [ ] Delete is blocked when only one environment exists, requires a confirm dialog, and leaves items intact (FK `SET NULL`).
- [ ] `npm run build` + `npm run lint` pass.

### Phase 3 — Environment switcher
- [ ] `switchBcEnvironment(connectionId)` server action validates the connection belongs to the user's current org, writes `users.active_bc_connection_id`, and refreshes server-rendered data.
- [ ] `resolveActiveBcConnection` upgraded to read `users.active_bc_connection_id`, falling back to the org default when null or cross-org.
- [ ] Org pill dropdown lists environments indented under the selected org; active environment shows a checkmark; "Configure Business Central" link when no credentials; "No environments" link when credentials exist but no environments.
- [ ] Any user can switch their own environment; switching is not admin-gated.
- [ ] The dropdown's BC sync status section reflects the active environment's connection row.
- [ ] `/items` page and BC item lists show only the active environment's items.
- [ ] All BC operations (sync, create, push, reference refresh, verify) target the acting user's active environment.
- [ ] `npm run build` + `npm run lint` pass.

## Implementation Steps

### Phase 1 — Data layer

1. **Migration** `nexus/supabase/migrations/024_multi_bc_environments.sql`:
   - `ALTER TABLE business_central_connections DROP CONSTRAINT business_central_connections_organization_id_key;` (verify the exact constraint name first via `\d business_central_connections`).
   - Add `display_name` (nullable), backfill `= environment`, then `SET NOT NULL`.
   - Add `is_default BOOLEAN NOT NULL DEFAULT FALSE`; backfill existing rows to `TRUE`.
   - `CREATE UNIQUE INDEX idx_bc_connections_one_default_per_org ON business_central_connections (organization_id) WHERE is_default;`
   - `CREATE TABLE business_central_credentials (...)` with `updated_at` trigger using `update_updated_at_column()`.
   - `ALTER TABLE users ADD COLUMN active_bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;`
   - `CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault CASCADE;` — Vault is confirmed already enabled on this project (verified via `pg_extension`), so this is effectively a no-op safety net.
   - **SECURITY DEFINER wrappers.** Supabase runs migrations as the `postgres` role, which owns and can access the `vault` schema — so the functions are created (and owned) by `postgres`; do not invent a custom role. Both functions MUST be hardened: `SECURITY DEFINER`, `SET search_path = ''`, and every object reference schema-qualified (`vault.create_secret`, `public.business_central_credentials`, etc.). `REVOKE ALL ... FROM public, anon;` then `GRANT EXECUTE ... TO service_role;`. Shape:
     ```sql
     CREATE FUNCTION public.set_bc_client_secret(p_org_id uuid, p_secret text)
       RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ ... $$;
     CREATE FUNCTION public.get_bc_client_secret(p_org_id uuid)
       RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ ... $$;
     ```
   - **RLS — no prior art exists** (verified: zero migrations use an `organization_id IN (SELECT ...)` policy; `015` uses `USING(true)` everywhere). Write the policy explicitly, do not "mirror" a non-existent one. Enable RLS on `business_central_credentials` and add:
     ```sql
     CREATE POLICY "Org members view BC credentials" ON business_central_credentials
       FOR SELECT TO authenticated
       USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
     CREATE POLICY "Org admins manage BC credentials" ON business_central_credentials
       FOR ALL TO authenticated
       USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
              AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
       WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
              AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
     ```
     Also replace the `business_central_connections` SELECT `USING(true)` policy with the same org-scoped `USING` predicate. Note: if this workspace uses the optional `org_members` table (see `supportsOrgMembers()` in `organizations.ts`), the subquery should target `org_members` instead — confirm which is canonical before writing the migration. This RLS work is **defense-in-depth only** (see Risks) — it does not gate any current code path.
   - Include a commented DOWN migration block, matching the `015` file convention.
2. **Seed script** `nexus/scripts/seed-bc-credentials.ts` (run with `npx tsx`): read `readBcClientConfigFromEnv()`, resolve the single org, upsert `business_central_credentials` (call `set_bc_client_secret` for the secret), ensure a `business_central_connections` row exists with `display_name` + `is_default = true`. Idempotent (safe to re-run).
3. **Client factory** in `nexus/src/lib/businessCentral/client.ts`: add `createBcClientForOrg(orgId, connectionId?)` — resolves the connection (given or default), loads `business_central_credentials`, decrypts the secret via the `get_bc_client_secret` RPC using the service-role client, builds `BcClientConfig`, returns `createBcClient(config)`.
4. **Resolver helper** (new, e.g. `nexus/src/lib/businessCentral/activeConnection.ts`): `resolveActiveBcConnection(orgId, userId)` — Phase 1 returns the org's `is_default` connection.
5. **Rewire call sites**: replace every `createBcClientFromEnv()` in `nexus/src/app/actions/businessCentralItems.ts` AND `nexus/src/app/actions/businessCentralItemsSpike.ts` (5 sites: lines 46,64,73,83,96) with `createBcClientForOrg(orgId, connectionId)`, sourcing `connectionId` from `resolveActiveBcConnection`. The resolver keeps an env-var fallback this phase, so the rewired code still works before the seed.
6. **Run the seed** (`npx tsx nexus/scripts/seed-bc-credentials.ts`) and manually verify a BC operation works against the seeded credentials. Do NOT delete env-var code in Phase 1 — that happens at Phase 2 start (see Phase 2 criteria). The seed and any later deletion are separate commits so the seed can be re-run if a subsequent step fails.
7. Add `createBcClientForOrg` tests in `client.test.ts` (keep existing env-var tests green); `npm run build` + `npm run lint`.

### Phase 2 — Settings UI

8. **Server actions** `nexus/src/app/actions/businessCentralConnections.ts` — the eight actions listed in the acceptance criteria; admin re-check via the existing permission helper used in `businessCentralItems.ts` (`requirePermission` / `canManageBusinessCentralConnection`).
9. **Components** under `nexus/src/components/businessCentral/`: `BcCredentialsCard`, `BcEnvironmentsCard` (+ a small new-environment form/modal). Reuse shadcn/ui inputs and the existing card classes.
10. **Settings page** `nexus/src/app/(protected)/settings/page.tsx`: render both cards below "Order Number Format", gated on `user.role === 'admin'`. The page already loads data on mount — extend that pattern.
11. `npm run build` + `npm run lint`.

### Phase 3 — Environment switcher

12. **Server action** `switchBcEnvironment(connectionId)` in `businessCentralConnections.ts` — mirror `switchOrganization()`: validate membership, write `users.active_bc_connection_id`, refresh.
13. **Upgrade** `resolveActiveBcConnection` to read `users.active_bc_connection_id`; fall back to default when null or the connection's org ≠ the user's current org.
14. **Header dropdown** `nexus/src/components/layout/Header.tsx`: render environments indented under the selected org; checkmark on the active one; empty/no-credentials links; `BusinessCentralSyncStatusSection` reads the active connection. The Header receives status as a server-rendered prop — extend the server-side data fetch that feeds it.
15. **`/items` filtering** `nexus/src/app/(protected)/items/page.tsx`: filter BC item queries by the active connection id.
16. `npm run build` + `npm run lint`.

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Vault `SECURITY DEFINER` wrappers fail (owner lacks vault access) | High | Create wrappers owned by a vault-capable role; test `set`/`get` round-trip in the migration's verification step before Phase 1 is declared done. |
| RLS tightening breaks a BC read path | Low | Verified: all BC reads in `businessCentralItems.ts` use `createServiceClient()` (~13 sites), which bypasses RLS; the Header's status read goes through `getBusinessCentralConnectionStatus()` → service-role (`layout.tsx:52`). RLS tightening therefore cannot break the current functional paths — it is defense-in-depth for the `authenticated`/anon client only. Action: grep for any `createClient()` (anon) reads of BC tables and confirm the inventory before writing policies. |
| Env-var code deleted before the seed succeeds → no credentials, BC dead | High | Strict step order: rewire call sites → run & verify seed → only then delete env-var code. Keep env vars in `.env.local` until the seed is confirmed. |
| Vault extension not enabled on the Supabase project | Resolved | Confirmed enabled via `pg_extension` check. No fallback needed. |
| `business_central_items` `UNIQUE(organization_id, bc_company_id, bc_item_id)` collides across environments | Low | Each BC environment has distinct company GUIDs, so no collision in practice; documented. Do not change the constraint unless a real collision appears. |
| Deleting an environment that is a user's `active_bc_connection_id` | Low | FK `ON DELETE SET NULL` nulls it; `resolveActiveBcConnection` falls back to the org default. |
| Orphaned items (deleted environment) invisible because `/items` filters by active env | Low | Acceptable per spec (read-only history). Optionally add an "orphaned" view later — out of scope. |

## Pre-mortem (deliberate mode)

1. **Phase 1 — "It built fine but every BC call returns 401."** The Vault wrapper returned an empty/garbled secret because the `SECURITY DEFINER` function could not read `vault.decrypted_secrets` (search_path or ownership issue). → Mitigation: a migration-time round-trip test (`set` then `get` a dummy secret, assert equality) gates Phase 1; functions created as `postgres` with `SET search_path = ''` and schema-qualified refs.
2. **Phase 2 — "The admin opened credentials, hit Save, and the real secret was wiped."** The "blank secret = keep existing" logic inverted, or an empty string was treated as a new secret and overwrote the Vault entry. → Mitigation: `upsertBcCredentials` explicitly branches on `secret === '' || secret == null` → skip the secret write entirely; never call `set_bc_client_secret` with a falsy value; cover with a unit test ("save with blank secret leaves `client_secret_id` unchanged").
3. **Phase 3 — "User switched to TEST but sync still hit PRODUCTION."** A BC server action read the org default instead of the acting user's `active_bc_connection_id`, because one call site bypassed `resolveActiveBcConnection`. → Mitigation: after Phase 1 every client build goes through the resolver; Phase 3 changes only the resolver body, so no call site can drift. Add an e2e assertion that a TEST-scoped sync writes only rows with the TEST `bc_connection_id`.

## Expanded Test Plan (deliberate mode)

- **Unit:** `createBcClientForOrg` builds a correct config from credentials + connection; `resolveActiveBcConnection` returns default in Phase 1 and the per-user value in Phase 3; existing `itemMapper` / `calculations` tests still pass.
- **Integration:** migration `024` applies and its DOWN block reverses cleanly on a DB copy; Vault `set`/`get` round-trip; RLS — an admin of org A cannot read org B's credentials row; a non-admin cannot write credentials.
- **e2e:** admin enters credentials → adds TEST + PRODUCTION → verifies both → switches environment in the dropdown → `/items` list swaps → sync in TEST only touches TEST items → delete a non-default environment is confirmed and its items remain.
- **Observability:** `business_central_item_sync_events` continues to log per operation; each connection's `last_error` / `last_verified_at` / `last_pulled_at` update independently; verify failures write `last_error` on the correct connection row.

## Verification Steps

1. `cd nexus && npm run build && npm run lint` at each phase boundary.
2. Apply migration `024` to a database copy; confirm schema and run the DOWN block.
3. Run `seed-bc-credentials.ts`; confirm a `business_central_credentials` row and a default connection exist and `get_bc_client_secret` returns the original secret.
4. Manual e2e walkthrough per the Test Plan, as both an admin and a non-admin user.

## ADR

**Decision:** Implement multi-environment BC support in three phases, with Phase 1 performing the complete client-factory swap (introduce `createBcClientForOrg`, seed credentials from env vars, delete the env-var path) behind a `resolveActiveBcConnection` helper whose internals — not its call sites — change in Phase 3.

**Drivers:** No production data exists (aggressive migration is safe); a secret is entering the database for the first time (security rigor required); a beginner developer maintains this (fewer code paths, conventional patterns).

**Alternatives considered:** (B) Keep the env-var fallback through Phase 3 — rejected: contradicts spec Decision 7 and leaves a dual code path tested then discarded. (Secret storage) App-level AES-256-GCM — kept only as a documented fallback if Vault is unavailable; Vault chosen per spec Decision 6 because the encryption key lives outside the database.

**Why chosen:** The helper seam lets each phase ship green with a single client code path, satisfies the resolved spec decisions, and keeps the riskiest change (secret storage) isolated and test-gated in Phase 1.

**Consequences:** Phase 1 is larger than a pure schema migration (it touches server-action call sites). BC env vars become seed-only and are removed from runtime requirements. RLS for BC tables is tightened, which requires verifying every existing read path.

**Follow-ups:** Optional orphaned-items view; consider adding `bc_connection_id` to the `business_central_items` uniqueness key only if a real cross-environment collision is observed.

## Open Questions — RESOLVED

1. **Supabase Vault availability — RESOLVED: enabled.** The hosted project (`ynixduyrtgwkmwxflngd.supabase.co`) was checked via `select * from pg_extension where extname = 'supabase_vault';`, which returned a row. The extension is already installed in the `vault` schema, so the migration's `CREATE EXTENSION IF NOT EXISTS` is a no-op. The AES-256-GCM fallback is not needed and is dropped from scope.
2. **Membership table — RESOLVED: `users.organization_id`.** No migration creates an `org_members` table; `supportsOrgMembers()` in `organizations.ts:19` is a runtime probe that returns `false` and falls back to `users.organization_id` when the table is absent. `org_members` is unbuilt forward-compat scaffolding. All RLS subqueries target `users` — e.g. `organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())` — as already written in Step 1. Consistent with the per-user / one-org-at-a-time model from the spec.

## Notes

- **Token cache:** `client.ts` caches the access token keyed on `tenantId:clientId:apiBaseUrl`. Since all of an org's environments share one app registration (tenant + client), switching environments does not require cache invalidation — the token is valid across environments. No action needed; noted to prevent a spurious "invalidate cache on switch" step.

## Changelog (consensus revisions)

Applied after Architect + Critic review (verdict: APPROVED-WITH-IMPROVEMENTS):
- **Phase verifiability:** env-var deletion moved from Phase 1 to Phase 2 start, so Phase 1 ships CI-green from a clean checkout (Architect synthesis / Critic finding #1).
- **Test break:** added an explicit step to delete the `readBcClientConfigFromEnv` test cases in `client.test.ts` alongside the function (Critic #1).
- **RLS risk corrected:** all BC reads use the service-role client and bypass RLS; the "High" Header-lockout risk and its pre-mortem were a phantom failure — rewritten as Low / defense-in-depth (Architect #5, Critic #2).
- **RLS has no prior art:** exact policy SQL written into Step 1 instead of "mirror `categories`" (Critic #3).
- **SECURITY DEFINER hardened:** `SET search_path = ''`, schema-qualified refs, functions owned by `postgres` (Architect #2, Critic #4).
- **Spike file:** `businessCentralItemsSpike.ts` hedge removed — 5 call sites are a hard checklist item (Architect #4, Critic #5).
- **Pre-mortem:** rebalanced to one scenario per phase (was Phase-1-only).
