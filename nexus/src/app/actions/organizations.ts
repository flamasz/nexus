'use server';

import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { Organization } from '@/types/database';

function normalizeOrganizationRecord(value: unknown): Organization | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as unknown as Organization | undefined) ?? null;
  }

  return value as unknown as Organization;
}

async function supportsOrgMembers(): Promise<boolean> {
  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from('org_members')
    .select('organization_id')
    .limit(1);

  return !error;
}

export async function getUserOrganizations(userId: string): Promise<Organization[]> {
  const supabase = await createClient();

  if (await supportsOrgMembers()) {
    const { data, error } = await supabase
      .from('org_members')
      .select('organization:organizations(*)')
      .eq('user_id', userId);

    if (!error) {
      return (
        data
          ?.map((row) => normalizeOrganizationRecord(row.organization))
          .filter((organization): organization is Organization => Boolean(organization)) ?? []
      );
    }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization:organizations(*)')
    .eq('id', userId)
    .single();

  const organization = normalizeOrganizationRecord(userRecord?.organization);
  return organization ? [organization] : [];
}

export async function switchOrganization(organizationId: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Not authenticated');
  }

  if (await supportsOrgMembers()) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('organization_id')
      .eq('user_id', authUser.id)
      .eq('organization_id', organizationId)
      .single();

    if (!membership) {
      throw new Error('Not a member of this organization');
    }
  } else {
    const { data: currentUser } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', authUser.id)
      .single();

    if (currentUser?.organization_id !== organizationId) {
      throw new Error('Organization switching is not enabled for this workspace');
    }
  }

  const { error } = await supabase
    .from('users')
    .update({
      organization_id: organizationId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', authUser.id);

  if (error) {
    throw new Error('Failed to switch organization');
  }

  redirect('/dashboard');
}
