'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import { ItemName } from '@/types/database';

export async function getItemNames(): Promise<ItemName[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('item_names')
    .select('*')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as ItemName[];
}

export async function searchItemNames(search: string): Promise<ItemName[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('item_names')
    .select('*')
    .eq('organization_id', orgId)
    .ilike('name', `%${search}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data || []) as ItemName[];
}

export async function createItemName(name: string): Promise<ItemName> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_names')
    .insert({ name: name.trim(), organization_id: orgId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return data as ItemName;
}

export async function updateItemName(id: string, name: string): Promise<ItemName> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('item_names')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return data as ItemName;
}

export async function deleteItemName(id: string): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage item names');
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('item_name_id', id)
    .eq('organization_id', orgId)
    .limit(1);

  if (items && items.length > 0) {
    throw new Error('Cannot delete item name that is in use by packaging items');
  }

  const { error } = await supabase
    .from('item_names')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
}
