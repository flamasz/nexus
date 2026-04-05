import { createClient } from '@/lib/supabase/server';
import { User } from '@/types/database';
import { resolveUserAccess, ResolvedUserAccess } from './permissions';

export interface CurrentUserAccessContext {
  user: User;
  access: ResolvedUserAccess;
}

export async function getCurrentUserAccessContext(): Promise<CurrentUserAccessContext | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !data) {
    if (error) {
      console.error('Error fetching current user access context:', error);
    }
    return null;
  }

  return {
    user: data,
    access: resolveUserAccess(data),
  };
}

export async function requireCurrentUserAccessContext(): Promise<CurrentUserAccessContext> {
  const context = await getCurrentUserAccessContext();
  if (!context) {
    throw new Error('Not authenticated');
  }

  return context;
}

export async function requireOrganizationContext(): Promise<CurrentUserAccessContext & { orgId: string }> {
  const context = await requireCurrentUserAccessContext();
  if (!context.user.organization_id) {
    throw new Error('No organization found');
  }

  return {
    ...context,
    orgId: context.user.organization_id,
  };
}

export async function requirePermission(
  predicate: (access: ResolvedUserAccess) => boolean,
  message = 'Unauthorized'
): Promise<CurrentUserAccessContext & { orgId: string }> {
  const context = await requireOrganizationContext();
  if (!predicate(context.access)) {
    throw new Error(message);
  }

  return context;
}
