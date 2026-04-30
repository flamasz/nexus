import {
  BusinessCentralItem,
  BusinessCentralItemDetails,
  BusinessCentralItemSyncEvent,
  BusinessCentralReferenceRow,
} from '@/types/database';
import {
  BusinessCentralItem as UiBusinessCentralItem,
  BusinessCentralItemDetails as UiBusinessCentralItemDetails,
  BusinessCentralItemWithDetails,
  BusinessCentralSyncEvent as UiBusinessCentralSyncEvent,
} from '@/types/businessCentralItems';
import { BcErrorClass } from '@/types/businessCentralItems';
import { BcApiError, BcItem, BcItemCreatePayload, BcItemPatchPayload } from './client';
import { gramsToOunces, unitsPerPallet } from './calculations';

export interface BusinessCentralItemUpsertInput {
  organizationId: string;
  connectionId: string | null;
  environment: string;
  companyId: string;
  item: BcItem;
  now: string;
}

export interface BusinessCentralItemDetailInput {
  itemId: string;
  artworkStatus?: string | null;
  netWeightGrams?: number | null;
  samsClubItemNumber?: string | null;
  unitsPerCase?: number | null;
  costcoCasesPerLayer?: number | null;
  costcoLayersPerPallet?: number | null;
  samsCasesPerLayer?: number | null;
  samsLayersPerPallet?: number | null;
  customFields?: Record<string, unknown>;
  now: string;
}

export function mapBcItemToDb(input: BusinessCentralItemUpsertInput): Partial<BusinessCentralItem> {
  const { organizationId, connectionId, environment, companyId, item, now } = input;
  return {
    organization_id: organizationId,
    bc_connection_id: connectionId,
    bc_environment: environment,
    bc_company_id: companyId,
    bc_item_id: item.id,
    bc_item_number: emptyToNull(item.number),
    bc_etag: item['@odata.etag'] ?? null,
    bc_last_modified_at: item.lastModifiedDateTime || null,
    display_name: item.displayName,
    display_name_2: emptyToNull(item.displayName2),
    type: emptyToNull(item.type),
    item_category_id: emptyToNull(item.itemCategoryId),
    item_category_code: emptyToNull(item.itemCategoryCode),
    blocked: item.blocked,
    gtin: emptyToNull(item.gtin),
    inventory: numberOrNull(item.inventory),
    unit_price: numberOrNull(item.unitPrice),
    price_includes_tax: item.priceIncludesTax,
    unit_cost: numberOrNull(item.unitCost),
    tax_group_id: emptyToNull(item.taxGroupId),
    tax_group_code: emptyToNull(item.taxGroupCode),
    base_unit_of_measure_id: emptyToNull(item.baseUnitOfMeasureId),
    base_unit_of_measure_code: emptyToNull(item.baseUnitOfMeasureCode),
    general_product_posting_group_id: emptyToNull(item.generalProductPostingGroupId),
    general_product_posting_group_code: emptyToNull(item.generalProductPostingGroupCode),
    inventory_posting_group_id: emptyToNull(item.inventoryPostingGroupId),
    inventory_posting_group_code: emptyToNull(item.inventoryPostingGroupCode),
    bc_raw_payload: sanitizeBcItemPayload(item),
    sync_status: 'synced',
    sync_error: null,
    last_synced_at: now,
    last_pulled_at: now,
    updated_at: now,
  };
}

export function buildItemDetails(input: BusinessCentralItemDetailInput): BusinessCentralItemDetails {
  const grams = input.netWeightGrams ?? null;
  const unitsPerCase = integerOrNull(input.unitsPerCase);
  const costcoCasesPerLayer = integerOrNull(input.costcoCasesPerLayer);
  const costcoLayersPerPallet = integerOrNull(input.costcoLayersPerPallet);
  const samsCasesPerLayer = integerOrNull(input.samsCasesPerLayer);
  const samsLayersPerPallet = integerOrNull(input.samsLayersPerPallet);

  return {
    item_id: input.itemId,
    artwork_status: input.artworkStatus ?? null,
    net_weight_grams: grams,
    net_weight_oz: gramsToOunces(grams),
    sams_club_item_number: input.samsClubItemNumber ?? null,
    units_per_case: unitsPerCase,
    costco_cases_per_layer: costcoCasesPerLayer,
    costco_layers_per_pallet: costcoLayersPerPallet,
    costco_units_per_pallet: unitsPerPallet(unitsPerCase, costcoCasesPerLayer, costcoLayersPerPallet),
    sams_cases_per_layer: samsCasesPerLayer,
    sams_layers_per_pallet: samsLayersPerPallet,
    sams_units_per_pallet: unitsPerPallet(unitsPerCase, samsCasesPerLayer, samsLayersPerPallet),
    custom_fields: input.customFields ?? {},
    created_at: input.now,
    updated_at: input.now,
  };
}

export function mapDbItemToUi(row: BusinessCentralItem): UiBusinessCentralItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    bcConnectionId: row.bc_connection_id,
    bcEnvironment: row.bc_environment,
    bcCompanyId: row.bc_company_id,
    bcItemId: row.bc_item_id,
    bcItemNumber: row.bc_item_number,
    bcEtag: row.bc_etag,
    bcLastModifiedAt: row.bc_last_modified_at,
    displayName: row.display_name,
    displayName2: row.display_name_2,
    type: row.type,
    itemCategoryId: row.item_category_id,
    itemCategoryCode: row.item_category_code,
    blocked: row.blocked,
    gtin: row.gtin,
    unitPrice: row.unit_price,
    priceIncludesTax: row.price_includes_tax,
    unitCost: row.unit_cost,
    taxGroupId: row.tax_group_id,
    taxGroupCode: row.tax_group_code,
    baseUnitOfMeasureId: row.base_unit_of_measure_id,
    baseUnitOfMeasureCode: row.base_unit_of_measure_code,
    inventory: row.inventory,
    generalProductPostingGroupId: row.general_product_posting_group_id,
    generalProductPostingGroupCode: row.general_product_posting_group_code,
    inventoryPostingGroupId: row.inventory_posting_group_id,
    inventoryPostingGroupCode: row.inventory_posting_group_code,
    rawPayload: row.bc_raw_payload ?? {},
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    lastSyncedAt: row.last_synced_at,
    lastPulledAt: row.last_pulled_at,
    lastPushedAt: row.last_pushed_at,
    localLastEditedAt: row.local_last_edited_at,
    localLastEditedBy: row.local_last_edited_by,
    clientRequestId: row.client_request_id,
    deletedInBcAt: row.deleted_in_bc_at,
    deleteConfirmedBy: row.delete_confirmed_by,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbDetailsToUi(row: BusinessCentralItemDetails): UiBusinessCentralItemDetails {
  return {
    itemId: row.item_id,
    artworkStatus: row.artwork_status,
    netWeightGrams: row.net_weight_grams,
    netWeightOz: row.net_weight_oz,
    samsClubItemNumber: row.sams_club_item_number,
    unitsPerCase: row.units_per_case,
    costcoCasesPerLayer: row.costco_cases_per_layer,
    costcoLayersPerPallet: row.costco_layers_per_pallet,
    costcoUnitsPerPallet: row.costco_units_per_pallet,
    samsCasesPerLayer: row.sams_cases_per_layer,
    samsLayersPerPallet: row.sams_layers_per_pallet,
    samsUnitsPerPallet: row.sams_units_per_pallet,
    customFields: row.custom_fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDbItemWithDetailsToUi(row: BusinessCentralItem & { details: BusinessCentralItemDetails | null }): BusinessCentralItemWithDetails {
  return {
    item: mapDbItemToUi(row),
    details: mapDbDetailsToUi(row.details ?? buildItemDetails({ itemId: row.id, now: row.updated_at })),
  };
}

export function mapDbSyncEventToUi(row: BusinessCentralItemSyncEvent): UiBusinessCentralSyncEvent {
  return {
    id: row.id,
    itemId: row.item_id,
    organizationId: row.organization_id,
    direction: row.direction,
    status: row.status,
    actorUserId: row.actor_user_id,
    actorUserLabel: row.actor_user_label,
    bcItemId: row.bc_item_id,
    bcItemNumber: row.bc_item_number,
    errorClass: row.error_class,
    errorMessage: row.error_message,
    changedFields: row.changed_fields,
    createdAt: row.created_at,
  };
}

export function mapReferenceToDb<T extends { id: string; code: string; displayName?: string; description?: string; lastModifiedDateTime: string }>(
  organizationId: string,
  reference: T,
  now: string
): Partial<BusinessCentralReferenceRow> {
  return {
    organization_id: organizationId,
    bc_id: reference.id,
    code: reference.code,
    display_name: reference.displayName ?? reference.description ?? reference.code,
    is_active: true,
    last_modified_at: reference.lastModifiedDateTime || null,
    last_refreshed_at: now,
    updated_at: now,
  };
}

export function buildBcPatchPayload(item: BusinessCentralItem): BcItemPatchPayload {
  return removeUndefined({
    displayName: item.display_name,
    displayName2: item.display_name_2 ?? undefined,
    ...referencePatch('itemCategory', item.item_category_id, item.item_category_code),
    blocked: item.blocked,
    gtin: item.gtin ?? undefined,
    unitPrice: item.unit_price ?? undefined,
    priceIncludesTax: item.price_includes_tax,
    unitCost: item.unit_cost ?? undefined,
    taxGroupCode: item.tax_group_code ?? undefined,
    ...referencePatch('baseUnitOfMeasure', item.base_unit_of_measure_id, item.base_unit_of_measure_code),
    ...referencePatch('generalProductPostingGroup', item.general_product_posting_group_id, item.general_product_posting_group_code),
    ...referencePatch('inventoryPostingGroup', item.inventory_posting_group_id, item.inventory_posting_group_code),
  });
}

export function buildBcCreatePayload(item: BusinessCentralItem): BcItemCreatePayload {
  const payload = buildBcPatchPayload(item) as BcItemCreatePayload;
  if (item.bc_item_number && item.bc_item_number.length <= 20) {
    payload.number = item.bc_item_number;
  }
  payload.displayName = item.display_name;
  payload.type = item.type ?? 'Inventory';
  return payload;
}

export function classifyBcError(error: unknown): BcErrorClass {
  if (!(error instanceof BcApiError)) return 'network_error';
  const { status, code } = error.details;
  if (status === 0) return 'network_error';
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 404) return 'not_found';
  if (status === 409 && code === 'Request_EntityChanged') return 'stale_etag';
  if (status === 412) return 'stale_etag';
  if (status === 429) return 'throttled';
  if (status >= 500) return 'server_error';
  if (status === 400) return 'validation_error';
  return 'server_error';
}

function referencePatch(
  prefix: 'itemCategory' | 'baseUnitOfMeasure' | 'generalProductPostingGroup' | 'inventoryPostingGroup',
  id: string | null,
  code: string | null
): Record<string, string | undefined> {
  if (id) return { [`${prefix}Id`]: id };
  if (code) return { [`${prefix}Code`]: code };
  return {};
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function sanitizeBcItemPayload(item: BcItem): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).filter(([, value]) => value !== undefined)
  );
}

function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

function numberOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? (value as number) : null;
}

function integerOrNull(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null;
}
