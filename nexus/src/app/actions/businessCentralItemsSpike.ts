'use server';

import {
  BcApiError,
  BcClient,
  BcCompany,
  BcItem,
  BcItemCategory,
  BcListResponse,
  BcTaxGroup,
  BcUnitOfMeasure,
  createBcClientForOrg,
} from '@/lib/businessCentral/client';
import { resolveActiveBcConnection } from '@/lib/businessCentral/activeConnection';
import { requirePermission } from '@/lib/auth/currentUserAccess';
import { ResolvedUserAccess } from '@/lib/auth/permissions';

export interface BusinessCentralSpikeResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    status?: number;
    code?: string;
    retryAfter?: string | null;
    requestId?: string | null;
  };
}

export interface BusinessCentralConnectionProbe {
  tokenExpiresAt: string;
  tokenExpiresInSeconds: number;
  company: BcCompany;
}

function canRunBusinessCentralSpike(access: ResolvedUserAccess): boolean {
  // TODO Phase 4: replace canManageCatalog with the dedicated item-manager permission.
  return access.isAdmin || access.canManageCatalog;
}

async function requireSpikeAccess() {
  return requirePermission(canRunBusinessCentralSpike, 'Only admins or catalog managers can run the Business Central integration spike.');
}

async function bcClientForSpike(): Promise<BcClient> {
  const { orgId, user } = await requireSpikeAccess();
  const activeConnection = await resolveActiveBcConnection(orgId, user.id);
  return createBcClientForOrg(orgId, activeConnection?.id);
}

export async function probeBusinessCentralConnection(): Promise<BusinessCentralSpikeResult<BusinessCentralConnectionProbe>> {
  try {
    const client = await bcClientForSpike();
    const [token, company] = await Promise.all([client.getAccessToken(), client.getCompany()]);
    return {
      ok: true,
      data: {
        tokenExpiresAt: new Date(token.expiresAt).toISOString(),
        tokenExpiresInSeconds: token.expiresIn,
        company,
      },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function fetchBusinessCentralCompanies(): Promise<BusinessCentralSpikeResult<BcListResponse<BcCompany>>> {
  try {
    const client = await bcClientForSpike();
    return { ok: true, data: await client.listCompanies() };
  } catch (error) {
    return failure(error);
  }
}

export async function fetchBusinessCentralItemSample(top = 5): Promise<BusinessCentralSpikeResult<BcListResponse<BcItem>>> {
  try {
    const client = await bcClientForSpike();
    return { ok: true, data: await client.listItems({ top: clampTop(top) }) };
  } catch (error) {
    return failure(error);
  }
}

export async function fetchBusinessCentralItemById(itemId: string): Promise<BusinessCentralSpikeResult<BcItem>> {
  try {
    const client = await bcClientForSpike();
    if (!itemId) throw new Error('itemId is required.');
    return { ok: true, data: await client.getItem(itemId) };
  } catch (error) {
    return failure(error);
  }
}

export async function fetchBusinessCentralReferenceSamples(): Promise<BusinessCentralSpikeResult<{
  itemCategories: BcListResponse<BcItemCategory>;
  taxGroups: BcListResponse<BcTaxGroup>;
  unitsOfMeasure: BcListResponse<BcUnitOfMeasure>;
}>> {
  try {
    const client = await bcClientForSpike();
    const [itemCategories, taxGroups, unitsOfMeasure] = await Promise.all([
      client.listItemCategories({ top: 5 }),
      client.listTaxGroups({ top: 5 }),
      client.listUnitsOfMeasure({ top: 5 }),
    ]);
    return { ok: true, data: { itemCategories, taxGroups, unitsOfMeasure } };
  } catch (error) {
    return failure(error);
  }
}

function clampTop(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

function failure(error: unknown): BusinessCentralSpikeResult<never> {
  if (error instanceof BcApiError) {
    return {
      ok: false,
      error: {
        message: error.message,
        status: error.details.status,
        code: error.details.code,
        retryAfter: error.details.retryAfter,
        requestId: error.details.requestId,
      },
    };
  }

  return {
    ok: false,
    error: {
      message: error instanceof Error ? error.message : 'Unknown Business Central spike error.',
    },
  };
}
