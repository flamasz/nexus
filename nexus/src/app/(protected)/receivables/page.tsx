import {
  getAgingPageData,
  getReceivablesSyncStatus,
} from '@/app/actions/businessCentralReceivables';
import { AgingDashboard } from '@/components/receivables/AgingDashboard';

export const dynamic = 'force-dynamic';

export default async function ReceivablesPage() {
  const [{ rows, asOfDate }, syncStatus] = await Promise.all([
    getAgingPageData(),
    getReceivablesSyncStatus(),
  ]);
  return <AgingDashboard rows={rows} asOfDate={asOfDate} syncStatus={syncStatus} />;
}
