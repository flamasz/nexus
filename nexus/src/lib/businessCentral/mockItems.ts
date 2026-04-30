import {
  BusinessCentralItemWithDetails,
  BusinessCentralSyncEvent,
  ConnectionState,
  SyncProgressState,
} from '@/types/businessCentralItems';
import { gramsToOunces, unitsPerPallet } from './calculations';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const COMPANY_ID = 'mock-company';
const ENV = 'sandbox';

function buildItem(
  idx: number,
  overrides: Partial<BusinessCentralItemWithDetails['item']> = {},
  detailOverrides: Partial<BusinessCentralItemWithDetails['details']> = {}
): BusinessCentralItemWithDetails {
  const id = `item-${idx.toString().padStart(3, '0')}`;
  const grams = detailOverrides.netWeightGrams ?? 250 + idx * 10;
  const unitsPerCase = detailOverrides.unitsPerCase ?? 12;
  const costcoCpl = detailOverrides.costcoCasesPerLayer ?? 5;
  const costcoLpp = detailOverrides.costcoLayersPerPallet ?? 4;
  const samsCpl = detailOverrides.samsCasesPerLayer ?? 6;
  const samsLpp = detailOverrides.samsLayersPerPallet ?? 3;

  return {
    item: {
      id,
      organizationId: ORG_ID,
      bcConnectionId: null,
      bcEnvironment: ENV,
      bcCompanyId: COMPANY_ID,
      bcItemId: `bc-${id}`,
      bcItemNumber: `ITM-${1000 + idx}`,
      bcEtag: `W/"etag-${idx}"`,
      bcLastModifiedAt: '2026-04-20T12:00:00Z',
      displayName: `Mock Item ${idx}`,
      displayName2: `Mock Item ${idx} subtitle`,
      type: 'Inventory',
      itemCategoryId: 'cat-1',
      itemCategoryCode: 'RETAIL',
      blocked: false,
      gtin: `0000000000${idx}`.slice(-13),
      unitPrice: 9.99,
      priceIncludesTax: false,
      unitCost: 4.25,
      taxGroupId: 'tax-1',
      taxGroupCode: 'NONTAXABLE',
      baseUnitOfMeasureId: 'uom-1',
      baseUnitOfMeasureCode: 'EA',
      inventory: 10 + idx,
      generalProductPostingGroupId: 'gppg-1',
      generalProductPostingGroupCode: 'RETAIL',
      inventoryPostingGroupId: 'ipg-1',
      inventoryPostingGroupCode: 'FINISHED',
      rawPayload: {
        id: `bc-${id}`,
        number: `ITM-${1000 + idx}`,
        displayName: `Mock Item ${idx}`,
        displayName2: `Mock Item ${idx} subtitle`,
        type: 'Inventory',
        itemCategoryId: 'cat-1',
        itemCategoryCode: 'RETAIL',
        blocked: false,
        gtin: `0000000000${idx}`.slice(-13),
        inventory: 10 + idx,
        unitPrice: 9.99,
        priceIncludesTax: false,
        unitCost: 4.25,
        taxGroupId: 'tax-1',
        taxGroupCode: 'NONTAXABLE',
        baseUnitOfMeasureId: 'uom-1',
        baseUnitOfMeasureCode: 'EA',
        generalProductPostingGroupId: 'gppg-1',
        generalProductPostingGroupCode: 'RETAIL',
        inventoryPostingGroupId: 'ipg-1',
        inventoryPostingGroupCode: 'FINISHED',
        lastModifiedDateTime: '2026-04-20T12:00:00Z',
      },
      syncStatus: 'synced',
      syncError: null,
      lastSyncedAt: '2026-04-22T08:00:00Z',
      lastPulledAt: '2026-04-22T08:00:00Z',
      lastPushedAt: null,
      localLastEditedAt: null,
      localLastEditedBy: null,
      clientRequestId: null,
      deletedInBcAt: null,
      deleteConfirmedBy: null,
      createdBy: null,
      updatedBy: null,
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-22T08:00:00Z',
      ...overrides,
    },
    details: {
      itemId: id,
      artworkStatus: 'approved',
      netWeightGrams: grams,
      netWeightOz: gramsToOunces(grams),
      samsClubItemNumber: `SC-${2000 + idx}`,
      unitsPerCase,
      costcoCasesPerLayer: costcoCpl,
      costcoLayersPerPallet: costcoLpp,
      costcoUnitsPerPallet: unitsPerPallet(unitsPerCase, costcoCpl, costcoLpp),
      samsCasesPerLayer: samsCpl,
      samsLayersPerPallet: samsLpp,
      samsUnitsPerPallet: unitsPerPallet(unitsPerCase, samsCpl, samsLpp),
      customFields: {},
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-22T08:00:00Z',
      ...detailOverrides,
    },
  };
}

export const mockItems: BusinessCentralItemWithDetails[] = [
  buildItem(1),
  buildItem(2, { syncStatus: 'local_dirty' }),
  buildItem(3, { syncStatus: 'unpushed', localLastEditedAt: '2026-04-22T09:15:00Z' }),
  buildItem(4, { syncStatus: 'failed', syncError: 'Precondition Failed (stale eTag)' }),
  buildItem(5, { blocked: true }),
];

export const mockSyncEvents: BusinessCentralSyncEvent[] = [
  {
    id: 'evt-1',
    itemId: 'item-001',
    organizationId: ORG_ID,
    direction: 'pull',
    status: 'success',
    actorUserId: null,
    actorUserLabel: 'System',
    bcItemId: 'bc-item-001',
    bcItemNumber: 'ITM-1001',
    errorClass: null,
    errorMessage: null,
    changedFields: ['unitPrice'],
    createdAt: '2026-04-22T08:00:00Z',
  },
  {
    id: 'evt-2',
    itemId: 'item-004',
    organizationId: ORG_ID,
    direction: 'push',
    status: 'failed',
    actorUserId: 'user-1',
    actorUserLabel: 'Alex Admin',
    bcItemId: 'bc-item-004',
    bcItemNumber: 'ITM-1004',
    errorClass: 'stale_etag',
    errorMessage: 'BC item changed since last sync',
    changedFields: ['displayName'],
    createdAt: '2026-04-22T09:30:00Z',
  },
];

export const mockConnectionStates = {
  notConfigured: { kind: 'not_configured' } satisfies ConnectionState,
  configuredOk: {
    kind: 'configured',
    environment: ENV,
    companyId: COMPANY_ID,
    companyName: 'Mock Company',
    lastVerifiedAt: '2026-04-22T08:00:00Z',
    lastPulledAt: '2026-04-22T08:30:00Z',
    syncEnabled: true,
    lastError: null,
  } satisfies ConnectionState,
  errorState: {
    kind: 'error',
    environment: ENV,
    companyId: COMPANY_ID,
    companyName: 'Mock Company',
    lastError: 'Authentication failed (401)',
    lastVerifiedAt: '2026-04-22T07:00:00Z',
    lastPulledAt: null,
  } satisfies ConnectionState,
};

export const mockSyncProgress: SyncProgressState = {
  inProgress: false,
  byUserId: null,
  byUserLabel: null,
  since: null,
};


export const mockReferenceData = {
  itemCategories: [
    { bcId: 'cat-choc', code: 'CHOC-FG', displayName: 'Chocolate Finished Goods', isActive: true },
    { bcId: 'cat-gummy', code: 'GUMMY-FG', displayName: 'Gummy Finished Goods', isActive: true },
  ],
  taxGroups: [
    { bcId: 'tax-taxable', code: 'TAXABLE', displayName: 'Taxable', isActive: true },
    { bcId: 'tax-nontax', code: 'NONTAX', displayName: 'Non-taxable', isActive: true },
  ],
  unitsOfMeasure: [
    { bcId: 'uom-box', code: 'BOX', displayName: 'Box', isActive: true },
    { bcId: 'uom-pouch', code: 'POUCH', displayName: 'Pouch', isActive: true },
    { bcId: 'uom-ea', code: 'EA', displayName: 'Each', isActive: true },
  ],
  generalProductPostingGroups: [
    { bcId: 'gppg-retail', code: 'RETAIL', displayName: 'Retail', isActive: true },
    { bcId: 'gppg-wholesale', code: 'WHOLESALE', displayName: 'Wholesale', isActive: true },
  ],
  inventoryPostingGroups: [
    { bcId: 'ipg-finished', code: 'FINISHED', displayName: 'Finished Goods', isActive: true },
    { bcId: 'ipg-resale', code: 'RESALE', displayName: 'Resale Items', isActive: true },
  ],
};
