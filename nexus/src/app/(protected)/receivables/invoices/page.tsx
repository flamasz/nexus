import { getSalesInvoicesPageData } from '@/app/actions/businessCentralReceivables';
import { SalesInvoicesClient } from '@/components/receivables/SalesInvoicesClient';

export const dynamic = 'force-dynamic';

export default async function SalesInvoicesPage() {
  const { invoices } = await getSalesInvoicesPageData();
  return <SalesInvoicesClient invoices={invoices} />;
}
