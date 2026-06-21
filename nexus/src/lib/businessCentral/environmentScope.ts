import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { resolveActiveBcConnection } from '@/lib/businessCentral/activeConnection';

export async function getActiveBusinessCentralScope() {
  const context = await requireOrganizationContext();
  const connection = await resolveActiveBcConnection(context.orgId, context.user.id);

  return {
    ...context,
    connection,
    bcConnectionId: connection?.id ?? null,
  };
}

export async function requireActiveBusinessCentralScope(message = 'Select a Business Central environment first') {
  const scope = await getActiveBusinessCentralScope();
  if (!scope.bcConnectionId) {
    throw new Error(message);
  }
  return scope as typeof scope & { bcConnectionId: string };
}
