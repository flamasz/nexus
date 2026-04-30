import type {
  BcClient,
  BcGeneralProductPostingGroup,
  BcInventoryPostingGroup,
  BcItemCategory,
  BcListResponse,
  BcTaxGroup,
  BcUnitOfMeasure,
} from './client';
import { mapReferenceToDb } from './itemMapper';
import type { BusinessCentralReferenceData } from '@/types/businessCentralItems';
import type { BusinessCentralReferenceRow } from '@/types/database';

export type BusinessCentralReferenceTable =
  | 'business_central_item_categories'
  | 'business_central_tax_groups'
  | 'business_central_units_of_measure'
  | 'business_central_general_product_posting_groups'
  | 'business_central_inventory_posting_groups';

type ReferenceExtraColumns = Record<string, unknown>;

type BusinessCentralReferenceSource =
  | BcItemCategory
  | BcTaxGroup
  | BcUnitOfMeasure
  | BcGeneralProductPostingGroup
  | BcInventoryPostingGroup;

export interface BusinessCentralReferenceResource<TReference extends BusinessCentralReferenceSource> {
  key: keyof BusinessCentralReferenceData;
  table: BusinessCentralReferenceTable;
  fetch: (client: BcClient) => Promise<BcListResponse<TReference>>;
  toDbRow: (
    organizationId: string,
    row: TReference,
    now: string,
  ) => Partial<BusinessCentralReferenceRow> & ReferenceExtraColumns;
}

export const BUSINESS_CENTRAL_REFERENCE_RESOURCES = [
  {
    key: 'itemCategories',
    table: 'business_central_item_categories',
    fetch: (client) => client.listItemCategories({ top: 100 }),
    toDbRow: mapReferenceToDb,
  },
  {
    key: 'taxGroups',
    table: 'business_central_tax_groups',
    fetch: (client) => client.listTaxGroups({ top: 100 }),
    toDbRow: (organizationId, row, now) => ({
      ...mapReferenceToDb(organizationId, row, now),
      tax_type: (row as BcTaxGroup).taxType,
    }),
  },
  {
    key: 'unitsOfMeasure',
    table: 'business_central_units_of_measure',
    fetch: (client) => client.listUnitsOfMeasure({ top: 100 }),
    toDbRow: (organizationId, row, now) => ({
      ...mapReferenceToDb(organizationId, row, now),
      international_standard_code: (row as BcUnitOfMeasure).internationalStandardCode || null,
      symbol: (row as BcUnitOfMeasure).symbol || null,
    }),
  },
  {
    key: 'generalProductPostingGroups',
    table: 'business_central_general_product_posting_groups',
    fetch: (client) => client.listGeneralProductPostingGroups({ top: 100 }),
    toDbRow: (organizationId, row, now) => ({
      ...mapReferenceToDb(organizationId, row, now),
      default_vat_product_posting_group: (row as BcGeneralProductPostingGroup).defaultVATProductPostingGroup || null,
      auto_insert_default: (row as BcGeneralProductPostingGroup).autoInsertDefault,
    }),
  },
  {
    key: 'inventoryPostingGroups',
    table: 'business_central_inventory_posting_groups',
    fetch: (client) => client.listInventoryPostingGroups({ top: 100 }),
    toDbRow: mapReferenceToDb,
  },
] as const satisfies readonly BusinessCentralReferenceResource<BusinessCentralReferenceSource>[];
