'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusinessCentralScope, requireActiveBusinessCentralScope } from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import { Category, DimensionUnit } from '@/types/database';

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await createClient();
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return null;

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as Category;
}

export async function createCategory(data: {
  name: string;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  unit: DimensionUnit;
  color?: string;
  bcNoSeriesCode?: string | null;
}): Promise<Category> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from('categories')
    .insert({
      name: data.name,
      width: data.width ?? null,
      height: data.height ?? null,
      depth: data.depth ?? null,
      unit: data.unit,
      color: data.color || null,
      bc_no_series_code: data.bcNoSeriesCode ?? null,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return category as Category;
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    width?: number | null;
    height?: number | null;
    depth?: number | null;
    unit?: DimensionUnit;
    color?: string;
    bcNoSeriesCode?: string | null;
  }
): Promise<Category> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }

  const supabase = await createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.width !== undefined) updates.width = data.width;
  if (data.height !== undefined) updates.height = data.height;
  if (data.depth !== undefined) updates.depth = data.depth;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.color !== undefined) updates.color = data.color || null;
  if (data.bcNoSeriesCode !== undefined) {
    updates.bc_no_series_code = data.bcNoSeriesCode || null;
  }

  const { data: category, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return category as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { orgId, bcConnectionId, access } = await requireActiveBusinessCentralScope();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from('items')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (updateError) {
    throw updateError;
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/settings');
}
