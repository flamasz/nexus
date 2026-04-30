'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ItemPriority } from '@/types/database';

const PRIORITY_CONFIG: Record<ItemPriority, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  '1_critical': {
    label: '1 - Critical',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-300 dark:border-red-700/50',
  },
  '2_standard': {
    label: '2 - Standard',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700/50',
  },
  '3_low': {
    label: '3 - Low',
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    text: 'text-gray-700 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-600/50',
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const config = PRIORITY_CONFIG[priority];

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      updatePosition();
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

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
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) updatePosition();
          setIsOpen(!isOpen);
        }}
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

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface-overlay border border-border rounded-lg shadow-lg min-w-[161px]"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 10000,
          }}
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}
