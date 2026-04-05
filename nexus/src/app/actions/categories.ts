'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import { Category, DimensionUnit } from '@/types/database';

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as Category[];
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
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
}): Promise<Category> {
  const { orgId, access } = await requireOrganizationContext();
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
      organization_id: orgId,
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
  }
): Promise<Category> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }

  const supabase = await createClient();
  const { data: category, error } = await supabase
    .from('categories')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return category as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage categories');
  }

  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from('items')
    .update({ category_id: null })
    .eq('category_id', id)
    .eq('organization_id', orgId);

  if (updateError) {
    throw updateError;
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/settings');
}
