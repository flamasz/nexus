'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import { ItemStatus, ItemWithCategory } from '@/types/database';

export async function getItems(): Promise<ItemWithCategory[]> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('items')
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as ItemWithCategory[];
}

export async function getItem(id: string): Promise<ItemWithCategory | null> {
  const supabase = await createClient();
  const { orgId } = await requireOrganizationContext();

  const { data, error } = await supabase
    .from('items')
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as ItemWithCategory;
}

export async function createItem(data: {
  item_name_id: string;
  category_id: string;
  product_line_id?: string | null;
  version?: string | null;
}): Promise<ItemWithCategory> {
  const { orgId, access, user } = await requireOrganizationContext();
  const canCreateFromDesignerFlow =
    access.canEditDesignerFields && Boolean(data.item_name_id && data.category_id);

  if (!access.canCreatePackagingItems && !canCreateFromDesignerFlow) {
    throw new Error('You do not have permission to create packaging items');
  }

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('items')
    .insert({
      item_name_id: data.item_name_id,
      category_id: data.category_id,
      product_line_id: data.product_line_id || null,
      version: data.version || null,
      created_by: user.id,
      organization_id: orgId,
    })
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
  revalidatePath('/orders');
  return item as ItemWithCategory;
}

export async function updateItem(
  id: string,
  data: {
    item_name_id?: string;
    category_id?: string;
    product_line_id?: string | null;
    version?: string | null;
    status?: ItemStatus;
    archived?: boolean;
  }
): Promise<ItemWithCategory> {
  const { orgId, access } = await requireOrganizationContext();
  const mutatingStatusOnly =
    Object.keys(data).length === 1 && Object.prototype.hasOwnProperty.call(data, 'status');

  if (mutatingStatusOnly) {
    if (!access.canEditDesignerFields) {
      throw new Error('You do not have permission to edit artwork status');
    }
  } else if (!access.canEditPackagingItems) {
    throw new Error('You do not have permission to edit packaging items');
  }

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from('items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .single();

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
  revalidatePath('/orders');
  return item as ItemWithCategory;
}

export async function deleteItem(id: string): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canDeletePackagingItems) {
    throw new Error('You do not have permission to delete packaging items');
  }

  const supabase = await createClient();

  const { data: itemCheck } = await supabase
    .from('items')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single();

  if (!itemCheck) {
    throw new Error('Item not found or access denied');
  }

  const { data: sessions } = await supabase
    .from('upload_sessions')
    .select('id')
    .eq('packaging_id', id);

  if (sessions) {
    for (const session of sessions) {
      const { data: files } = await supabase
        .from('files')
        .select('storage_path')
        .eq('upload_session_id', session.id);

      if (files && files.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('packaging-files')
          .remove(files.map((file) => file.storage_path));

        if (storageError) {
          throw storageError;
        }
      }
    }
  }

  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
  revalidatePath('/orders');
}
