import { Suspense } from 'react';
import { getItemCategoriesPageData } from '@/app/actions/itemCategories';
import { ItemCategoriesClient } from '@/components/itemCategories/ItemCategoriesClient';

export const dynamic = 'force-dynamic';

export default async function ItemCategoriesPage() {
  const { rows, canManage } = await getItemCategoriesPageData();
  return (
    <Suspense fallback={<div className="p-6 text-foreground-muted">Loading...</div>}>
      <ItemCategoriesClient rows={rows} canManage={canManage} />
    </Suspense>
  );
}
