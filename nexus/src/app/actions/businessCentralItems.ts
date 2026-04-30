'use server';

import { revalidatePath } from 'next/cache';

import { requireOrganizationContext, requirePermission } from '@/lib/auth/currentUserAccess';
import { ResolvedUserAccess } from '@/lib/auth/permissions';
import { BcApiError, createBcClientFromEnv } from '@/lib/businessCentral/client';
import {
  buildBcCreatePayload,
  buildBcPatchPayload,
  buildItemDetails,
  classifyBcError,
  mapBcItemToDb,
  mapDbItemWithDetailsToUi,
  mapDbSyncEventToUi,
} from '@/lib/businessCentral/itemMapper';
import {
  BUSINESS_CENTRAL_REFERENCE_RESOURCES,
  BusinessCentralReferenceTable,
} from '@/lib/businessCentral/referenceRegistry';
import { createServiceClient } from '@/lib/supabase/server';
import {
  BusinessCentralConnection,
  BusinessCentralItem,
  BusinessCentralItemDetails,
  BusinessCentralItemSyncEvent,
  BusinessCentralReferenceRow,
} from '@/types/database';
import {
  BusinessCentralItemWithDetails,
  BusinessCentralConnectionStatusData,
  BusinessCentralReferenceData,
  BusinessCentralReferenceItem,
  BusinessCentralSyncEvent,
  ConnectionState,
  SyncProgressState,
} from '@/types/businessCentralItems';

const BC_SYNC_PAGE_SIZE = 500;
const MAX_SYNC_PULL_ITEMS = 10_000;

type SupabaseClient = ReturnType<typeof createServiceClient>;

export interface BusinessCentralItemsPageData extends BusinessCentralConnectionStatusData {
  items: BusinessCentralItemWithDetails[];
  events: BusinessCentralSyncEvent[];
  references: BusinessCentralReferenceData;
}

export interface SaveBusinessCentralItemLocalInput {
  itemId: string;
  item: Partial<Pick<BusinessCentralItem, 'display_name' | 'display_name_2' | 'item_category_id' | 'item_category_code' | 'blocked' | 'gtin' | 'unit_price' | 'unit_cost' | 'tax_group_id' | 'tax_group_code' | 'base_unit_of_measure_id' | 'base_unit_of_measure_code' | 'general_product_posting_group_id' | 'general_product_posting_group_code' | 'inventory_posting_group_id' | 'inventory_posting_group_code' | 'price_includes_tax'>>;
  details: Partial<Pick<BusinessCentralItemDetails, 'artwork_status' | 'net_weight_grams' | 'sams_club_item_number' | 'units_per_case' | 'costco_cases_per_layer' | 'costco_layers_per_pallet' | 'sams_cases_per_layer' | 'sams_layers_per_pallet' | 'custom_fields'>>;
}

export interface CreateBusinessCentralItemInput {
  displayName: string;
  displayName2?: string | null;
  number?: string | null;
  type?: string | null;
  itemCategoryId?: string | null;
  itemCategoryCode?: string | null;
  baseUnitOfMeasureId?: string | null;
  baseUnitOfMeasureCode?: string | null;
  taxGroupId?: string | null;
  taxGroupCode?: string | null;
  unitPrice?: number | null;
  priceIncludesTax?: boolean;
  unitCost?: number | null;
  gtin?: string | null;
}

function canViewBusinessCentralItems(access: ResolvedUserAccess): boolean {
  return access.isAdmin || access.canManageCatalog;
}

function canEditBusinessCentralItems(access: ResolvedUserAccess): boolean {
  return access.isAdmin || access.canManageCatalog;
}

function canManageBusinessCentralConnection(access: ResolvedUserAccess): boolean {
  return access.isAdmin;
}

async function requireBcView() {
  return requirePermission(canViewBusinessCentralItems, 'You do not have permission to view Business Central items');
}

async function requireBcEdit() {
  return requirePermission(canEditBusinessCentralItems, 'You do not have permission to edit Business Central items');
}

async function requireBcConnectionManage() {
  return requirePermission(canManageBusinessCentralConnection, 'You do not have permission to manage the Business Central connection');
}

export async function getBusinessCentralItemsPageData(): Promise<BusinessCentralItemsPageData> {
  const { orgId } = await requireBcView();
  const supabase = createServiceClient();
  const connection = await getConnection(supabase, orgId);
  const [items, events, references] = await Promise.all([
    getItemsWithDetails(supabase, orgId),
    getRecentEvents(supabase, orgId),
    getReferenceData(supabase, orgId),
  ]);

  return {
    items,
    events,
    connection: toConnectionState(connection),
    syncProgress: toSyncProgress(connection),
    references,
  };
}


export async function getBusinessCentralConnectionStatus(): Promise<BusinessCentralConnectionStatusData> {
  const { orgId } = await requireOrganizationContext();
  const supabase = createServiceClient();
  const connection = await getConnection(supabase, orgId);

  return {
    connection: toConnectionState(connection),
    syncProgress: toSyncProgress(connection),
  };
}

export async function verifyBusinessCentralConnection(): Promise<void> {
  const { orgId } = await requireBcConnectionManage();
  const supabase = createServiceClient();
  const client = createBcClientFromEnv();
  const now = new Date().toISOString();

  try {
    const company = await client.getCompany();
    await supabase.from('business_central_connections').upsert(
      {
        organization_id: orgId,
        environment: client.config.environment,
        company_id: client.config.companyId,
        company_name: company.displayName || company.name,
        api_base_url: client.config.apiBaseUrl,
        sync_enabled: true,
        last_verified_at: now,
        last_error: null,
        updated_at: now,
      },
      { onConflict: 'organization_id' }
    );
    await recordEvent(supabase, {
      organization_id: orgId,
      direction: 'connection_test',
      status: 'success',
      error_message: 'Business Central connection verified',
      created_at: now,
    });
  } catch (error) {
    await supabase.from('business_central_connections').upsert(
      {
        organization_id: orgId,
        environment: client.config.environment,
        company_id: client.config.companyId,
        api_base_url: client.config.apiBaseUrl,
        sync_enabled: false,
        last_error: error instanceof Error ? error.message : 'Unknown Business Central connection error',
        updated_at: now,
      },
      { onConflict: 'organization_id' }
    );
    await recordFailureEvent(supabase, orgId, 'connection_test', null, error, now);
    throw error;
  }

  revalidatePath('/items');
}

export async function refreshBusinessCentralReferenceData(): Promise<void> {
  const { orgId } = await requireBcEdit();
  const supabase = createServiceClient();
  const connection = await requireConnection(supabase, orgId);
  const now = new Date().toISOString();

  try {
    await refreshReferenceDataForConnection(supabase, orgId, connection, now);
  } catch (error) {
    await recordFailureEvent(supabase, orgId, 'reference_refresh', null, error, now);
    throw error;
  }

  revalidatePath('/items');
}

export async function syncBusinessCentralItems(options: { full?: boolean } = {}): Promise<{ imported: number; skipped: number }> {
  const { orgId, user } = await requireBcEdit();
  const supabase = createServiceClient();
  const connection = await requireConnection(supabase, orgId);
  const now = new Date().toISOString();
  const lockUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  if (connection.sync_in_progress_since && (!connection.sync_in_progress_timeout_at || connection.sync_in_progress_timeout_at > now)) {
    throw new Error(`Sync already in progress by ${connection.sync_in_progress_by ?? 'another user'} since ${connection.sync_in_progress_since}`);
  }

  await supabase
    .from('business_central_connections')
    .update({ sync_in_progress_by: user.id, sync_in_progress_since: now, sync_in_progress_timeout_at: lockUntil, updated_at: now })
    .eq('id', connection.id);

  try {
    await refreshReferenceDataForConnection(supabase, orgId, connection, now);
    const client = createBcClientFromEnv();
    const filter = !options.full && connection.last_pulled_at ? `lastModifiedDateTime gt ${connection.last_pulled_at}` : undefined;
    const response = await client.listAllItems({ pageSize: BC_SYNC_PAGE_SIZE, maxItems: MAX_SYNC_PULL_ITEMS, filter });
    let imported = 0;

    for (const bcItem of response.items) {
      const upsertPayload = mapBcItemToDb({
        organizationId: orgId,
        connectionId: connection.id,
        environment: connection.environment,
        companyId: connection.company_id,
        item: bcItem,
        now,
      });
      const { data: itemRow, error } = await supabase
        .from('business_central_items')
        .upsert(upsertPayload, { onConflict: 'organization_id,bc_company_id,bc_item_id' })
        .select('*')
        .single();
      if (error) throw error;
      await supabase
        .from('business_central_item_details')
        .upsert(buildItemDetails({ itemId: itemRow.id, now }), { onConflict: 'item_id' });
      await recordEvent(supabase, {
        organization_id: orgId,
        item_id: itemRow.id,
        direction: 'pull',
        status: 'success',
        bc_item_id: bcItem.id,
        bc_item_number: bcItem.number,
        changed_fields: ['bc_mirror'],
        after_snapshot: sanitizeSnapshot(upsertPayload),
        created_at: now,
      });
      imported += 1;
    }

    await supabase
      .from('business_central_connections')
      .update({ last_pulled_at: now, last_error: null, sync_in_progress_by: null, sync_in_progress_since: null, sync_in_progress_timeout_at: null, updated_at: now })
      .eq('id', connection.id);

    revalidatePath('/items');
    return { imported, skipped: response.truncated ? 1 : 0 };
  } catch (error) {
    await supabase
      .from('business_central_connections')
      .update({ last_error: error instanceof Error ? error.message : 'Business Central sync failed', sync_in_progress_by: null, sync_in_progress_since: null, sync_in_progress_timeout_at: null, updated_at: now })
      .eq('id', connection.id);
    await recordFailureEvent(supabase, orgId, 'pull', null, error, now);
    throw error;
  }
}

export async function saveBusinessCentralItemLocal(input: SaveBusinessCentralItemLocalInput): Promise<void> {
  const { orgId, user } = await requireBcEdit();
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  await ensureItemBelongsToOrg(supabase, input.itemId, orgId);

  const itemUpdate = {
    ...input.item,
    sync_status: 'local_dirty',
    sync_error: null,
    local_last_edited_at: now,
    local_last_edited_by: user.id,
    updated_by: user.id,
    updated_at: now,
  };
  const detailUpdate = buildItemDetails({
    itemId: input.itemId,
    artworkStatus: input.details.artwork_status,
    netWeightGrams: input.details.net_weight_grams,
    samsClubItemNumber: input.details.sams_club_item_number,
    unitsPerCase: input.details.units_per_case,
    costcoCasesPerLayer: input.details.costco_cases_per_layer,
    costcoLayersPerPallet: input.details.costco_layers_per_pallet,
    samsCasesPerLayer: input.details.sams_cases_per_layer,
    samsLayersPerPallet: input.details.sams_layers_per_pallet,
    customFields: input.details.custom_fields,
    now,
  });

  await supabase.from('business_central_items').update(itemUpdate).eq('id', input.itemId).eq('organization_id', orgId);
  await supabase.from('business_central_item_details').upsert(detailUpdate, { onConflict: 'item_id' });
  await recordEvent(supabase, {
    organization_id: orgId,
    item_id: input.itemId,
    direction: 'push',
    status: 'success',
    actor_user_id: user.id,
    actor_user_label: user.display_name,
    error_message: 'Saved local edits',
    changed_fields: Object.keys(input.item).concat(Object.keys(input.details)),
    created_at: now,
  });

  revalidatePath('/items');
}

export async function markBusinessCentralItemReadyToPush(itemId: string): Promise<void> {
  const { orgId } = await requireBcEdit();
  const supabase = createServiceClient();
  await ensureItemBelongsToOrg(supabase, itemId, orgId);
  await supabase.from('business_central_items').update({ sync_status: 'unpushed', updated_at: new Date().toISOString() }).eq('id', itemId).eq('organization_id', orgId);
  revalidatePath('/items');
}

export async function pushBusinessCentralItem(itemId: string): Promise<BusinessCentralItemWithDetails> {
  const { orgId, user } = await requireBcEdit();
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const row = await getBusinessCentralItemRow(supabase, itemId, orgId);
  const client = createBcClientFromEnv();

  let pushedEntry: BusinessCentralItemWithDetails | null = null;

  try {
    const updated = await client.updateItem(row.bc_item_id, buildBcPatchPayload(row), row.bc_etag ?? '*');
    const { data: updatedRow, error: updateError } = await supabase
      .from('business_central_items')
      .update({
        ...mapBcItemToDb({ organizationId: orgId, connectionId: row.bc_connection_id, environment: row.bc_environment, companyId: row.bc_company_id, item: updated, now }),
        last_pushed_at: now,
        local_last_edited_at: null,
        updated_by: user.id,
      })
      .eq('id', itemId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    pushedEntry = mapDbItemWithDetailsToUi({
      ...(updatedRow as BusinessCentralItem),
      details: await getBusinessCentralItemDetailsRow(supabase, itemId),
    });
    await recordEvent(supabase, {
      organization_id: orgId,
      item_id: itemId,
      direction: 'push',
      status: 'success',
      actor_user_id: user.id,
      actor_user_label: user.display_name,
      bc_item_id: updated.id,
      bc_item_number: updated.number,
      changed_fields: Object.keys(buildBcPatchPayload(row)),
      created_at: now,
    });
  } catch (error) {
    if (classifyBcError(error) === 'stale_etag') {
      pushedEntry = await resolveStalePush(supabase, client, row, orgId, user.id, user.display_name, now);
    } else {
      await markItemFailed(supabase, row, error, 'push', user.id, user.display_name, now);
      throw error;
    }
  }

  if (!pushedEntry) throw new Error('Business Central push completed but Nexus row was not returned');
  revalidatePath('/items');
  return pushedEntry;
}

export async function createBusinessCentralItem(input: CreateBusinessCentralItemInput): Promise<BusinessCentralItemWithDetails> {
  const { orgId, user } = await requireBcEdit();
  const supabase = createServiceClient();
  const connection = await requireConnection(supabase, orgId);
  const now = new Date().toISOString();
  const clientRequestId = crypto.randomUUID();
  const draft: BusinessCentralItem = {
    id: clientRequestId,
    organization_id: orgId,
    bc_connection_id: connection.id,
    bc_environment: connection.environment,
    bc_company_id: connection.company_id,
    bc_item_id: clientRequestId,
    bc_item_number: input.number || null,
    bc_etag: null,
    bc_last_modified_at: null,
    display_name: input.displayName,
    display_name_2: input.displayName2 || null,
    type: input.type || 'Inventory',
    item_category_id: input.itemCategoryId || null,
    item_category_code: input.itemCategoryCode || null,
    base_unit_of_measure_id: input.baseUnitOfMeasureId || null,
    base_unit_of_measure_code: input.baseUnitOfMeasureCode || null,
    unit_price: input.unitPrice ?? null,
    unit_cost: input.unitCost ?? null,
    tax_group_id: input.taxGroupId || null,
    tax_group_code: input.taxGroupCode || null,
    gtin: input.gtin || null,
    inventory: null,
    blocked: false,
    price_includes_tax: input.priceIncludesTax ?? false,
    general_product_posting_group_id: null,
    general_product_posting_group_code: null,
    inventory_posting_group_id: null,
    inventory_posting_group_code: null,
    bc_raw_payload: {},
    sync_status: 'syncing',
    sync_error: null,
    last_synced_at: null,
    last_pulled_at: null,
    last_pushed_at: null,
    local_last_edited_at: null,
    local_last_edited_by: null,
    client_request_id: clientRequestId,
    deleted_in_bc_at: null,
    delete_confirmed_by: null,
    created_by: user.id,
    updated_by: user.id,
    created_at: now,
    updated_at: now,
  };
  let createdEntry: BusinessCentralItemWithDetails | null = null;

  try {
    const client = createBcClientFromEnv();
    const created = await client.createItem(buildBcCreatePayload(draft));
    const createPayload = {
      ...mapBcItemToDb({
        organizationId: orgId,
        connectionId: connection.id,
        environment: connection.environment,
        companyId: connection.company_id,
        item: created,
        now,
      }),
      client_request_id: clientRequestId,
      last_pushed_at: now,
      created_by: user.id,
      updated_by: user.id,
      created_at: now,
    };
    const { data: row, error } = await supabase
      .from('business_central_items')
      .upsert(createPayload, { onConflict: 'organization_id,bc_company_id,bc_item_id' })
      .select('*')
      .single();
    if (error) throw error;
    const details = buildItemDetails({ itemId: row.id, now });
    const { error: detailsError } = await supabase.from('business_central_item_details').upsert(details, { onConflict: 'item_id' });
    if (detailsError) throw detailsError;
    await recordEvent(supabase, {
      organization_id: orgId,
      item_id: row.id,
      direction: 'create',
      status: 'success',
      actor_user_id: user.id,
      actor_user_label: user.display_name,
      bc_item_id: created.id,
      bc_item_number: created.number,
      changed_fields: ['displayName'],
      created_at: now,
    });
    createdEntry = mapDbItemWithDetailsToUi({ ...(row as BusinessCentralItem), details });
  } catch (error) {
    await recordFailureEvent(supabase, orgId, 'create', null, error, now, user.id, user.display_name);
    throw error;
  }

  if (!createdEntry) throw new Error('Business Central item was created but Nexus row was not returned');
  revalidatePath('/items');
  return createdEntry;
}

export async function deleteBusinessCentralItem(itemId: string, confirmation: string): Promise<void> {
  const { orgId, user } = await requireBcEdit();
  const supabase = createServiceClient();
  const row = await getBusinessCentralItemRow(supabase, itemId, orgId);
  const expected = row.bc_item_number ?? row.display_name;
  if (confirmation !== expected) throw new Error('Delete confirmation did not match the BC item number');
  const now = new Date().toISOString();

  try {
    try {
      await createBcClientFromEnv().deleteItem(row.bc_item_id, row.bc_etag ?? '*');
    } catch (error) {
      if (!(error instanceof BcApiError) || error.details.status !== 404) {
        throw error;
      }
    }
    await recordEvent(supabase, {
      organization_id: orgId,
      item_id: itemId,
      direction: 'delete',
      status: 'success',
      actor_user_id: user.id,
      actor_user_label: user.display_name,
      bc_item_id: row.bc_item_id,
      bc_item_number: row.bc_item_number,
      before_snapshot: sanitizeSnapshot(row),
      created_at: now,
    });
    const { error: deleteError } = await supabase
      .from('business_central_items')
      .delete()
      .eq('id', itemId)
      .eq('organization_id', orgId);
    if (deleteError) throw deleteError;
  } catch (error) {
    await markItemFailed(supabase, row, error, 'delete', user.id, user.display_name, now);
    throw error;
  }

  revalidatePath('/items');
}

async function resolveStalePush(
  supabase: SupabaseClient,
  client: ReturnType<typeof createBcClientFromEnv>,
  row: BusinessCentralItem,
  orgId: string,
  userId: string,
  userLabel: string,
  now: string
): Promise<BusinessCentralItemWithDetails> {
  const current = await client.getItem(row.bc_item_id);
  const bcModified = current.lastModifiedDateTime ? Date.parse(current.lastModifiedDateTime) : 0;
  const localModified = row.local_last_edited_at ? Date.parse(row.local_last_edited_at) : 0;

  let resolvedRow: BusinessCentralItem;
  if (localModified >= bcModified) {
    const updated = await client.updateItem(row.bc_item_id, buildBcPatchPayload(row), current['@odata.etag'] ?? '*');
    const { data, error } = await supabase
      .from('business_central_items')
      .update({
        ...mapBcItemToDb({ organizationId: orgId, connectionId: row.bc_connection_id, environment: row.bc_environment, companyId: row.bc_company_id, item: updated, now }),
        last_pushed_at: now,
        local_last_edited_at: null,
      })
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw error;
    resolvedRow = data as BusinessCentralItem;
  } else {
    const { data, error } = await supabase
      .from('business_central_items')
      .update(mapBcItemToDb({ organizationId: orgId, connectionId: row.bc_connection_id, environment: row.bc_environment, companyId: row.bc_company_id, item: current, now }))
      .eq('id', row.id)
      .select('*')
      .single();
    if (error) throw error;
    resolvedRow = data as BusinessCentralItem;
  }

  await recordEvent(supabase, {
    organization_id: orgId,
    item_id: row.id,
    direction: 'push',
    status: 'conflict_resolved',
    actor_user_id: userId,
    actor_user_label: userLabel,
    bc_item_id: row.bc_item_id,
    bc_item_number: row.bc_item_number,
    error_class: 'conflict_resolved',
    error_message: localModified >= bcModified ? 'Conflict resolved in favor of local edit' : 'Conflict resolved in favor of Business Central edit',
    created_at: now,
  });

  return mapDbItemWithDetailsToUi({
    ...resolvedRow,
    details: await getBusinessCentralItemDetailsRow(supabase, row.id),
  });
}

async function getConnection(supabase: SupabaseClient, orgId: string): Promise<BusinessCentralConnection | null> {
  const { data, error } = await supabase.from('business_central_connections').select('*').eq('organization_id', orgId).maybeSingle();
  if (error) throw error;
  return data as BusinessCentralConnection | null;
}

async function requireConnection(supabase: SupabaseClient, orgId: string): Promise<BusinessCentralConnection> {
  const connection = await getConnection(supabase, orgId);
  if (!connection) throw new Error('Business Central is not connected');
  if (!connection.sync_enabled) throw new Error(connection.last_error || 'Business Central sync is disabled');
  return connection;
}

async function refreshReferenceDataForConnection(
  supabase: SupabaseClient,
  orgId: string,
  connection: BusinessCentralConnection,
  now: string
): Promise<void> {
  const client = createBcClientFromEnv();
  const fetchedResources = await Promise.all(
    BUSINESS_CENTRAL_REFERENCE_RESOURCES.map(async (resource) => ({
      resource,
      response: await resource.fetch(client),
    }))
  );

  await Promise.all([
    ...BUSINESS_CENTRAL_REFERENCE_RESOURCES.map((resource) =>
      markReferenceRowsInactive(supabase, resource.table, orgId, now)
    ),
  ]);

  for (const { resource, response } of fetchedResources) {
    if (!response.value.length) continue;
    const { error } = await supabase
      .from(resource.table)
      .upsert(response.value.map((row) => resource.toDbRow(orgId, row, now)), {
        onConflict: 'organization_id,bc_id',
      });
    if (error) throw error;
  }

  await recordEvent(supabase, {
    organization_id: orgId,
    direction: 'reference_refresh',
    status: 'success',
    error_message: 'Reference data refreshed',
    changed_fields: BUSINESS_CENTRAL_REFERENCE_RESOURCES.map((resource) => resource.key),
    created_at: now,
  });
  await supabase.from('business_central_connections').update({ last_error: null, updated_at: now }).eq('id', connection.id);
}

async function markReferenceRowsInactive(
  supabase: SupabaseClient,
  table: BusinessCentralReferenceTable,
  orgId: string,
  now: string
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ is_active: false, updated_at: now })
    .eq('organization_id', orgId);
  if (error) throw error;
}

async function getReferenceData(supabase: SupabaseClient, orgId: string): Promise<BusinessCentralReferenceData> {
  const entries = await Promise.all(
    BUSINESS_CENTRAL_REFERENCE_RESOURCES.map(async (resource) => [
      resource.key,
      await getReferenceRows(supabase, resource.table, orgId),
    ] as const)
  );
  return Object.fromEntries(entries) as unknown as BusinessCentralReferenceData;
}

async function getReferenceRows(
  supabase: SupabaseClient,
  table: BusinessCentralReferenceTable,
  orgId: string
): Promise<BusinessCentralReferenceItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select('bc_id, code, display_name, is_active')
    .eq('organization_id', orgId)
    .order('is_active', { ascending: false })
    .order('code', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Pick<BusinessCentralReferenceRow, 'bc_id' | 'code' | 'display_name' | 'is_active'>[]).map((row) => ({
    bcId: row.bc_id,
    code: row.code,
    displayName: row.display_name,
    isActive: row.is_active,
  }));
}

async function getItemsWithDetails(supabase: SupabaseClient, orgId: string): Promise<BusinessCentralItemWithDetails[]> {
  const { data, error } = await supabase
    .from('business_central_items')
    .select('*, details:business_central_item_details(*)')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<BusinessCentralItem & { details: BusinessCentralItemDetails | null }>).map(mapDbItemWithDetailsToUi);
}

async function getRecentEvents(supabase: SupabaseClient, orgId: string): Promise<BusinessCentralSyncEvent[]> {
  const { data, error } = await supabase
    .from('business_central_item_sync_events')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as BusinessCentralItemSyncEvent[]).map(mapDbSyncEventToUi);
}

async function getBusinessCentralItemRow(supabase: SupabaseClient, itemId: string, orgId: string): Promise<BusinessCentralItem> {
  const { data, error } = await supabase.from('business_central_items').select('*').eq('id', itemId).eq('organization_id', orgId).single();
  if (error) throw error;
  return data as BusinessCentralItem;
}

async function getBusinessCentralItemDetailsRow(supabase: SupabaseClient, itemId: string): Promise<BusinessCentralItemDetails> {
  const { data, error } = await supabase
    .from('business_central_item_details')
    .select('*')
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  return (data as BusinessCentralItemDetails | null) ?? buildItemDetails({ itemId, now: new Date().toISOString() });
}

async function ensureItemBelongsToOrg(supabase: SupabaseClient, itemId: string, orgId: string): Promise<void> {
  await getBusinessCentralItemRow(supabase, itemId, orgId);
}

async function markItemFailed(
  supabase: SupabaseClient,
  row: BusinessCentralItem,
  error: unknown,
  direction: BusinessCentralItemSyncEvent['direction'],
  userId: string,
  userLabel: string,
  now: string
) {
  await supabase
    .from('business_central_items')
    .update({ sync_status: 'failed', sync_error: error instanceof Error ? error.message : 'Business Central request failed', updated_at: now })
    .eq('id', row.id);
  await recordFailureEvent(supabase, row.organization_id, direction, row, error, now, userId, userLabel);
}

async function recordFailureEvent(
  supabase: SupabaseClient,
  organizationId: string,
  direction: BusinessCentralItemSyncEvent['direction'],
  row: BusinessCentralItem | null,
  error: unknown,
  now: string,
  userId?: string,
  userLabel?: string
) {
  await recordEvent(supabase, {
    organization_id: organizationId,
    item_id: row?.id ?? null,
    direction,
    status: 'failed',
    actor_user_id: userId ?? null,
    actor_user_label: userLabel ?? null,
    bc_item_id: row?.bc_item_id ?? null,
    bc_item_number: row?.bc_item_number ?? null,
    error_class: classifyBcError(error),
    error_message: error instanceof Error ? error.message : 'Business Central request failed',
    response_summary: error instanceof BcApiError ? sanitizeSnapshot(error.details) : null,
    created_at: now,
  });
}

async function recordEvent(supabase: SupabaseClient, event: Partial<BusinessCentralItemSyncEvent> & Pick<BusinessCentralItemSyncEvent, 'organization_id' | 'direction' | 'status' | 'created_at'>) {
  const { error } = await supabase.from('business_central_item_sync_events').insert(event);
  if (error) throw error;
}

function toConnectionState(connection: BusinessCentralConnection | null): ConnectionState {
  if (!connection) return { kind: 'not_configured' };
  if (connection.last_error && !connection.sync_enabled) {
    return {
      kind: 'error',
      environment: connection.environment,
      companyId: connection.company_id,
      companyName: connection.company_name,
      lastError: connection.last_error,
      lastVerifiedAt: connection.last_verified_at,
      lastPulledAt: connection.last_pulled_at,
    };
  }
  return {
    kind: 'configured',
    environment: connection.environment,
    companyId: connection.company_id,
    companyName: connection.company_name,
    lastVerifiedAt: connection.last_verified_at,
    lastPulledAt: connection.last_pulled_at,
    syncEnabled: connection.sync_enabled,
    lastError: connection.last_error,
  };
}

function toSyncProgress(connection: BusinessCentralConnection | null): SyncProgressState {
  return {
    inProgress: Boolean(connection?.sync_in_progress_since),
    byUserId: connection?.sync_in_progress_by ?? null,
    byUserLabel: null,
    since: connection?.sync_in_progress_since ?? null,
  };
}

function sanitizeSnapshot(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  return Object.fromEntries(Object.entries(input).filter(([key]) => !/authorization|secret|token/i.test(key)));
}
