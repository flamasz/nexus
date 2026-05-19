'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAnchoredDropdownPosition } from '@/lib/dropdownPosition';
import { ITEM_STATUS_CONFIG } from '@/lib/itemStatus';
import { ItemStatus } from '@/types/database';

export interface VersionWithStatus {
  version: string;
  status?: string;
}

interface VersionComboboxProps {
  versions: VersionWithStatus[];
  selectedVersion: string | null;
  onSelect: (version: string | null) => void;
  onCreate: (version: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'compact';
}

export function VersionCombobox({
  versions,
  selectedVersion,
  onSelect,
  onCreate,
  disabled = false,
  variant = 'default',
}: VersionComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVersionValue, setNewVersionValue] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newVersionInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredVersions = versions.filter((v) =>
    v.version.toLowerCase().includes(search.toLowerCase())
  );

  const updatePosition = useCallback(() => {
    const el = inputRef.current || containerRef.current;
    if (el) {
      setDropdownPosition(getAnchoredDropdownPosition(el, { minWidth: 180, maxHeight: 240, minUsableHeight: 140 }));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        setIsCreatingNew(false);
        setNewVersionValue('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      const item = items[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  useEffect(() => {
    if (isCreatingNew && newVersionInputRef.current) {
      newVersionInputRef.current.focus();
    }
  }, [isCreatingNew]);

  const handleSelect = useCallback((version: string) => {
    onSelect(version);
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  }, [onSelect]);

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const config = ITEM_STATUS_CONFIG[status as ItemStatus];
    if (!config) return null;
    return (
      <span className={`inline-block px-1.5 py-0 rounded-full text-[10px] font-medium border ${config.bg} ${config.text} ${config.border}`}>
        {config.label}
      </span>
    );
  };

  const handleCreateConfirm = useCallback(() => {
    if (!newVersionValue.trim()) return;
    onCreate(newVersionValue.trim());
    onSelect(newVersionValue.trim());
    setIsOpen(false);
    setSearch('');
    setIsCreatingNew(false);
    setNewVersionValue('');
  }, [newVersionValue, onCreate, onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        if (!disabled) {
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredVersions.length ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredVersions.length) {
          handleSelect(filteredVersions[highlightedIndex].version);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        setIsCreatingNew(false);
        setNewVersionValue('');
        break;
    }
  }, [isOpen, disabled, highlightedIndex, filteredVersions, handleSelect]);

  const openDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const isCompact = variant === 'compact';

  if (disabled) {
    return (
      <div
        className={isCompact
          ? 'px-1.5 py-1 border border-border rounded bg-surface text-foreground-subtle text-xs'
          : 'px-3 py-2 border border-border rounded-md bg-surface text-foreground-subtle'
        }
      >
        {isCompact ? '— Ver —' : 'Select item & category first'}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {!isOpen ? (
        <div
          onClick={openDropdown}
          className={isCompact
            ? 'flex items-center gap-1 px-1.5 py-1 border border-border rounded cursor-pointer hover:border-foreground-subtle text-xs bg-surface'
            : 'flex items-center gap-2 px-3 py-2 border border-border rounded-md cursor-pointer hover:border-foreground-subtle bg-surface'
          }
        >
          <span className={selectedVersion ? 'text-foreground' : 'text-foreground-subtle'}>
            {selectedVersion || (isCompact ? '— Ver —' : 'Select version...')}
          </span>
          <svg className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-foreground-subtle ml-auto flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search versions..."
          className={isCompact
            ? 'w-full px-1.5 py-1 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring'
            : 'w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent'
          }
        />
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface-overlay border border-border rounded-md shadow-lg overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
            zIndex: 10000,
          }}
        >
          <ul ref={listRef} className="max-h-40 overflow-y-auto">
            {filteredVersions.map((v, index) => (
              <li key={v.version}>
                <button
                  type="button"
                  onClick={() => handleSelect(v.version)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                    highlightedIndex === index
                      ? 'bg-primary-subtle text-primary'
                      : 'hover:bg-primary-muted'
                  } ${selectedVersion === v.version ? 'font-medium' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{v.version}</span>
                    {getStatusBadge(v.status)}
                    {selectedVersion === v.version && (
                      <svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              </li>
            ))}

            {filteredVersions.length === 0 && !isCreatingNew && (
              <li className="px-4 py-3 text-sm text-foreground-muted text-center">
                No versions found
              </li>
            )}
          </ul>

          <div className="border-t border-border p-2">
            {isCreatingNew ? (
              <div className="flex items-center gap-2">
                <input
                  ref={newVersionInputRef}
                  type="text"
                  value={newVersionValue}
                  onChange={(e) => setNewVersionValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateConfirm();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsCreatingNew(false);
                      setNewVersionValue('');
                    }
                  }}
                  placeholder="e.g. v3"
                  className="flex-1 px-2 py-1 border border-border bg-surface text-foreground rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={handleCreateConfirm}
                  disabled={!newVersionValue.trim()}
                  className="p-1 text-success hover:text-success hover:bg-success-subtle rounded transition-colors disabled:opacity-50"
                  aria-label="Confirm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setNewVersionValue('');
                  }}
                  className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors"
                  aria-label="Cancel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary-subtle rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new version
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
