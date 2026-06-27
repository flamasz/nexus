import type { ItemTemplate } from '@/types/database';
import type { CreateBusinessCentralItemInput } from '@/app/actions/businessCentralItems';

export function templateToCreateInput(
  template: ItemTemplate,
  overrides: { displayName: string; displayName2?: string | null },
): Partial<CreateBusinessCentralItemInput> {
  const out: Partial<CreateBusinessCentralItemInput> = {
    displayName: overrides.displayName,
    type: template.default_type,
    priceIncludesTax: template.price_includes_tax,
  };
  if (overrides.displayName2) out.displayName2 = overrides.displayName2;
  if (template.bc_item_category_code) out.itemCategoryCode = template.bc_item_category_code;
  if (template.base_unit_of_measure_code) out.baseUnitOfMeasureCode = template.base_unit_of_measure_code;
  if (template.tax_group_code) out.taxGroupCode = template.tax_group_code;
  return out;
}
