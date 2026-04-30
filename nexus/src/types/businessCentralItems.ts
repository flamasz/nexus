export type SyncStatus =
  | 'never_synced'
  | 'synced'
  | 'local_dirty'
  | 'unpushed'
  | 'syncing'
  | 'failed'
  | 'deleted_in_bc';

export type SyncDirection =
  | 'pull'
  | 'push'
  | 'create'
  | 'delete'
  | 'connection_test'
  | 'reference_refresh';

export type SyncEventStatus = 'success' | 'failed' | 'skipped' | 'conflict_resolved';

export type BcErrorClass =
  | 'auth_failed'
  | 'stale_etag'
  | 'not_found'
  | 'throttled'
  | 'server_error'
  | 'validation_error'
  | 'network_error'
  | 'conflict_resolved';

export interface BusinessCentralItem {
  id: string;
  organizationId: string;
  bcConnectionId: string | null;
  bcEnvironment: string;
  bcCompanyId: string;
  bcItemId: string;
  bcItemNumber: string | null;
  bcEtag: string | null;
  bcLastModifiedAt: string | null;
  displayName: string;
  displayName2: string | null;
  type: string | null;
  itemCategoryId: string | null;
  itemCategoryCode: string | null;
  blocked: boolean;
  gtin: string | null;
  unitPrice: number | null;
  priceIncludesTax: boolean;
  unitCost: number | null;
  taxGroupId: string | null;
  taxGroupCode: string | null;
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasureCode: string | null;
  inventory: number | null;
  generalProductPostingGroupId: string | null;
  generalProductPostingGroupCode: string | null;
  inventoryPostingGroupId: string | null;
  inventoryPostingGroupCode: string | null;
  rawPayload: Record<string, unknown>;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  localLastEditedAt: string | null;
  localLastEditedBy: string | null;
  clientRequestId: string | null;
  deletedInBcAt: string | null;
  deleteConfirmedBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessCentralItemDetails {
  itemId: string;
  artworkStatus: string | null;
  netWeightGrams: number | null;
  netWeightOz: number | null;
  samsClubItemNumber: string | null;
  unitsPerCase: number | null;
  costcoCasesPerLayer: number | null;
  costcoLayersPerPallet: number | null;
  costcoUnitsPerPallet: number | null;
  samsCasesPerLayer: number | null;
  samsLayersPerPallet: number | null;
  samsUnitsPerPallet: number | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessCentralItemWithDetails {
  item: BusinessCentralItem;
  details: BusinessCentralItemDetails;
}

export interface BusinessCentralSyncEvent {
  id: string;
  itemId: string | null;
  organizationId: string;
  direction: SyncDirection;
  status: SyncEventStatus;
  actorUserId: string | null;
  actorUserLabel: string | null;
  bcItemId: string | null;
  bcItemNumber: string | null;
  errorClass: BcErrorClass | null;
  errorMessage: string | null;
  changedFields: string[] | null;
  createdAt: string;
}

export type ConnectionState =
  | { kind: 'not_configured' }
  | {
      kind: 'configured';
      environment: string;
      companyId: string;
      companyName: string | null;
      lastVerifiedAt: string | null;
      lastPulledAt: string | null;
      syncEnabled: boolean;
      lastError: string | null;
    }
  | {
      kind: 'error';
      environment: string;
      companyId: string;
      companyName: string | null;
      lastError: string;
      lastVerifiedAt: string | null;
      lastPulledAt: string | null;
    };

export interface SyncProgressState {
  inProgress: boolean;
  byUserId: string | null;
  byUserLabel: string | null;
  since: string | null;
}

export interface BusinessCentralConnectionStatusData {
  connection: ConnectionState;
  syncProgress: SyncProgressState;
}

export interface BusinessCentralReferenceItem {
  bcId: string;
  code: string;
  displayName: string;
  isActive: boolean;
}

export interface BusinessCentralReferenceData {
  itemCategories: BusinessCentralReferenceItem[];
  taxGroups: BusinessCentralReferenceItem[];
  unitsOfMeasure: BusinessCentralReferenceItem[];
  generalProductPostingGroups: BusinessCentralReferenceItem[];
  inventoryPostingGroups: BusinessCentralReferenceItem[];
}
