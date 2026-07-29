import { Category, ItemTemplate } from '@/types/database';

export interface ItemCategoryRow {
  category: Category;
  template: ItemTemplate | null;
}

export interface CategoryTemplateInput {
  bcItemCategoryCode: string | null;
  defaultType: string;
  baseUnitOfMeasureCode: string | null;
  taxGroupCode: string | null;
  generalProductPostingGroupCode: string | null;
  inventoryPostingGroupCode: string | null;
  priceIncludesTax: boolean;
  blocked: boolean;
}
