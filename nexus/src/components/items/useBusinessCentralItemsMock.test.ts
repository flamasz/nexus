import { describe, expect, it } from 'vitest';

import { mockItems, mockSyncEvents } from '@/lib/businessCentral/mockItems';
import {
  businessCentralItemsMockReducer,
  createInitialBusinessCentralItemsMockState,
} from './useBusinessCentralItemsMock';

const NOW = '2026-04-23T12:00:00Z';

function itemStatus(state: ReturnType<typeof createInitialBusinessCentralItemsMockState>, itemId: string) {
  return state.items.find(({ item }) => item.id === itemId)?.item.syncStatus;
}

describe('businessCentralItemsMockReducer', () => {
  it('saveLocal flips dirty edits to unpushed and appends an event', () => {
    const initial = createInitialBusinessCentralItemsMockState(mockItems, mockSyncEvents, NOW);
    const dirty = businessCentralItemsMockReducer(initial, {
      type: 'editItemField',
      itemId: 'item-001',
      field: 'displayName',
      value: 'Edited item',
    });

    expect(itemStatus(dirty, 'item-001')).toBe('local_dirty');

    const saved = businessCentralItemsMockReducer(dirty, { type: 'saveLocal', itemId: 'item-001' });

    expect(itemStatus(saved, 'item-001')).toBe('unpushed');
    expect(saved.events[0]).toMatchObject({
      itemId: 'item-001',
      direction: 'push',
      status: 'success',
      errorMessage: 'Saved local edits',
      createdAt: NOW,
    });
  });

  it('pushToBc flips unpushed to synced and appends a success event', () => {
    const initial = createInitialBusinessCentralItemsMockState(mockItems, mockSyncEvents, NOW);
    const pushed = businessCentralItemsMockReducer(initial, { type: 'pushToBc', itemId: 'item-003' });
    const item = pushed.items.find((entry) => entry.item.id === 'item-003')?.item;

    expect(item?.syncStatus).toBe('synced');
    expect(item?.lastPushedAt).toBe(NOW);
    expect(item?.lastSyncedAt).toBe(NOW);
    expect(pushed.events[0]).toMatchObject({
      itemId: 'item-003',
      direction: 'push',
      status: 'success',
      errorMessage: 'Pushed local edits to Business Central',
    });
  });


  it('revertUnsavedItem restores the saved server row', () => {
    const initial = createInitialBusinessCentralItemsMockState(mockItems, mockSyncEvents, NOW);
    const edited = businessCentralItemsMockReducer(initial, {
      type: 'editItemField',
      itemId: 'item-001',
      field: 'displayName',
      value: 'Temporary edit',
    });
    const reverted = businessCentralItemsMockReducer(edited, {
      type: 'revertUnsavedItem',
      entry: mockItems[0],
    });
    const item = reverted.items.find((entry) => entry.item.id === 'item-001')?.item;

    expect(item?.displayName).toBe(mockItems[0].item.displayName);
    expect(item?.syncStatus).toBe(mockItems[0].item.syncStatus);
  });

  it('deleteItem removes the item from the Nexus list after BC deletion', () => {
    const initial = createInitialBusinessCentralItemsMockState(mockItems, mockSyncEvents, NOW);
    const deleted = businessCentralItemsMockReducer(initial, { type: 'deleteItem', itemId: 'item-002' });
    const item = deleted.items.find((entry) => entry.item.id === 'item-002')?.item;

    expect(deleted.items).toHaveLength(initial.items.length - 1);
    expect(item).toBeUndefined();
    expect(deleted.events[0]).toMatchObject({
      itemId: 'item-002',
      direction: 'delete',
      status: 'success',
      errorMessage: 'Deleted item from Business Central and Nexus',
    });
  });
});
