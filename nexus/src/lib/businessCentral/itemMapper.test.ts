import { describe, expect, it } from 'vitest';

import { BcApiError, BcItem } from './client';
import {
  buildBcCreatePayload,
  buildBcPatchPayload,
  buildItemDetails,
  classifyBcError,
  mapBcItemToDb,
  mapDbItemToUi,
} from './itemMapper';
import { BusinessCentralItem } from '@/types/database';

const now = '2026-04-25T12:00:00.000Z';
const bcItem: BcItem = {
  id: 'bc-id',
  number: '20000',
  displayName: 'Chocolate Coconut Balls - Box',
  displayName2: '',
  type: 'Inventory',
  itemCategoryId: 'cat-id',
  itemCategoryCode: 'CHOC-FG',
  blocked: false,
  gtin: '197644997855',
  inventory: 3,
  unitPrice: 12.5,
  priceIncludesTax: false,
  unitCost: 4.25,
  taxGroupId: 'tax-id',
  taxGroupCode: 'TAXABLE',
  baseUnitOfMeasureId: 'uom-id',
  baseUnitOfMeasureCode: 'BOX',
  generalProductPostingGroupId: 'gppg-id',
  generalProductPostingGroupCode: 'CHOCOLATE-FG',
  inventoryPostingGroupId: 'ipg-id',
  inventoryPostingGroupCode: 'CHOC-FG',
  lastModifiedDateTime: '2025-03-31T23:26:44.003Z',
  '@odata.etag': 'W/"etag"',
};

describe('itemMapper', () => {
  it('maps BC items to DB mirror rows', () => {
    expect(
      mapBcItemToDb({
        organizationId: 'org-id',
        connectionId: 'connection-id',
        environment: 'TEST',
        companyId: 'company-id',
        item: bcItem,
        now,
      })
    ).toMatchObject({
      organization_id: 'org-id',
      bc_connection_id: 'connection-id',
      bc_environment: 'TEST',
      bc_company_id: 'company-id',
      bc_item_id: 'bc-id',
      bc_item_number: '20000',
      bc_etag: 'W/"etag"',
      display_name: 'Chocolate Coconut Balls - Box',
      item_category_code: 'CHOC-FG',
      tax_group_code: 'TAXABLE',
      base_unit_of_measure_code: 'BOX',
      general_product_posting_group_code: 'CHOCOLATE-FG',
      inventory_posting_group_code: 'CHOC-FG',
      bc_raw_payload: expect.objectContaining({
        id: 'bc-id',
        displayName2: '',
        generalProductPostingGroupId: 'gppg-id',
        inventoryPostingGroupCode: 'CHOC-FG',
      }),
      sync_status: 'synced',
      last_synced_at: now,
      last_pulled_at: now,
    });
  });

  it('maps every mirrored BC item field back to the UI model', () => {
    const uiItem = mapDbItemToUi({
      ...mapBcItemToDb({
        organizationId: 'org-id',
        connectionId: 'connection-id',
        environment: 'TEST',
        companyId: 'company-id',
        item: bcItem,
        now,
      }),
      id: 'row-id',
      organization_id: 'org-id',
      bc_connection_id: 'connection-id',
      bc_environment: 'TEST',
      bc_company_id: 'company-id',
      bc_item_id: 'bc-id',
      display_name: 'Chocolate Coconut Balls - Box',
      blocked: false,
      price_includes_tax: false,
      sync_status: 'synced',
      sync_error: null,
      last_pushed_at: null,
      local_last_edited_at: null,
      local_last_edited_by: null,
      client_request_id: null,
      deleted_in_bc_at: null,
      delete_confirmed_by: null,
      created_by: null,
      updated_by: null,
      created_at: now,
    } as BusinessCentralItem);

    expect(uiItem).toMatchObject({
      displayName2: null,
      inventory: 3,
      generalProductPostingGroupId: 'gppg-id',
      generalProductPostingGroupCode: 'CHOCOLATE-FG',
      inventoryPostingGroupId: 'ipg-id',
      inventoryPostingGroupCode: 'CHOC-FG',
      rawPayload: expect.objectContaining({
        id: 'bc-id',
        lastModifiedDateTime: '2025-03-31T23:26:44.003Z',
      }),
    });
  });

  it('recalculates Nexus-only detail values', () => {
    expect(
      buildItemDetails({
        itemId: 'item-id',
        netWeightGrams: 283.49523125,
        unitsPerCase: 10,
        costcoCasesPerLayer: 2,
        costcoLayersPerPallet: 3,
        samsCasesPerLayer: 4,
        samsLayersPerPallet: 5,
        now,
      })
    ).toMatchObject({
      net_weight_oz: 10,
      costco_units_per_pallet: 60,
      sams_units_per_pallet: 200,
    });
  });

  it('builds PATCH payloads without Nexus-only or read-only fields', () => {
    const item = {
      display_name: 'Updated',
      item_category_code: 'CHOC-FG',
      blocked: true,
      gtin: null,
      unit_price: 10,
      price_includes_tax: false,
      unit_cost: null,
      tax_group_code: 'TAXABLE',
      base_unit_of_measure_code: 'BOX',
      general_product_posting_group_id: 'gppg-id',
      general_product_posting_group_code: 'CHOCOLATE-FG',
      inventory_posting_group_id: null,
      inventory_posting_group_code: 'CHOC-FG',
    } as BusinessCentralItem;

    expect(buildBcPatchPayload(item)).toEqual({
      displayName: 'Updated',
      itemCategoryCode: 'CHOC-FG',
      blocked: true,
      unitPrice: 10,
      priceIncludesTax: false,
      taxGroupCode: 'TAXABLE',
      baseUnitOfMeasureCode: 'BOX',
      generalProductPostingGroupId: 'gppg-id',
      inventoryPostingGroupCode: 'CHOC-FG',
    });
  });

  it('omits explicit create number when it exceeds BC 20 character limit', () => {
    const base = {
      display_name: 'ZZ-TEST-20260425113059',
      bc_item_number: 'ZZ-TEST-20260425113059',
      type: 'Inventory',
      blocked: false,
      price_includes_tax: false,
    } as BusinessCentralItem;

    expect(buildBcCreatePayload(base)).toEqual({
      displayName: 'ZZ-TEST-20260425113059',
      type: 'Inventory',
      blocked: false,
      priceIncludesTax: false,
    });
  });

  it('classifies observed BC stale eTag and delete-extension errors', () => {
    expect(
      classifyBcError(
        new BcApiError({
          status: 409,
          statusText: 'Conflict',
          code: 'Request_EntityChanged',
          message: 'Another user has already changed the record.',
          url: 'test',
        })
      )
    ).toBe('stale_etag');

    expect(
      classifyBcError(
        new BcApiError({ status: 400, statusText: 'Bad Request', code: 'Application_StringExceededLength', url: 'test' })
      )
    ).toBe('validation_error');
  });
});
