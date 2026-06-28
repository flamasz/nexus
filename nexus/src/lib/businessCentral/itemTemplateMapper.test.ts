import { describe, expect, it } from 'vitest';
import { templateToCreateInput } from './itemTemplateMapper';
import type { ItemTemplate } from '@/types/database';

const template: ItemTemplate = {
  id: 't1', organization_id: 'o', bc_connection_id: 'c', name: 'Chocolate Bar', description: null,
  category_id: 'cat1', bc_item_category_code: 'FINISHED', default_type: 'Inventory',
  base_unit_of_measure_code: 'PCS', tax_group_code: 'FOOD', general_product_posting_group_code: 'RETAIL',
  inventory_posting_group_code: 'RESALE', price_includes_tax: false, blocked: false, is_active: true,
  created_by: null, updated_by: null, created_at: '', updated_at: '',
};

describe('templateToCreateInput', () => {
  it('maps template defaults plus the per-item display name', () => {
    const result = templateToCreateInput(template, { displayName: 'Dark 70%' });
    expect(result).toMatchObject({
      displayName: 'Dark 70%', type: 'Inventory', itemCategoryCode: 'FINISHED',
      baseUnitOfMeasureCode: 'PCS', taxGroupCode: 'FOOD', priceIncludesTax: false,
      generalProductPostingGroupCode: 'RETAIL', inventoryPostingGroupCode: 'RESALE',
    });
  });
  it('omits null template fields rather than sending empty strings', () => {
    const bare = {
      ...template,
      base_unit_of_measure_code: null,
      tax_group_code: null,
      general_product_posting_group_code: null,
      inventory_posting_group_code: null,
    };
    const result = templateToCreateInput(bare, { displayName: 'X' });
    expect(result.baseUnitOfMeasureCode).toBeUndefined();
    expect(result.taxGroupCode).toBeUndefined();
    expect(result.generalProductPostingGroupCode).toBeUndefined();
    expect(result.inventoryPostingGroupCode).toBeUndefined();
  });
});
