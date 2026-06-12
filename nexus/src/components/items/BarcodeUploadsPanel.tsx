'use client';

import { useEffect, useState } from 'react';
import { Download, File as FileIcon, FileImage, FileText, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import { iconNameForExtension, extensionOf } from '@/lib/barcodeFiles';
import {
  createBarcodeFile,
  deleteBarcodeFile,
  getBarcodeFiles,
} from '@/app/actions/barcodeFiles';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const base = 'size-5 shrink-0';
  // Images (png/jpg/jpeg/svg) read as blue, PDFs as red, and the File fallback
  // (vector formats eps/ai) as orange.
  if (name === 'FileImage') return <FileImage className={`${base} text-blue-500`} />;
  if (name === 'FileText') return <FileText className={`${base} text-red-500`} />;
  return <FileIcon className={`${base} text-orange-500`} />;
}

export function BarcodeUploadsPanel({ bcItemId, canEdit }: BarcodeUploadsPanelProps) {
  const [files, setFiles] = useState<BarcodeFile[] | null>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BarcodeFile | null>(null);

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

  async function handleDownload(file: BarcodeFile) {
    const supabase = createClient();
    const { data, error: downloadError } = await supabase.storage
      .from('packaging-files')
      .download(file.storage_path);
    if (downloadError || !data) {
      setError('Failed to download file.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  title="Download file"
                  aria-label="Download file"
                  className="rounded p-1 text-foreground-subtle hover:bg-surface hover:text-primary"
                >
                  <Download className="size-4" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(file)}
                    title="Delete file"
                    aria-label="Delete file"
                    className="rounded p-1 text-foreground-subtle hover:bg-surface hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
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

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete barcode file</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this barcode file?
            </DialogDescription>
          </DialogHeader>
          {pendingDelete && (
            <p className="text-sm text-foreground-muted">
              <span className="break-all font-medium text-foreground">{pendingDelete.file_name}</span>
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
