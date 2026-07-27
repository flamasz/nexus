import { getAgingPageData } from '@/app/actions/businessCentralReceivables';
import { AgingDashboard } from '@/components/receivables/AgingDashboard';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const { rows, asOfDate } = await getAgingPageData();
  return <AgingDashboard rows={rows} asOfDate={asOfDate} />;
}
