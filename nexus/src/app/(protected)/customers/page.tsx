import { getCustomersPageData } from '@/app/actions/businessCentralReceivables';
import { CustomersClient } from '@/components/customers/CustomersClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const { customers, canSync } = await getCustomersPageData();
  return <CustomersClient customers={customers} canSync={canSync} />;
}
