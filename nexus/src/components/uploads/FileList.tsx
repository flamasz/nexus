'use client';

import { FileRecord } from '@/types/database';
import { formatFileSize } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface FileListProps {
  files: FileRecord[];
  onDelete?: (fileId: string) => void;
  showDelete?: boolean;
}

export function FileList({ files, onDelete, showDelete = false }: FileListProps) {
  const handleDownload = async (file: FileRecord) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('packaging-files')
      .download(file.storage_path);

    if (error) {
      console.error('Download error:', error);
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
  };

  if (files.length === 0) {
    return (
      <p className="text-sm text-foreground-muted italic">No files uploaded</p>
    );
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex items-center justify-between p-2 bg-surface-raised border border-border rounded-md"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              {file.file_type === '.pdf' ? (
                <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4.5H8.5v-1.75H7V13h1.5zm2.5 0h2.25c.414 0 .75.336.75.75v1.5c0 .414-.336.75-.75.75H12.5v1.5H11V13zm1.5 2.25v-.75h.75v.75h-.75zm3 .75v-.75h.75v.75h-.75zM16 13h2.25c.414 0 .75.336.75.75v3c0 .414-.336.75-.75.75H16V13zm1.5 3v-1.5h.75v1.5h-.75z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM9 13l3 7 3-7h2l-4 9h-2l-4-9h2z"/>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {file.file_name}
              </p>
              <p className="text-xs text-foreground-muted">
                {formatFileSize(file.file_size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload(file)}
              className="p-1.5 text-foreground-subtle hover:text-primary hover:bg-primary-subtle rounded transition-colors"
              title="Download"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showDelete && onDelete && (
              <button
                onClick={() => onDelete(file.id)}
                className="p-1.5 text-foreground-subtle hover:text-destructive hover:bg-destructive-subtle rounded transition-colors"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
