'use client';

import { formatFileSize } from '@/lib/utils';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface UploadProgressProps {
  files: UploadFile[];
  onCancel?: () => void;
}

export function UploadProgress({ files, onCancel }: UploadProgressProps) {
  const totalProgress = files.length > 0
    ? files.reduce((sum, f) => sum + f.progress, 0) / files.length
    : 0;

  const allComplete = files.every((f) => f.status === 'complete');
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <div className="bg-primary-subtle border border-primary/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-primary">
          {allComplete
            ? 'Upload Complete'
            : hasErrors
            ? 'Upload Error'
            : 'Uploading Files...'}
        </h4>
        {!allComplete && onCancel && (
          <button
            onClick={onCancel}
            className="text-sm text-primary hover:text-primary-hover"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-sm text-primary mb-1">
          <span>Overall Progress</span>
          <span>{Math.round(totalProgress)}%</span>
        </div>
        <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {files.map((file, index) => (
          <li key={index} className="flex items-center gap-3 text-sm">
            <div className="flex-shrink-0">
              {file.status === 'complete' ? (
                <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : file.status === 'error' ? (
                <svg className="w-5 h-5 text-destructive" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground">{file.file.name}</p>
              {file.error && (
                <p className="text-destructive text-xs">{file.error}</p>
              )}
            </div>
            <span className="text-foreground-muted text-xs">
              {formatFileSize(file.file.size)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
