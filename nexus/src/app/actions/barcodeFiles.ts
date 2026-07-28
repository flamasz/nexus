'use server';

import { revalidatePath } from 'next/cache';
import {
  getActiveBusinessCentralScope,
  requireActiveBusinessCentralScope,
} from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import { BarcodeFile } from '@/types/database';

async function verifyBusinessCentralItemInScope(
  businessCentralItemRowId: string,
  orgId: string,
  bcConnectionId: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_central_items')
    .select('id')
    .eq('id', businessCentralItemRowId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (error || !data) {
    throw new Error('Business Central item not found in the active environment');
  }
}

export async function getBarcodeFiles(
  businessCentralItemRowId: string
): Promise<BarcodeFile[]> {
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('barcode_files')
    .select('*')
    .eq('business_central_item_id', businessCentralItemRowId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as BarcodeFile[];
}

export async function createBarcodeFile(
  businessCentralItemRowId: string,
  file: { name: string; size: number; type: string; storagePath: string }
): Promise<BarcodeFile> {
  const { orgId, bcConnectionId, user } = await requireActiveBusinessCentralScope();
  await verifyBusinessCentralItemInScope(businessCentralItemRowId, orgId, bcConnectionId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('barcode_files')
    .insert({
      business_central_item_id: businessCentralItemRowId,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: file.storagePath,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/items');
  return data as BarcodeFile;
}

export async function deleteBarcodeFile(id: string): Promise<void> {
  const { orgId, bcConnectionId } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from('barcode_files')
    .select('storage_path')
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (fetchError || !row) {
    throw new Error('Barcode file not found in the active environment');
  }

  if (!row.storage_path) {
    throw new Error('Barcode file has no storage path; cannot delete safely');
  }

  const { error: storageError } = await supabase.storage
    .from('packaging-files')
    .remove([row.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from('barcode_files')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) throw error;
  revalidatePath('/items');
}
