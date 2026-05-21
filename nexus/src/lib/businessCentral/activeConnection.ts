import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { BusinessCentralConnection } from "@/types/database";

/**
 * Resolves the Business Central environment (connection) a user is acting in.
 *
 * This is the single seam between BC operations and environment selection:
 * every BC client built for an org flows the resolved connection id into
 * `createBcClientForOrg`. Call sites never change after Phase 1 — only this
 * function's body does.
 *
 * - Phase 1 (now): always returns the organization's default (`is_default`)
 *   connection, or `null` when none exists yet (pre-seed).
 * - Phase 3 (later): this body is upgraded to read
 *   `users.active_bc_connection_id`, falling back to the org default when that
 *   is null or points at a connection in a different org.
 */
export async function resolveActiveBcConnection(
  orgId: string,
  userId: string,
): Promise<BusinessCentralConnection | null> {
  // Phase 1 ignores the per-user selection; Phase 3 will use `userId`.
  void userId;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("business_central_connections")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to resolve the active Business Central environment: ${error.message}`,
    );
  }

  return (data as BusinessCentralConnection | null) ?? null;
}
