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
 * - Returns the user's `active_bc_connection_id` connection when it is set and
 *   belongs to `orgId`.
 * - Otherwise falls back to the organization's default (`is_default`)
 *   connection, or `null` when none exists.
 */
export async function resolveActiveBcConnection(
  orgId: string,
  userId: string,
): Promise<BusinessCentralConnection | null> {
  const supabase = createServiceClient();

  // Per-user selection takes precedence when it points at a connection that
  // still belongs to this org (a cross-org or deleted pointer is ignored).
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("active_bc_connection_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError) {
    throw new Error(
      `Failed to resolve the active Business Central environment: ${userError.message}`,
    );
  }

  const activeConnectionId = userRow?.active_bc_connection_id ?? null;
  if (activeConnectionId) {
    const { data: active, error: activeError } = await supabase
      .from("business_central_connections")
      .select("*")
      .eq("id", activeConnectionId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (activeError) {
      throw new Error(
        `Failed to resolve the active Business Central environment: ${activeError.message}`,
      );
    }

    if (active) {
      return active as BusinessCentralConnection;
    }
  }

  // Fall back to the org default.
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
