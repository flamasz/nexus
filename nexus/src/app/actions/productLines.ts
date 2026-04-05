'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import { ProductLine } from '@/types/database';

export async function getProductLines(): Promise<ProductLine[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('product_lines')
    .select('*')
    .eq('organization_id', orgId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as ProductLine[];
}

export async function searchProductLines(search: string): Promise<ProductLine[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('product_lines')
    .select('*')
    .eq('organization_id', orgId)
    .ilike('name', `%${search}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return (data || []) as ProductLine[];
}

export async function createProductLine(name: string): Promise<ProductLine> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage product lines');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('product_lines')
    .insert({ name: name.trim(), organization_id: orgId })
    .select()
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  return data as ProductLine;
}

export async function deleteProductLine(id: string): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageCatalog) {
    throw new Error('You do not have permission to manage product lines');
  }

  const supabase = await createClient();
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('product_line_id', id)
    .eq('organization_id', orgId)
    .limit(1);

  if (items && items.length > 0) {
    throw new Error('Cannot delete product line that is in use by packaging items');
  }

  const { error } = await supabase
    .from('product_lines')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
}
