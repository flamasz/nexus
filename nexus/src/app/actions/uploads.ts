'use server';

import { revalidatePath } from 'next/cache';
import { requireOrganizationContext } from '@/lib/auth/currentUserAccess';
import { createClient } from '@/lib/supabase/server';
import { FileRecord, UploadSession, UploadSessionWithDetails, UploadStatus, User } from '@/types/database';

async function verifySessionOwnership(sessionId: string, orgId: string): Promise<void> {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('upload_sessions')
    .select('packaging_id')
    .eq('id', sessionId)
    .single();

  if (!session) {
    throw new Error('Session not found');
  }

  const { data: item } = await supabase
    .from('items')
    .select('id')
    .eq('id', session.packaging_id)
    .eq('organization_id', orgId)
    .single();

  if (!item) {
    throw new Error('Access denied');
  }
}

export async function getUploadSessions(packagingId: string): Promise<UploadSessionWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('upload_sessions')
    .select('*, files(*), uploader:users!uploaded_by(*)')
    .eq('packaging_id', packagingId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[])
    .map((session) => ({
      ...session,
      files: session.files || [],
      uploader: session.uploader ?? undefined,
    }));
}

export async function createUploadSession(
  packagingId: string,
  files: { name: string; size: number; type: string; storagePath: string }[]
): Promise<UploadSession> {
  const { orgId, access, user } = await requireOrganizationContext();
  if (!access.canUploadArtwork) {
    throw new Error('You do not have permission to upload artwork');
  }

  const supabase = await createClient();

  const { data: item } = await supabase
    .from('items')
    .select('id, status')
    .eq('id', packagingId)
    .eq('organization_id', orgId)
    .single();

  if (!item) {
    throw new Error('Packaging item not found or access denied');
  }

  const { data: session, error: sessionError } = await supabase
    .from('upload_sessions')
    .insert({
      packaging_id: packagingId,
      organization_id: orgId,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (sessionError) {
    throw sessionError;
  }

  if (files.length > 0) {
    const { error: filesError } = await supabase
      .from('files')
      .insert(
        files.map((file) => ({
          upload_session_id: session.id,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: file.storagePath,
        }))
      );

    if (filesError) {
      throw filesError;
    }
  }

  const updateData: { updated_at: string; status?: string } = {
    updated_at: new Date().toISOString(),
  };

  if (item.status === 'new') {
    updateData.status = 'in_progress';
  }

  const { error: itemUpdateError } = await supabase
    .from('items')
    .update(updateData)
    .eq('id', packagingId)
    .eq('organization_id', orgId);

  if (itemUpdateError) {
    throw itemUpdateError;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
  return session as UploadSession;
}

export async function updateUploadSessionStatus(
  sessionId: string,
  status: UploadStatus
): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canManageUploadStatus) {
    throw new Error('You do not have permission to update upload status');
  }

  await verifySessionOwnership(sessionId, orgId);
  const supabase = await createClient();

  const { error } = await supabase
    .from('upload_sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
}

export async function updateUploadSessionNotes(
  sessionId: string,
  notes: string
): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canEditUploadNotes) {
    throw new Error('You do not have permission to edit upload notes');
  }

  await verifySessionOwnership(sessionId, orgId);
  const supabase = await createClient();

  const { error } = await supabase
    .from('upload_sessions')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }
}

export async function archiveUploadSession(
  sessionId: string,
  archived: boolean
): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canArchiveUploadSessions) {
    throw new Error('You do not have permission to archive upload sessions');
  }

  await verifySessionOwnership(sessionId, orgId);
  const supabase = await createClient();

  const { error } = await supabase
    .from('upload_sessions')
    .update({ archived, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
}

export async function deleteUploadSession(sessionId: string): Promise<void> {
  const { orgId, access } = await requireOrganizationContext();
  if (!access.canDeleteUploadSessions) {
    throw new Error('You do not have permission to delete upload sessions');
  }

  await verifySessionOwnership(sessionId, orgId);
  const supabase = await createClient();

  const { data: files } = await supabase
    .from('files')
    .select('storage_path')
    .eq('upload_session_id', sessionId);

  if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage
      .from('packaging-files')
      .remove(files.map((file) => file.storage_path));

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase
    .from('upload_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    throw error;
  }

  revalidatePath('/');
  revalidatePath('/artwork');
}
