'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPTED_BARCODE_EXTENSIONS, filterAcceptedBarcodeFiles } from '@/lib/barcodeFiles';

interface BarcodeDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT_ATTR = ACCEPTED_BARCODE_EXTENSIONS.join(',');

export function BarcodeDropZone({ onFilesSelected, disabled }: BarcodeDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (fileList: FileList | File[]) => {
      const { accepted, rejectedCount } = filterAcceptedBarcodeFiles(Array.from(fileList));
      if (rejectedCount > 0) {
        setError(`Some files were skipped. Accepted: ${ACCEPTED_BARCODE_EXTENSIONS.join(', ')}`);
        setTimeout(() => setError(''), 3000);
      }
      if (accepted.length > 0) onFilesSelected(accepted);
    },
    [onFilesSelected]
  );

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-surface-raised hover:border-foreground-subtle hover:bg-surface',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            if (e.target.files) handle(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center">
          <Upload className={cn('w-8 h-8 mb-2', isDragging ? 'text-primary' : 'text-foreground-subtle')} />
          <p className="text-foreground font-medium text-sm mb-0.5">
            {isDragging ? 'Drop barcode files here' : 'Drag and drop barcode files'}
          </p>
          <p className="text-foreground-muted text-xs mb-1">or click to browse</p>
          <p className="text-foreground-subtle text-xs">
            Accepted: {ACCEPTED_BARCODE_EXTENSIONS.join(', ')}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
    </div>
  );
}
