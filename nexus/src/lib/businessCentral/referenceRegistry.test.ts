import { describe, expect, it, vi } from 'vitest';

import { BUSINESS_CENTRAL_REFERENCE_RESOURCES } from './referenceRegistry';
import type { BcClient } from './client';
import type { BusinessCentralReferenceData } from '@/types/businessCentralItems';

const expectedKeys: Array<keyof BusinessCentralReferenceData> = [
  'itemCategories',
  'taxGroups',
  'unitsOfMeasure',
  'generalProductPostingGroups',
  'inventoryPostingGroups',
];

describe('Business Central reference registry', () => {
  it('registers every reference collection exposed to the Items UI', () => {
    expect(BUSINESS_CENTRAL_REFERENCE_RESOURCES.map((resource) => resource.key)).toEqual(expectedKeys);
  });

  it('maps description-backed posting groups into common reference rows', () => {
    const resource = BUSINESS_CENTRAL_REFERENCE_RESOURCES.find(
      (entry) => entry.key === 'generalProductPostingGroups'
    );

    expect(resource?.toDbRow('org-id', {
      id: 'gppg-id',
      code: 'RETAIL',
      description: 'Retail posting group',
      defaultVATProductPostingGroup: 'TAXABLE',
      autoInsertDefault: true,
      lastModifiedDateTime: '2026-04-29T12:00:00Z',
    }, '2026-04-29T13:00:00Z')).toMatchObject({
      organization_id: 'org-id',
      bc_id: 'gppg-id',
      code: 'RETAIL',
      display_name: 'Retail posting group',
      is_active: true,
      default_vat_product_posting_group: 'TAXABLE',
      auto_insert_default: true,
      last_modified_at: '2026-04-29T12:00:00Z',
      last_refreshed_at: '2026-04-29T13:00:00Z',
    });
  });

  it('fetches through each resource descriptor', async () => {
    const client = {
      listItemCategories: vi.fn().mockResolvedValue({ value: [] }),
      listTaxGroups: vi.fn().mockResolvedValue({ value: [] }),
      listUnitsOfMeasure: vi.fn().mockResolvedValue({ value: [] }),
      listGeneralProductPostingGroups: vi.fn().mockResolvedValue({ value: [] }),
      listInventoryPostingGroups: vi.fn().mockResolvedValue({ value: [] }),
    } as unknown as BcClient;

    await Promise.all(BUSINESS_CENTRAL_REFERENCE_RESOURCES.map((resource) => resource.fetch(client)));

    expect(client.listItemCategories).toHaveBeenCalledWith({ top: 100 });
    expect(client.listTaxGroups).toHaveBeenCalledWith({ top: 100 });
    expect(client.listUnitsOfMeasure).toHaveBeenCalledWith({ top: 100 });
    expect(client.listGeneralProductPostingGroups).toHaveBeenCalledWith({ top: 100 });
    expect(client.listInventoryPostingGroups).toHaveBeenCalledWith({ top: 100 });
  });
});
