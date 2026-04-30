'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '@/types/database';
import { getCategoryColorClasses } from '@/lib/categoryColors';
import { formatDimensions } from '@/lib/utils/formatDimensions';

interface CategorySelectorProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateNew: (prefillName?: string) => void;
  onEdit?: (category: Category) => void;
  variant?: 'default' | 'compact';
}

export function CategorySelector({
  categories,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit,
  variant = 'default',
}: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find((c) => c.id === selectedId);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Update dropdown position
  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width * 1.04, 229),
      });
    }
  }, []);

  // Update position when open
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

  // Close dropdown when clicking outside
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      {variant === 'compact' ? (
        <div
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="flex items-center gap-1 w-full px-1.5 py-1 border border-border rounded cursor-pointer hover:border-foreground-subtle bg-surface"
        >
          {selectedCategory ? (
            <>
              {(() => {
                const colorStyles = getCategoryColorClasses(selectedCategory.color, selectedCategory.name);
                if (colorStyles.style) {
                  return (
                    <span
                      className="inline-block px-1 py-0 rounded text-[11px] font-medium border"
                      style={colorStyles.style}
                    >
                      {selectedCategory.name}
                    </span>
                  );
                }
                return (
                  <span className={`inline-block px-1 py-0 rounded text-[11px] font-medium border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
                    {selectedCategory.name}
                  </span>
                );
              })()}
              <svg className="w-2.5 h-2.5 text-foreground-subtle ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          ) : (
            <>
              <span className="text-foreground-subtle text-xs">— Cat —</span>
              <svg className="w-2.5 h-2.5 text-foreground-subtle ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </div>
      ) : (
        <div
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="w-full px-3 py-2 border border-border rounded-md cursor-pointer hover:border-foreground-subtle bg-surface focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent"
        >
          {selectedCategory ? (
            <div className="flex items-center gap-2">
              {(() => {
                const colorStyles = getCategoryColorClasses(selectedCategory.color, selectedCategory.name);
                if (colorStyles.style) {
                  return (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-sm font-medium border"
                      style={colorStyles.style}
                    >
                      {selectedCategory.name}
                    </span>
                  );
                }
                return (
                  <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
                    {selectedCategory.name}
                  </span>
                );
              })()}
              <span className="text-sm text-foreground-muted">
                {formatDimensions(selectedCategory.width, selectedCategory.height, selectedCategory.depth, selectedCategory.unit)}
              </span>
            </div>
          ) : (
            <span className="text-foreground-subtle">Select a category...</span>
          )}
        </div>
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-surface-overlay border border-border rounded-md shadow-lg max-h-96 flex flex-col overflow-hidden"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 10000,
          }}
        >
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
            />
          </div>

          <ul className="flex-1 min-h-0 overflow-y-auto">
            {filteredCategories.map((category) => {
              const colorStyles = getCategoryColorClasses(category.color, category.name);
              return (
              <li key={category.id} className="group">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(category.id)}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-primary-muted ${
                      selectedId === category.id ? 'bg-primary-subtle' : ''
                    } ${onEdit ? 'pr-9' : ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      {colorStyles.style ? (
                        <span
                          className="inline-block px-1.5 py-0 rounded text-xs font-medium border"
                          style={colorStyles.style}
                        >
                          {category.name}
                        </span>
                      ) : (
                        <span className={`inline-block px-1.5 py-0 rounded text-xs font-medium border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
                          {category.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-foreground-muted mt-0.5">
                      {formatDimensions(category.width, category.height, category.depth, category.unit)}
                    </div>
                  </button>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        onEdit(category);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit category"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
            })}

            {filteredCategories.length === 0 && search && (
              <li className="px-4 py-3 text-sm text-foreground-muted text-center">
                No categories match &quot;{search}&quot;
              </li>
            )}
          </ul>

          <div className="p-1.5 border-t border-border flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const prefillName = search.trim() || undefined;
                setIsOpen(false);
                setSearch('');
                onCreateNew(prefillName);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-primary hover:bg-primary-subtle rounded transition-colors"
            >
              + Create new category
            </button>
          </div>
        </div>,
        document.body
      )}

      {variant === 'default' && selectedCategory && (
        <div className="mt-2 p-3 bg-surface rounded-md">
          <p className="text-sm text-foreground-muted">
            <span className="font-medium">Dimensions:</span>{' '}
            {formatDimensions(selectedCategory.width, selectedCategory.height, selectedCategory.depth, selectedCategory.unit)}
          </p>
        </div>
      )}
    </div>
  );
}
