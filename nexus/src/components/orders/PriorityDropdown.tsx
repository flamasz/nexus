'use client';

import { useState, useRef, useEffect } from 'react';
import { ItemPriority } from '@/types/database';

const PRIORITY_CONFIG: Record<ItemPriority, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  '1_critical': {
    label: '1 - Critical',
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-700/50',
  },
  '2_standard': {
    label: '2 - Standard',
    bg: 'bg-blue-900/30',
    text: 'text-blue-400',
    border: 'border-blue-700/50',
  },
  '3_low': {
    label: '3 - Low',
    bg: 'bg-gray-800/50',
    text: 'text-gray-400',
    border: 'border-gray-600/50',
  },
} as const;

const PRIORITY_OPTIONS: ItemPriority[] = ['1_critical', '2_standard', '3_low'];

interface PriorityDropdownProps {
  priority: ItemPriority;
  onPriorityChange: (priority: ItemPriority) => Promise<void>;
  variant?: 'default' | 'compact';
}

export function PriorityDropdown({
  priority,
  onPriorityChange,
  variant = 'default',
}: PriorityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const config = PRIORITY_CONFIG[priority];

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

  const handleSelect = async (newPriority: ItemPriority) => {
    if (newPriority === priority || isUpdating) return;

    setIsUpdating(true);
    try {
      await onPriorityChange(newPriority);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update priority:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const isCompact = variant === 'compact';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={`inline-flex items-center rounded-full font-medium border transition-colors ${config.bg} ${config.text} ${config.border} hover:opacity-80 disabled:opacity-50 ${
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
        <div className="absolute left-0 top-full mt-1 bg-surface-overlay border border-border rounded-lg shadow-lg z-50 min-w-[161px]">
          <ul className="py-1">
            {PRIORITY_OPTIONS.map((option) => {
              const optionConfig = PRIORITY_CONFIG[option];
              const isSelected = option === priority;
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
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${optionConfig.bg} ${optionConfig.text} ${optionConfig.border}`}
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
