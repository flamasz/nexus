'use client';

import { useCallback, useRef, useState } from 'react';
import { formatHSTShort } from '@/lib/utils';
import { UploadSessionWithDetails, UploadStatus } from '@/types/database';
import { FileList } from './FileList';
import { StatusBadge } from './StatusBadge';

interface UploadSessionCardProps {
  session: UploadSessionWithDetails;
  onStatusChange: (sessionId: string, status: UploadStatus) => Promise<void>;
  onNotesChange: (sessionId: string, notes: string) => Promise<void>;
  onArchive: (sessionId: string, archived: boolean) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
  canEditStatus: boolean;
  canEditNotes: boolean;
  canArchive: boolean;
  canDelete: boolean;
}

function NotesEditor({
  initialValue,
  onSave,
  disabled,
}: {
  initialValue: string;
  onSave: (notes: string) => Promise<void>;
  disabled: boolean;
}) {
  const [notes, setNotes] = useState(initialValue);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const savedValueRef = useRef(initialValue);

  const debouncedSave = useCallback(
    (value: string) => {
      if (disabled) return;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (value === savedValueRef.current) {
        setSaveStatus('idle');
        return;
      }

      setSaveStatus('saving');
      debounceRef.current = setTimeout(async () => {
        try {
          await onSave(value);
          savedValueRef.current = value;
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('idle');
        }
      }, 1000);
    },
    [disabled, onSave]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-foreground">Notes</h4>
        {saveStatus !== 'idle' && !disabled && (
          <span className="text-xs text-foreground-muted">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          const value = e.target.value;
          setNotes(value);
          debouncedSave(value);
        }}
        placeholder="Add notes about this upload..."
        rows={3}
        readOnly={disabled}
        className="w-full px-3 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none read-only:cursor-default read-only:opacity-70"
      />
    </div>
  );
}

export function UploadSessionCard({
  session,
  onStatusChange,
  onNotesChange,
  onArchive,
  onDelete,
  canEditStatus,
  canEditNotes,
  canArchive,
  canDelete,
}: UploadSessionCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleNotesChange = useCallback(
    async (notes: string) => {
      await onNotesChange(session.id, notes);
    },
    [session.id, onNotesChange]
  );

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!canEditStatus) return;
    const newStatus = e.target.value as UploadStatus;
    await onStatusChange(session.id, newStatus);
  };

  const handleArchive = async () => {
    if (!canArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(session.id, !session.archived);
    } catch {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    if (!confirm('Are you sure you want to delete this upload session? This will also delete all associated files.')) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(session.id);
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <div className={`bg-surface border border-border rounded-lg shadow-sm overflow-hidden ${session.archived ? 'opacity-60' : ''}`}>
      <div className="p-4 border-b border-border bg-surface-raised">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={session.status} />
              {session.archived && (
                <span className="text-xs px-1.5 py-0.5 bg-surface-overlay text-foreground-muted rounded">
                  Archived
                </span>
              )}
              <select
                value={session.status}
                onChange={handleStatusChange}
                disabled={!canEditStatus}
                className="text-xs border border-border rounded px-2 py-1 bg-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:cursor-default"
              >
                <option value="uploaded">Uploaded</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <p className="text-sm text-foreground-muted">
              Uploaded by {session.uploader?.display_name || 'Unknown'} on{' '}
              {formatHSTShort(session.uploaded_at)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {canArchive && (
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="p-1.5 text-foreground-subtle hover:text-foreground hover:bg-surface-raised rounded transition-colors disabled:opacity-50"
                title={session.archived ? 'Unarchive' : 'Archive'}
              >
                {session.archived ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4l3 3m0 0l3-3m-3 3V9" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                )}
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-foreground-subtle hover:text-destructive hover:bg-destructive-subtle rounded transition-colors disabled:opacity-50"
                title="Delete upload session"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Files</h4>
          <FileList files={session.files} />
        </div>

        <NotesEditor
          key={session.id}
          initialValue={session.notes || ''}
          onSave={handleNotesChange}
          disabled={!canEditNotes}
        />
      </div>
    </div>
  );
}
