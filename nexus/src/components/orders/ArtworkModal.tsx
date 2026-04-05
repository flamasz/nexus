'use client';

import { useEffect, useState } from 'react';
import { UserAccess } from '@/lib/auth/permissions';
import { createUploadSession, archiveUploadSession, deleteUploadSession, updateUploadSessionNotes, updateUploadSessionStatus } from '@/app/actions/uploads';
import { updateItem } from '@/app/actions/items';
import { DropZone } from '@/components/uploads/DropZone';
import { UploadProgress } from '@/components/uploads/UploadProgress';
import { UploadSessionCard } from '@/components/uploads/UploadSessionCard';
import { CategoryBadge } from '@/components/ui';
import { ItemStatusDropdown } from '@/components/packaging/ItemStatusDropdown';
import { fetchSessionsClient } from '@/lib/utils/fetchSessions';
import { sanitizeFileName } from '@/lib/utils';
import { formatDimensions } from '@/lib/utils/formatDimensions';
import { createClient } from '@/lib/supabase/client';
import { ItemStatus, OrderItemWithDetails, UploadSessionWithDetails, UploadStatus } from '@/types/database';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ArtworkModalProps {
  orderItem: OrderItemWithDetails;
  access: UserAccess;
  onClose: () => void;
}

export function ArtworkModal({ orderItem, access, onClose }: ArtworkModalProps) {
  const [itemsId, setItemsId] = useState<string | null>(null);
  const [itemStatus, setItemStatus] = useState<ItemStatus>('new');
  const [sessions, setSessions] = useState<UploadSessionWithDetails[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showArchivedUploads, setShowArchivedUploads] = useState(false);

  useEffect(() => {
    if (!orderItem.item_name_id || !orderItem.category_id) {
      setSessionsLoading(false);
      return;
    }

    const supabase = createClient();
    let query = supabase
      .from('items')
      .select('id, status')
      .eq('item_name_id', orderItem.item_name_id)
      .eq('category_id', orderItem.category_id);

    if (orderItem.version) {
      query = query.eq('version', orderItem.version);
    } else {
      query = query.is('version', null);
    }

    query.limit(1).then(({ data }) => {
      if (data && data.length > 0) {
        setItemsId(data[0].id);
        setItemStatus((data[0] as { id: string; status: ItemStatus }).status);
      }
      setSessionsLoading(false);
    });
  }, [orderItem.category_id, orderItem.item_name_id, orderItem.version]);

  useEffect(() => {
    if (!itemsId) return;

    fetchSessionsClient(itemsId)
      .then((data) => setSessions(data))
      .catch((error) => console.error('Failed to load sessions:', error));
  }, [itemsId]);

  const handleFilesSelected = async (files: File[]) => {
    if (!itemsId || !access.canUploadArtworkFiles) return;

    const supabase = createClient();
    const uploadingList: UploadingFile[] = files.map((f) => ({ file: f, progress: 0, status: 'pending' }));
    setUploadingFiles(uploadingList);

    const uploadedFiles: { name: string; size: number; type: string; storagePath: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadingFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)));

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const sanitized = sanitizeFileName(file.name);
      const storagePath = `${itemsId}/${Date.now()}_${sanitized}`;

      try {
        const { error } = await supabase.storage.from('packaging-files').upload(storagePath, file);
        if (error) throw error;
        uploadedFiles.push({ name: file.name, size: file.size, type: ext, storagePath });
        setUploadingFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'complete', progress: 100 } : f)));
      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : f
          )
        );
      }
    }

    if (uploadedFiles.length > 0) {
      await createUploadSession(itemsId, uploadedFiles);
      const updatedSessions = await fetchSessionsClient(itemsId);
      setSessions(updatedSessions);
    }

    setTimeout(() => setUploadingFiles([]), 2000);
  };

  const handleStatusChange = async (sessionId: string, status: UploadStatus) => {
    await updateUploadSessionStatus(sessionId, status);
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status } : s)));
  };

  const handleNotesChange = async (sessionId: string, notes: string) => {
    await updateUploadSessionNotes(sessionId, notes);
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, notes } : s)));
  };

  const handleArchive = async (sessionId: string, archived: boolean) => {
    await archiveUploadSession(sessionId, archived);
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, archived } : s)));
  };

  const handleDelete = async (sessionId: string) => {
    await deleteUploadSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-overlay border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                {orderItem.item_name?.name ?? '—'}
              </h2>
              {orderItem.version && (
                <span className="text-lg font-bold text-orange-500">{orderItem.version}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {orderItem.category ? (
                <>
                  <CategoryBadge category={orderItem.category} />
                  <span className="text-sm text-foreground-muted">
                    {formatDimensions(orderItem.category.width, orderItem.category.height, orderItem.category.depth, orderItem.category.unit)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-foreground-subtle italic">No category</span>
              )}
            </div>
            {itemsId && (
              <div className={`mt-2 ${access.canEditArtworkFields ? '' : 'pointer-events-none opacity-70'}`}>
                <ItemStatusDropdown
                  status={itemStatus}
                  onStatusChange={async (newStatus) => {
                    if (!access.canEditArtworkFields) return;
                    await updateItem(itemsId, { status: newStatus });
                    setItemStatus(newStatus);
                  }}
                />
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-foreground-subtle hover:text-foreground rounded-md hover:bg-surface-raised">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!orderItem.item_name_id || !orderItem.category_id ? (
            <p className="text-sm text-foreground-muted text-center py-8">
              Select an item and category first to upload artwork.
            </p>
          ) : !itemsId && !sessionsLoading ? (
            <p className="text-sm text-foreground-muted text-center py-8">
              No PAMS record found for this item + category + version combination.
              Create the item in PAMS first to enable artwork uploads.
            </p>
          ) : (
            <>
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-foreground mb-2">Upload Files</h3>
                {access.canUploadArtworkFiles ? (
                  uploadingFiles.length > 0 ? (
                    <UploadProgress files={uploadingFiles} />
                  ) : (
                    <DropZone onFilesSelected={handleFilesSelected} />
                  )
                ) : (
                  <p className="text-sm text-foreground-muted">You can view artwork history but cannot upload files.</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Upload History</h3>
                  {sessions.some((s) => s.archived) && (
                    <label className="flex items-center gap-1.5 text-xs text-foreground-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showArchivedUploads}
                        onChange={(e) => setShowArchivedUploads(e.target.checked)}
                        className="rounded border-border bg-surface text-primary focus:ring-ring"
                      />
                      Show archived
                    </label>
                  )}
                </div>
                {sessionsLoading ? (
                  <div className="text-center py-6 text-foreground-subtle text-sm">Loading...</div>
                ) : sessions.filter((s) => showArchivedUploads || !s.archived).length === 0 ? (
                  <div className="text-center py-6 text-foreground-subtle text-sm">No uploads yet</div>
                ) : (
                  <div className="space-y-3">
                    {sessions
                      .filter((s) => showArchivedUploads || !s.archived)
                      .map((session) => (
                        <UploadSessionCard
                          key={session.id}
                          session={session}
                          onStatusChange={handleStatusChange}
                          onNotesChange={handleNotesChange}
                          onArchive={handleArchive}
                          onDelete={handleDelete}
                          canEditStatus={access.canEditUploadStatus}
                          canEditNotes={access.canEditUploadNotes}
                          canArchive={access.canArchiveUploadSessions}
                          canDelete={access.canDeleteUploadSessions}
                        />
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
