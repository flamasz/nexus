/**
 * seed-bc-credentials.ts
 *
 * One-time (idempotent) script: copies Business Central credentials from .env.local
 * into the business_central_credentials table and Supabase Vault, then ensures a
 * default business_central_connections row exists.
 *
 * Run from the nexus/ directory:
 *   npx tsx scripts/seed-bc-credentials.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// 1. Load .env.local (tsx does not auto-load it)
// ---------------------------------------------------------------------------
function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  let content: string;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    // .env.local not present — rely on already-set process.env vars
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already present (allow real env to win)
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// 2. Validate required env vars
// ---------------------------------------------------------------------------
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value.trim();
}

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const tenantId = requireEnv("BUSINESS_CENTRAL_TENANT_ID");
const clientId = requireEnv("BUSINESS_CENTRAL_CLIENT_ID");
const clientSecret = requireEnv("BUSINESS_CENTRAL_CLIENT_SECRET");
const environment = requireEnv("BUSINESS_CENTRAL_ENVIRONMENT");
const companyId = requireEnv("BUSINESS_CENTRAL_DEFAULT_COMPANY_ID");
const apiBaseUrl = process.env.BUSINESS_CENTRAL_API_BASE_URL?.trim() ?? null;

// ---------------------------------------------------------------------------
// 3. Service-role Supabase client (bypasses RLS — required for Vault RPCs)
// ---------------------------------------------------------------------------
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// ---------------------------------------------------------------------------
// 4. Seed
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("🌱 Seeding Business Central credentials...\n");

  // --- Resolve the single dev organization ---
  const { data: orgs, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (orgError) {
    throw new Error(`Failed to load organizations: ${orgError.message}`);
  }
  if (!orgs || orgs.length === 0) {
    throw new Error("No organizations found in the database.");
  }
  if (orgs.length > 1) {
    console.warn(
      `⚠️  Found ${orgs.length} organizations — using the first (oldest): ${orgs[0].name}\n`,
    );
  }
  const org = orgs[0] as { id: string; name: string };
  console.log(`  Org: ${org.name} (${org.id})`);

  // --- Upsert credentials row (non-secret fields only) ---
  // client_secret_id is intentionally excluded — it is managed by the Vault RPC below.
  const { error: upsertError } = await supabase
    .from("business_central_credentials")
    .upsert(
      {
        organization_id: org.id,
        tenant_id: tenantId,
        client_id: clientId,
        default_api_base_url: apiBaseUrl,
      },
      { onConflict: "organization_id" },
    );

  if (upsertError) {
    throw new Error(`Failed to upsert credentials row: ${upsertError.message}`);
  }
  console.log("  ✓ Credentials row upserted (tenant_id, client_id, api_base_url)");

  // --- Reconcile any orphaned Vault secret (e.g. from a dev round-trip test) ---
  // If a vault secret named bc_client_secret_{org_id} already exists but the credentials
  // row has client_secret_id = NULL, set_bc_client_secret would try vault.create_secret
  // and hit a unique-name collision.  Fix: populate client_secret_id first so the RPC
  // takes the vault.update_secret path instead.
  const secretName = `bc_client_secret_${org.id}`;
  const { data: existingSecret } = await supabase
    .schema("vault")
    .from("secrets")
    .select("id")
    .eq("name", secretName)
    .maybeSingle();

  if (existingSecret) {
    const existing = existingSecret as { id: string };
    // Check whether the credentials row already knows about this secret
    const { data: credsRow } = await supabase
      .from("business_central_credentials")
      .select("client_secret_id")
      .eq("organization_id", org.id)
      .maybeSingle();

    const creds = credsRow as { client_secret_id: string | null } | null;
    if (!creds?.client_secret_id) {
      // Point the credentials row at the orphaned secret so the RPC updates it
      const { error: patchErr } = await supabase
        .from("business_central_credentials")
        .update({ client_secret_id: existing.id })
        .eq("organization_id", org.id);
      if (patchErr) {
        throw new Error(
          `Failed to reconcile orphaned Vault secret: ${patchErr.message}`,
        );
      }
      console.log(`  ✓ Reconciled orphaned Vault secret (id: ${existing.id})`);
    }
  }

  // --- Store / rotate the client secret in Vault ---
  // set_bc_client_secret: creates a new Vault secret on first run, rotates it on re-runs.
  // It also writes client_secret_id back into the credentials row.
  const { data: secretId, error: secretError } = await supabase.rpc(
    "set_bc_client_secret",
    { p_org_id: org.id, p_secret: clientSecret },
  );

  if (secretError) {
    throw new Error(`Failed to store client secret in Vault: ${secretError.message}`);
  }
  console.log(`  ✓ Client secret stored in Vault (secret id: ${secretId})`);

  // --- Ensure a default business_central_connections row exists ---
  const { data: existingConn, error: connQueryError } = await supabase
    .from("business_central_connections")
    .select("id, display_name, is_default")
    .eq("organization_id", org.id)
    .eq("is_default", true)
    .maybeSingle();

  if (connQueryError) {
    throw new Error(
      `Failed to query default connection: ${connQueryError.message}`,
    );
  }

  if (existingConn) {
    const conn = existingConn as { id: string; display_name: string; is_default: boolean };
    console.log(
      `  ✓ Default connection already exists: "${conn.display_name}" (${conn.id})`,
    );
  } else {
    const { error: insertConnError } = await supabase
      .from("business_central_connections")
      .insert({
        organization_id: org.id,
        display_name: environment,
        environment,
        company_id: companyId,
        is_default: true,
        ...(apiBaseUrl ? { api_base_url: apiBaseUrl } : {}),
      });

    if (insertConnError) {
      throw new Error(
        `Failed to insert default connection: ${insertConnError.message}`,
      );
    }
    console.log(`  ✓ Default connection created: "${environment}"`);
  }

  // --- Vault round-trip verification ---
  const { data: retrievedSecret, error: getError } = await supabase.rpc(
    "get_bc_client_secret",
    { p_org_id: org.id },
  );

  if (getError) {
    throw new Error(`Failed to verify client secret: ${getError.message}`);
  }
  if (retrievedSecret !== clientSecret) {
    throw new Error(
      "Vault round-trip FAILED: retrieved secret does not match the stored secret.",
    );
  }
  console.log("  ✓ Vault round-trip verified: retrieved secret matches\n");
  console.log("✅ Seed complete.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Seed failed: ${message}`);
  process.exit(1);
});
