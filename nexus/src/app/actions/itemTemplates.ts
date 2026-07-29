'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import type { ItemTemplate } from '@/types/database';

export async function listItemTemplates(): Promise<ItemTemplate[]> {
  const scope = await requireActiveBusinessCentralScope();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('item_templates')
    .select('*')
    .eq('organization_id', scope.orgId)
    .eq('bc_connection_id', scope.bcConnectionId)
    .order('name');
  if (error) throw error;
  return (data ?? []) as ItemTemplate[];
}
