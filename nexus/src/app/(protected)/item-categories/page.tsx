import { getItemCategoriesPageData } from '@/app/actions/itemCategories';
import { ItemCategoriesClient } from '@/components/itemCategories/ItemCategoriesClient';

export const dynamic = 'force-dynamic';

export default async function ItemCategoriesPage() {
  const { rows, canManage } = await getItemCategoriesPageData();
  return <ItemCategoriesClient rows={rows} canManage={canManage} />;
}
