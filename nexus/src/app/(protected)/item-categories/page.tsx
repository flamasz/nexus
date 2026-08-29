import { Suspense } from 'react';
import { getItemCategoriesPageData } from '@/app/actions/itemCategories';
import { getBusinessCentralReferenceData } from '@/app/actions/businessCentralItems';
import { ItemCategoriesClient } from '@/components/itemCategories/ItemCategoriesClient';
import type { BusinessCentralReferenceData } from '@/types/businessCentralItems';

export const dynamic = 'force-dynamic';

export default async function ItemCategoriesPage() {
  const { rows, canManage } = await getItemCategoriesPageData();

  // Reference data is only needed for editing (the dropdowns are disabled/inert for
  // read-only viewers), and fetching it requires the same manage-catalog permission
  // that gates editing here, so skip it entirely for viewers to avoid an avoidable
  // permission error crashing the whole page. Also tolerate a failed BC fetch (e.g. no
  // active connection) by falling back to null, which the block treats as "use text inputs".
  let references: BusinessCentralReferenceData | null = null;
  if (canManage) {
    try {
      references = await getBusinessCentralReferenceData();
    } catch {
      references = null;
    }
  }

  return (
    <Suspense fallback={<div className="p-6 text-foreground-muted">Loading...</div>}>
      <ItemCategoriesClient rows={rows} canManage={canManage} references={references} />
    </Suspense>
  );
}
