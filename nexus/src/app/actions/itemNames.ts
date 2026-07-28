'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusinessCentralScope, requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import { ItemName } from '@/types/database';

export async function getItemNames(): Promise<ItemName[]> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const { data, error } = await supabase
    .from('item_names')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as ItemName[];
}

export async function searchItemNames(search: string): Promise<ItemName[]> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const { data, error } = await supabase
    .from('item_names')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .ilike('name', `%${search}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data || []) as ItemName[];
}

export async function createItemName(name: string): Promise<ItemName> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_names')
    .insert({ name: name.trim(), organization_id: orgId, bc_connection_id: bcConnectionId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return data as ItemName;
}

export async function updateItemName(id: string, name: string): Promise<ItemName> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_names')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return data as ItemName;
}

export async function deleteItemName(id: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('item_name_id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .limit(1);

  if (items && items.length > 0) {
    throw new Error('Cannot delete item name that is in use by packaging items');
  }

  const { error } = await supabase
    .from('item_names')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
}
