'use client';

import { useEffect, useRef, useState } from 'react';
import { statusConfig } from '@/lib/utils';
import { UploadStatus } from '@/types/database';

const UPLOAD_STATUS_OPTIONS: UploadStatus[] = ['uploaded', 'approved', 'rejected'];

interface UploadStatusDropdownProps {
  status: UploadStatus;
  onStatusChange: (status: UploadStatus) => Promise<void>;
  variant?: 'default' | 'compact';
}

export function UploadStatusDropdown({
  status,
  onStatusChange,
  variant = 'default',
}: UploadStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const config = statusConfig[status];
  const isCompact = variant === 'compact';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleSelect = async (newStatus: UploadStatus) => {
    if (newStatus === status || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update upload status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`inline-flex items-center rounded-full font-medium border transition-colors ${config.bgColor} ${config.textColor} ${config.borderColor} hover:opacity-80 disabled:opacity-50 ${
          isCompact
            ? 'px-1.5 py-0.5 text-[11px] gap-0.5'
            : 'px-2.5 py-1 text-sm gap-1.5'
        }`}
      >
        {config.label}
        <svg className={isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-surface-overlay border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
          <ul className="py-1">
            {UPLOAD_STATUS_OPTIONS.map((option) => {
              const optionConfig = statusConfig[option];
              const isSelected = option === status;
              return (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={isUpdating}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-muted flex items-center gap-2 ${
                      isSelected ? 'bg-primary-subtle' : ''
                    }`}
                  >
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${optionConfig.bgColor} ${optionConfig.textColor} ${optionConfig.borderColor}`}
                    >
                      {optionConfig.label}
                    </span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
