'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ProductLine } from '@/types/database';

interface ProductLineComboboxProps {
  productLines: ProductLine[];
  selectedId: string | null;
  onSelect: (productLineId: string | null) => void;
  onCreate: (name: string) => Promise<ProductLine>;
}

export function ProductLineCombobox({
  productLines,
  selectedId,
  onSelect,
  onCreate,
}: ProductLineComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProductLine = productLines.find((p) => p.id === selectedId);

  const filteredProductLines = productLines.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption = search.trim() && 
    !filteredProductLines.some((p) => p.name.toLowerCase() === search.toLowerCase().trim());

  const totalOptions = filteredProductLines.length + (showCreateOption ? 1 : 0);

  // Update dropdown position
  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
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
        setSearch('');
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li');
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(async (productLineId: string) => {
    onSelect(productLineId);
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  }, [onSelect]);

  const handleCreate = useCallback(async () => {
    if (!search.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const newProductLine = await onCreate(search.trim());
      onSelect(newProductLine.id);
      setIsOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Failed to create product line:', error);
    } finally {
      setIsCreating(false);
    }
  }, [search, isCreating, onCreate, onSelect]);

  const handleClear = useCallback(() => {
    onSelect(null);
    setSearch('');
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < totalOptions - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          if (highlightedIndex < filteredProductLines.length) {
            handleSelect(filteredProductLines[highlightedIndex].id);
          } else if (showCreateOption) {
            handleCreate();
          }
        } else if (showCreateOption) {
          handleCreate();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        break;
      case 'Backspace':
        if (search === '' && selectedProductLine) {
          e.preventDefault();
          handleClear();
        }
        break;
    }
  }, [isOpen, highlightedIndex, totalOptions, filteredProductLines, showCreateOption, handleSelect, handleCreate, handleClear, selectedProductLine, search]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setHighlightedIndex(0);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      {selectedProductLine ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 text-purple-400 rounded-full text-sm font-medium">
            {selectedProductLine.name}
            <button
              type="button"
              onClick={handleClear}
              className="hover:bg-purple-500/25 rounded-full p-0.5 transition-colors"
              aria-label="Clear product line"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
          <button
            type="button"
            onClick={() => {
              handleClear();
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search or create product line..."
            className="w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          
          {isOpen && typeof document !== 'undefined' && createPortal(
            <div 
              ref={dropdownRef}
              className="fixed bg-surface-overlay border border-border rounded-md shadow-lg max-h-60 overflow-hidden"
              style={{
                top: dropdownPosition.top + 4,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 9999,
              }}
            >
              <ul ref={listRef} className="max-h-48 overflow-y-auto">
                {filteredProductLines.map((productLine, index) => (
                  <li key={productLine.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(productLine.id)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        highlightedIndex === index
                          ? 'bg-primary-subtle text-primary'
                          : 'text-foreground hover:bg-surface-raised'
                      }`}
                    >
                      {productLine.name}
                    </button>
                  </li>
                ))}

                {filteredProductLines.length === 0 && !showCreateOption && (
                  <li className="px-4 py-3 text-sm text-foreground-muted text-center">
                    No product lines found
                  </li>
                )}

                {showCreateOption && (
                  <li>
                    <button
                      type="button"
                      onClick={handleCreate}
                      onMouseEnter={() => setHighlightedIndex(filteredProductLines.length)}
                      disabled={isCreating}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                        highlightedIndex === filteredProductLines.length
                          ? 'bg-primary-subtle text-primary'
                          : 'text-foreground hover:bg-surface-raised'
                      } ${isCreating ? 'opacity-50' : ''}`}
                    >
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>
                        {isCreating ? 'Creating...' : `Create "${search.trim()}"`}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
}
