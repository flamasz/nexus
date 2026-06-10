'use client';

import { useEffect, useState } from 'react';
import { File as FileIcon, FileImage, FileText, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import { iconNameForExtension, extensionOf } from '@/lib/barcodeFiles';
import {
  createBarcodeFile,
  deleteBarcodeFile,
  getBarcodeFiles,
} from '@/app/actions/barcodeFiles';
import { BarcodeDropZone } from './BarcodeDropZone';
import type { BarcodeFile } from '@/types/database';

interface BarcodeUploadsPanelProps {
  bcItemId: string;
  canEdit: boolean;
}

interface UploadingFile {
  id: string;
  name: string;
  status: 'uploading' | 'error';
  error?: string;
}

function FileTypeIcon({ ext }: { ext: string }) {
  const name = iconNameForExtension(ext);
  const className = 'size-5 shrink-0 text-foreground-muted';
  if (name === 'FileImage') return <FileImage className={className} />;
  if (name === 'FileText') return <FileText className={className} />;
  return <FileIcon className={className} />;
}

export function BarcodeUploadsPanel({ bcItemId, canEdit }: BarcodeUploadsPanelProps) {
  const [files, setFiles] = useState<BarcodeFile[] | null>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFiles(null);
    setError(null);
    getBarcodeFiles(bcItemId)
      .then((data) => active && setFiles(data))
      .catch(() => active && setError('Failed to load barcode files.'));
    return () => {
      active = false;
    };
  }, [bcItemId]);

  async function handleFilesSelected(selected: File[]) {
    if (!canEdit) return;
    const batch: UploadingFile[] = selected.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${f.name}`,
      name: f.name,
      status: 'uploading',
    }));
    setUploading((prev) => [...prev, ...batch]);
    const supabase = createClient();

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const entryId = batch[i].id;
      const ext = extensionOf(file.name);
      const storagePath = `barcodes/${bcItemId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('packaging-files')
          .upload(storagePath, file);
        if (uploadError) throw uploadError;
        const created = await createBarcodeFile(bcItemId, {
          name: file.name,
          size: file.size,
          type: ext,
          storagePath,
        });
        setFiles((prev) => (prev ? [created, ...prev] : [created]));
        setUploading((prev) => prev.filter((u) => u.id !== entryId));
      } catch (err) {
        // If the file reached storage but recording the row failed, remove the
        // orphaned object so it does not linger unreferenced in the bucket.
        await supabase.storage.from('packaging-files').remove([storagePath]).catch(() => {});
        setUploading((prev) =>
          prev.map((u) =>
            u.id === entryId
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : u
          )
        );
      }
    }
    setTimeout(() => setUploading((prev) => prev.filter((u) => u.status !== 'error')), 5000);
  }

  async function handleDelete(id: string) {
    if (!canEdit) return;
    const prev = files;
    setFiles((cur) => (cur ? cur.filter((f) => f.id !== id) : cur));
    try {
      await deleteBarcodeFile(id);
    } catch {
      setFiles(prev ?? null);
      setError('Failed to delete file.');
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Barcode files
      </h3>

      {error && (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {files === null ? (
        <div className="flex items-center justify-center py-6 text-foreground-muted">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : files.length === 0 && uploading.length === 0 ? (
        <p className="text-sm text-foreground-subtle">No barcode files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
            >
              <FileTypeIcon ext={file.file_type ?? extensionOf(file.file_name)} />
              <span className="min-w-0 flex-1 break-all text-sm text-foreground">{file.file_name}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(file.id)}
                  title="Delete file"
                  aria-label="Delete file"
                  className="shrink-0 rounded p-1 text-foreground-subtle hover:bg-surface hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
          {uploading.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2"
            >
              {u.status === 'uploading' ? (
                <Loader2 className="size-4 animate-spin text-foreground-muted" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
              <span className="min-w-0 flex-1 break-all text-sm text-foreground-muted">
                {u.name}
                {u.status === 'error' && u.error ? ` — ${u.error}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && <BarcodeDropZone onFilesSelected={handleFilesSelected} />}
    </div>
  );
}
