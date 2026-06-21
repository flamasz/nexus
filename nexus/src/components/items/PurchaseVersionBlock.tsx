'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveUploadSession,
  createUploadSession,
  deleteUploadSession,
  updateUploadSessionNotes,
  updateUploadSessionStatus,
} from '@/app/actions/uploads';
import { DropZone } from '@/components/uploads/DropZone';
import { UploadProgress } from '@/components/uploads/UploadProgress';
import { UploadSessionCard } from '@/components/uploads/UploadSessionCard';
import { UserAccess } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/client';
import { cn, sanitizeFileName } from '@/lib/utils';
import { fetchSessionsClient } from '@/lib/utils/fetchSessions';
import { PurchaseVersionTarget, UploadSessionWithDetails, UploadStatus } from '@/types/database';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface PurchaseVersionBlockProps {
  target: PurchaseVersionTarget;
  access: UserAccess;
  onEdit?: (target: PurchaseVersionTarget) => void;
}

function isAcceptedArtworkFile(file: File) {
  const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
  return ['.ai', '.pdf'].includes(ext) || ['application/pdf', 'application/illustrator', 'application/postscript'].includes(file.type);
}

export function PurchaseVersionBlock({ target, access, onEdit }: PurchaseVersionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [sessions, setSessions] = useState<UploadSessionWithDetails[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showArchivedUploads, setShowArchivedUploads] = useState(false);
  const [error, setError] = useState('');
  const dragDepthRef = useRef(0);

  const canUpload = access.canUploadArtworkFiles;

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await fetchSessionsClient(target.itemId);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load purchase upload sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load upload history');
    } finally {
      setSessionsLoading(false);
    }
  }, [target.itemId]);

  useEffect(() => {
    if (expanded) {
      void loadSessions();
    }
  }, [expanded, loadSessions]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!canUpload) return;
    const validFiles = files.filter(isAcceptedArtworkFile);
    if (validFiles.length === 0) {
      setError('Only .ai and .pdf files are accepted.');
      return;
    }
    if (validFiles.length !== files.length) {
      setError('Some files were skipped. Only .ai and .pdf files are accepted.');
    } else {
      setError('');
    }

    setExpanded(true);
    const supabase = createClient();
    const uploadingList: UploadingFile[] = validFiles.map((file) => ({ file, progress: 0, status: 'pending' }));
    setUploadingFiles(uploadingList);

    const uploadedFiles: { name: string; size: number; type: string; storagePath: string }[] = [];

    for (let index = 0; index < validFiles.length; index += 1) {
      const file = validFiles[index];
      setUploadingFiles((prev) => prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, status: 'uploading' } : entry
      ));

      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      const storagePath = `${target.itemId}/${Date.now()}_${sanitizeFileName(file.name)}`;

      try {
        const { error: uploadError } = await supabase.storage.from('packaging-files').upload(storagePath, file);
        if (uploadError) throw uploadError;
        uploadedFiles.push({ name: file.name, size: file.size, type: ext, storagePath });
        setUploadingFiles((prev) => prev.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, status: 'complete', progress: 100 } : entry
        ));
      } catch (err) {
        setUploadingFiles((prev) => prev.map((entry, entryIndex) =>
          entryIndex === index
            ? { ...entry, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
            : entry
        ));
      }
    }

    if (uploadedFiles.length > 0) {
      await createUploadSession(target.itemId, uploadedFiles);
      await loadSessions();
    }

    setTimeout(() => setUploadingFiles([]), 2000);
  }, [canUpload, loadSessions, target.itemId]);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (canUpload) setIsDragging(true);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (canUpload) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (!canUpload) return;
    void handleFilesSelected(Array.from(event.dataTransfer.files));
  };

  const visibleSessions = sessions.filter((session) => showArchivedUploads || !session.archived);

  return (
    <section
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        isDragging ? 'border-primary bg-primary-subtle/60 ring-2 ring-primary/20' : 'border-border'
      )}
    >
      <div className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="text-sm font-semibold text-foreground">{target.label}</div>
          <div className="text-xs text-foreground-muted">
            Upload target · {target.status.replace(/_/g, ' ')}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(target)}
              className="rounded p-1.5 text-foreground-subtle transition-colors hover:bg-surface-overlay hover:text-foreground"
              aria-label={`Edit ${target.label}`}
              title="Edit packaging item"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded p-1.5 text-foreground-subtle transition-colors hover:bg-surface-overlay hover:text-foreground"
            aria-label={expanded ? `Collapse ${target.label}` : `Expand ${target.label}`}
          >
            <svg className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-border p-4">
          {error && <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">{error}</div>}

          {canUpload ? (
            uploadingFiles.length > 0 ? (
              <UploadProgress files={uploadingFiles} />
            ) : (
              <DropZone onFilesSelected={handleFilesSelected} />
            )
          ) : (
            <p className="text-sm text-foreground-muted">You can view upload history but cannot upload files.</p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Upload History</h4>
              {sessions.some((session) => session.archived) && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={showArchivedUploads}
                    onChange={(event) => setShowArchivedUploads(event.target.checked)}
                    className="rounded border-border bg-surface text-primary focus:ring-ring"
                  />
                  Show archived
                </label>
              )}
            </div>

            {sessionsLoading ? (
              <div className="py-6 text-center text-sm text-foreground-subtle">Loading...</div>
            ) : visibleSessions.length === 0 ? (
              <div className="py-6 text-center text-sm text-foreground-subtle">No uploads yet</div>
            ) : (
              <div className="space-y-3">
                {visibleSessions.map((session) => (
                  <UploadSessionCard
                    key={session.id}
                    session={session}
                    onStatusChange={async (sessionId: string, status: UploadStatus) => {
                      await updateUploadSessionStatus(sessionId, status);
                      setSessions((prev) => prev.map((entry) => entry.id === sessionId ? { ...entry, status } : entry));
                    }}
                    onNotesChange={async (sessionId: string, notes: string) => {
                      await updateUploadSessionNotes(sessionId, notes);
                      setSessions((prev) => prev.map((entry) => entry.id === sessionId ? { ...entry, notes } : entry));
                    }}
                    onArchive={async (sessionId: string, archived: boolean) => {
                      await archiveUploadSession(sessionId, archived);
                      setSessions((prev) => prev.map((entry) => entry.id === sessionId ? { ...entry, archived } : entry));
                    }}
                    onDelete={async (sessionId: string) => {
                      await deleteUploadSession(sessionId);
                      setSessions((prev) => prev.filter((entry) => entry.id !== sessionId));
                    }}
                    canEditStatus={access.canEditUploadStatus}
                    canEditNotes={access.canEditUploadNotes}
                    canArchive={access.canArchiveUploadSessions}
                    canDelete={access.canDeleteUploadSessions}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
