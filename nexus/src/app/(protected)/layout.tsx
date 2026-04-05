import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout';
import { getCurrentUser } from '@/app/actions/users';
import { getUserOrganizations } from '@/app/actions/organizations';
import { Organization } from '@/types/database';

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

  return <AppShell user={user} organization={organization} organizations={organizations}>{children}</AppShell>;
}
