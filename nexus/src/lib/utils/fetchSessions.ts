import { createClient } from '@/lib/supabase/client';
import { UploadSession, UploadSessionWithDetails, FileRecord, User } from '@/types/database';

export async function fetchSessionsClient(packagingId: string): Promise<UploadSessionWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('upload_sessions')
    .select('*, files(*), uploader:users!uploaded_by(*)')
    .eq('packaging_id', packagingId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  return (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[])
    .map((session) => ({
      ...session,
      files: session.files || [],
      uploader: session.uploader ?? undefined,
    }));
}
