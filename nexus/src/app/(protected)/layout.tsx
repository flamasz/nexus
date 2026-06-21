import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout';
import { getCurrentUser } from '@/app/actions/users';
import { getUserOrganizations } from '@/app/actions/organizations';
import { getBusinessCentralConnectionStatus } from '@/app/actions/businessCentralItems';
import { listBcConnections, getBcCredentials } from '@/app/actions/businessCentralConnections';
import { Organization, BusinessCentralConnection } from '@/types/database';
import { BusinessCentralConnectionStatusData } from '@/types/businessCentralItems';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/login');
  }

  const user = await getCurrentUser();
  
  let organization: Organization | null = null;
  if (user?.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', user.organization_id)
      .single();
    organization = data;
  }

  // Fetch all organizations the user belongs to
  const organizations = user ? await getUserOrganizations(user.id) : [];

  let businessCentralStatus: BusinessCentralConnectionStatusData = {
    connection: { kind: 'not_configured' },
    syncProgress: {
      inProgress: false,
      byUserId: null,
      byUserLabel: null,
      since: null,
    },
  };

  let bcConnections: BusinessCentralConnection[] = [];
  let hasBcCredentials = false;

  if (user?.organization_id) {
    try {
      businessCentralStatus = await getBusinessCentralConnectionStatus();
    } catch (error) {
      console.error('Failed to load Business Central connection status:', error);
    }

    try {
      [bcConnections, hasBcCredentials] = await Promise.all([
        listBcConnections(),
        getBcCredentials().then((credentials) => credentials !== null),
      ]);
    } catch (error) {
      console.error('Failed to load Business Central environments:', error);
    }
  }

  return (
    <AppShell
      user={user}
      organization={organization}
      organizations={organizations}
      businessCentralStatus={businessCentralStatus}
      bcConnections={bcConnections}
      activeBcConnectionId={user?.active_bc_connection_id ?? null}
      hasBcCredentials={hasBcCredentials}
    >
      {children}
    </AppShell>
  );
}
