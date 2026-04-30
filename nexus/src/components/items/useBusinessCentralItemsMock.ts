'use client';

import { useReducer } from 'react';

import { gramsToOunces, unitsPerPallet } from '@/lib/businessCentral/calculations';
import {
  BusinessCentralItem,
  BusinessCentralItemDetails,
  BusinessCentralItemWithDetails,
  BusinessCentralSyncEvent,
} from '@/types/businessCentralItems';

export const MOCK_ACTOR = { userId: 'prototype-user', label: 'Prototype user' } as const;
export const MOCK_NOW = '2026-04-23T12:00:00Z';

export type EditableItemField =
  | 'displayName'
  | 'displayName2'
  | 'itemCategoryId'
  | 'itemCategoryCode'
  | 'blocked'
  | 'gtin'
  | 'unitPrice'
  | 'priceIncludesTax'
  | 'unitCost'
  | 'taxGroupId'
  | 'taxGroupCode'
  | 'baseUnitOfMeasureId'
  | 'baseUnitOfMeasureCode'
  | 'generalProductPostingGroupId'
  | 'generalProductPostingGroupCode'
  | 'inventoryPostingGroupId'
  | 'inventoryPostingGroupCode';

export type EditableDetailField =
  | 'artworkStatus'
  | 'netWeightGrams'
  | 'samsClubItemNumber'
  | 'unitsPerCase'
  | 'costcoCasesPerLayer'
  | 'costcoLayersPerPallet'
  | 'samsCasesPerLayer'
  | 'samsLayersPerPallet';

export interface BusinessCentralItemsMockState {
  items: BusinessCentralItemWithDetails[];
  events: BusinessCentralSyncEvent[];
  selectedId: string | null;
  conflictItemIds: string[];
  eventCounter: number;
  itemCounter: number;
  now: string;
}

export type BusinessCentralItemsMockAction =
  | { type: 'selectItem'; itemId: string | null }
  | { type: 'editItemField'; itemId: string; field: EditableItemField; value: string | number | boolean | null }
  | { type: 'editDetailField'; itemId: string; field: EditableDetailField; value: string | number | null }
  | { type: 'saveLocal'; itemId: string }
  | { type: 'pushToBc'; itemId: string }
  | { type: 'createItem'; draft: CreateBusinessCentralItemDraft }
  | { type: 'upsertCreatedItem'; entry: BusinessCentralItemWithDetails }
  | { type: 'revertUnsavedItem'; entry: BusinessCentralItemWithDetails }
  | { type: 'resetFromServer'; items: BusinessCentralItemWithDetails[]; events: BusinessCentralSyncEvent[] }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'simulateBcUpdate'; itemId: string };

export interface CreateBusinessCentralItemDraft {
  bcItemNumber: string;
  displayName: string;
  type: string;
  itemCategoryCode: string;
  taxGroupCode: string;
  baseUnitOfMeasureCode: string;
  unitPrice: number | null;
  unitCost: number | null;
  gtin: string | null;
}

export function createInitialBusinessCentralItemsMockState(
  items: BusinessCentralItemWithDetails[],
  events: BusinessCentralSyncEvent[],
  now = MOCK_NOW
): BusinessCentralItemsMockState {
  return {
    items: items.map(cloneEntry),
    events: events.map((event) => ({ ...event, changedFields: event.changedFields ? [...event.changedFields] : event.changedFields })),
    selectedId: items[0]?.item.id ?? null,
    conflictItemIds: [],
    eventCounter: events.length + 1,
    itemCounter: items.length + 1,
    now,
  };
}

export function businessCentralItemsMockReducer(
  state: BusinessCentralItemsMockState,
  action: BusinessCentralItemsMockAction
): BusinessCentralItemsMockState {
  switch (action.type) {
    case 'selectItem':
      return { ...state, selectedId: action.itemId };
    case 'editItemField':
      return updateEntry(state, action.itemId, (entry) => ({
        ...entry,
        item: markDirty({ ...entry.item, [action.field]: action.value }, state.now),
      }));
    case 'editDetailField':
      return updateEntry(state, action.itemId, (entry) => ({
        ...entry,
        item: markDirty(entry.item, state.now),
        details: recalculateDetails({ ...entry.details, [action.field]: action.value }, state.now),
      }));
    case 'saveLocal':
      return withEvent(
        updateEntry(state, action.itemId, (entry) => ({
          ...entry,
          item: {
            ...entry.item,
            syncStatus: 'unpushed',
            syncError: null,
            localLastEditedAt: state.now,
            localLastEditedBy: MOCK_ACTOR.userId,
            updatedAt: state.now,
          },
          details: { ...entry.details, updatedAt: state.now },
        })),
        action.itemId,
        'push',
        'success',
        ['local_save'],
        'Saved local edits'
      );
    case 'pushToBc':
      return withEvent(
        updateEntry(state, action.itemId, (entry) => ({
          ...entry,
          item: {
            ...entry.item,
            syncStatus: 'synced',
            syncError: null,
            lastSyncedAt: state.now,
            lastPushedAt: state.now,
            localLastEditedAt: null,
            clientRequestId: `mock-push-${state.eventCounter}`,
            bcEtag: `W/"mock-${state.eventCounter}"`,
            updatedAt: state.now,
          },
        }), { clearConflict: true }),
        action.itemId,
        'push',
        'success',
        ['bc_fields', 'nexus_details'],
        'Pushed local edits to Business Central'
      );
    case 'createItem': {
      const id = `mock-new-${state.itemCounter.toString().padStart(3, '0')}`;
      const entry = buildCreatedEntry(id, state.itemCounter, action.draft, state.now);
      return withEvent(
        {
          ...state,
          itemCounter: state.itemCounter + 1,
          selectedId: id,
          items: [entry, ...state.items],
        },
        id,
        'create',
        'success',
        ['displayName', 'bcItemNumber'],
        'Created local item draft'
      );
    }
    case 'upsertCreatedItem': {
      const existing = state.items.some(({ item }) => item.id === action.entry.item.id);
      return {
        ...state,
        selectedId: action.entry.item.id,
        items: existing
          ? state.items.map((entry) => (entry.item.id === action.entry.item.id ? cloneEntry(action.entry) : entry))
          : [cloneEntry(action.entry), ...state.items],
      };
    }
    case 'revertUnsavedItem': {
      return {
        ...state,
        selectedId: action.entry.item.id,
        items: state.items.map((entry) => (entry.item.id === action.entry.item.id ? cloneEntry(action.entry) : entry)),
        conflictItemIds: state.conflictItemIds.filter((itemId) => itemId !== action.entry.item.id),
      };
    }
    case 'deleteItem': {
      const remainingItems = state.items.filter(({ item }) => item.id !== action.itemId);
      return withEvent(
        {
          ...state,
          items: remainingItems,
          selectedId: state.selectedId === action.itemId ? (remainingItems[0]?.item.id ?? null) : state.selectedId,
          conflictItemIds: state.conflictItemIds.filter((id) => id !== action.itemId),
        },
        action.itemId,
        'delete',
        'success',
        ['deletedInBcAt'],
        'Deleted item from Business Central and Nexus'
      );
    }
    case 'simulateBcUpdate':
      if (state.conflictItemIds.includes(action.itemId)) return state;
      return withEvent(
        {
          ...state,
          conflictItemIds: [...state.conflictItemIds, action.itemId],
        },
        action.itemId,
        'pull',
        'skipped',
        ['bcLastModifiedAt'],
        'Business Central changed while local edits are pending'
      );
    default:
      return state;
  }
}

export function useBusinessCentralItemsMock(
  items: BusinessCentralItemWithDetails[],
  events: BusinessCentralSyncEvent[]
) {
  return useReducer(
    businessCentralItemsMockReducer,
    undefined,
    () => createInitialBusinessCentralItemsMockState(items, events)
  );
}

function updateEntry(
  state: BusinessCentralItemsMockState,
  itemId: string,
  update: (entry: BusinessCentralItemWithDetails) => BusinessCentralItemWithDetails,
  options: { clearConflict?: boolean } = {}
): BusinessCentralItemsMockState {
  return {
    ...state,
    conflictItemIds: options.clearConflict
      ? state.conflictItemIds.filter((id) => id !== itemId)
      : state.conflictItemIds,
    items: state.items.map((entry) => (entry.item.id === itemId ? update(cloneEntry(entry)) : entry)),
  };
}

function withEvent(
  state: BusinessCentralItemsMockState,
  itemId: string,
  direction: BusinessCentralSyncEvent['direction'],
  status: BusinessCentralSyncEvent['status'],
  changedFields: string[],
  message: string
): BusinessCentralItemsMockState {
  const entry = state.items.find(({ item }) => item.id === itemId);
  const event: BusinessCentralSyncEvent = {
    id: `mock-event-${state.eventCounter}`,
    itemId,
    organizationId: entry?.item.organizationId ?? 'mock-org',
    direction,
    status,
    actorUserId: MOCK_ACTOR.userId,
    actorUserLabel: MOCK_ACTOR.label,
    bcItemId: entry?.item.bcItemId ?? null,
    bcItemNumber: entry?.item.bcItemNumber ?? null,
    errorClass: null,
    errorMessage: message,
    changedFields,
    createdAt: state.now,
  };

  return {
    ...state,
    eventCounter: state.eventCounter + 1,
    events: [event, ...state.events],
  };
}

function markDirty(item: BusinessCentralItem, now: string): BusinessCentralItem {
  return {
    ...item,
    syncStatus: 'local_dirty',
    syncError: null,
    localLastEditedAt: now,
    localLastEditedBy: MOCK_ACTOR.userId,
    updatedAt: now,
  };
}

function recalculateDetails(
  details: BusinessCentralItemDetails,
  now: string
): BusinessCentralItemDetails {
  return {
    ...details,
    netWeightOz: gramsToOunces(details.netWeightGrams),
    costcoUnitsPerPallet: unitsPerPallet(
      details.unitsPerCase,
      details.costcoCasesPerLayer,
      details.costcoLayersPerPallet
    ),
    samsUnitsPerPallet: unitsPerPallet(
      details.unitsPerCase,
      details.samsCasesPerLayer,
      details.samsLayersPerPallet
    ),
    updatedAt: now,
  };
}

function buildCreatedEntry(
  id: string,
  index: number,
  draft: CreateBusinessCentralItemDraft,
  now: string
): BusinessCentralItemWithDetails {
  return {
    item: {
      id,
      organizationId: '00000000-0000-0000-0000-000000000001',
      bcConnectionId: null,
      bcEnvironment: 'sandbox',
      bcCompanyId: 'mock-company',
      bcItemId: `bc-${id}`,
      bcItemNumber: draft.bcItemNumber,
      bcEtag: null,
      bcLastModifiedAt: null,
      displayName: draft.displayName,
      displayName2: null,
      type: draft.type || 'Inventory',
      itemCategoryId: null,
      itemCategoryCode: draft.itemCategoryCode || null,
      blocked: false,
      gtin: draft.gtin,
      unitPrice: draft.unitPrice,
      priceIncludesTax: false,
      unitCost: draft.unitCost,
      taxGroupId: null,
      taxGroupCode: draft.taxGroupCode || null,
      baseUnitOfMeasureId: null,
      baseUnitOfMeasureCode: draft.baseUnitOfMeasureCode || null,
      inventory: null,
      generalProductPostingGroupId: null,
      generalProductPostingGroupCode: null,
      inventoryPostingGroupId: null,
      inventoryPostingGroupCode: null,
      rawPayload: {},
      syncStatus: 'never_synced',
      syncError: null,
      lastSyncedAt: null,
      lastPulledAt: null,
      lastPushedAt: null,
      localLastEditedAt: now,
      localLastEditedBy: MOCK_ACTOR.userId,
      clientRequestId: `mock-create-${index}`,
      deletedInBcAt: null,
      deleteConfirmedBy: null,
      createdBy: MOCK_ACTOR.userId,
      updatedBy: MOCK_ACTOR.userId,
      createdAt: now,
      updatedAt: now,
    },
    details: recalculateDetails(
      {
        itemId: id,
        artworkStatus: null,
        netWeightGrams: null,
        netWeightOz: null,
        samsClubItemNumber: null,
        unitsPerCase: null,
        costcoCasesPerLayer: null,
        costcoLayersPerPallet: null,
        costcoUnitsPerPallet: null,
        samsCasesPerLayer: null,
        samsLayersPerPallet: null,
        samsUnitsPerPallet: null,
        customFields: {},
        createdAt: now,
        updatedAt: now,
      },
      now
    ),
  };
}

function cloneEntry(entry: BusinessCentralItemWithDetails): BusinessCentralItemWithDetails {
  return {
    item: { ...entry.item },
    details: { ...entry.details, customFields: { ...entry.details.customFields } },
  };
}
