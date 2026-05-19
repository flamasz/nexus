'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAnchoredDropdownPosition } from '@/lib/dropdownPosition';
import { ItemName } from '@/types/database';

interface ItemNameComboboxProps {
  itemNames: ItemName[];
  selectedId: string | null;
  onSelect: (itemNameId: string | null) => void;
  onCreate: (name: string) => Promise<ItemName>;
  onUpdate: (id: string, name: string) => Promise<ItemName>;
  required?: boolean;
  variant?: 'default' | 'compact';
}

export function ItemNameCombobox({
  itemNames,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  required = true,
  variant = 'default',
}: ItemNameComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 384 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const selectedItemName = itemNames.find((i) => i.id === selectedId);

  const filteredItemNames = itemNames.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption = search.trim() && 
    !filteredItemNames.some((i) => i.name.toLowerCase() === search.toLowerCase().trim());

  const totalOptions = filteredItemNames.length + (showCreateOption ? 1 : 0);

  const updatePosition = useCallback(() => {
    const el = inputRef.current || containerRef.current;
    if (el) {
      setDropdownPosition(getAnchoredDropdownPosition(el, { minWidth: 200 }));
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
        setIsChanging(false);
        setSearch('');
        setHighlightedIndex(-1);
        setEditingId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current && !editingId) {
      const items = listRef.current.querySelectorAll('li');
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, editingId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleSelect = useCallback(async (itemNameId: string) => {
    onSelect(itemNameId);
    setIsOpen(false);
    setIsChanging(false);
    setSearch('');
    setHighlightedIndex(-1);
  }, [onSelect]);

  const handleCreate = useCallback(async () => {
    if (!search.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      const newItemName = await onCreate(search.trim());
      onSelect(newItemName.id);
      setIsOpen(false);
      setIsChanging(false);
      setSearch('');
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Failed to create item name:', error);
    } finally {
      setIsCreating(false);
    }
  }, [search, isCreating, onCreate, onSelect]);

  const handleClear = useCallback(() => {
    if (!required) {
      onSelect(null);
    }
    setSearch('');
  }, [onSelect, required]);

  const handleStartEdit = useCallback((e: React.MouseEvent, itemName: ItemName) => {
    e.stopPropagation();
    setEditingId(itemName.id);
    setEditingValue(itemName.name);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingValue('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editingValue.trim() || isSavingEdit) return;
    
    const originalItem = itemNames.find((i) => i.id === editingId);
    if (originalItem && originalItem.name === editingValue.trim()) {
      handleCancelEdit();
      return;
    }

    setIsSavingEdit(true);
    try {
      await onUpdate(editingId, editingValue.trim());
      setEditingId(null);
      setEditingValue('');
    } catch (error) {
      console.error('Failed to update item name:', error);
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingId, editingValue, isSavingEdit, itemNames, onUpdate, handleCancelEdit]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingId) return;

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
          if (highlightedIndex < filteredItemNames.length) {
            handleSelect(filteredItemNames[highlightedIndex].id);
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
        setIsChanging(false);
        setSearch('');
        setHighlightedIndex(-1);
        break;
      case 'Backspace':
        if (search === '' && selectedItemName && !required) {
          e.preventDefault();
          handleClear();
        }
        break;
    }
  }, [isOpen, editingId, highlightedIndex, totalOptions, filteredItemNames, showCreateOption, handleSelect, handleCreate, handleClear, selectedItemName, search, required]);

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
      {selectedItemName && !isChanging ? (
        variant === 'compact' ? (
          <div
            className="w-full h-[26px] flex items-center gap-1 px-1.5 border border-border rounded cursor-pointer hover:border-foreground-subtle bg-surface text-xs"
            onClick={() => {
              setIsChanging(true);
              updatePosition();
              setIsOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <span className="text-xs font-bold text-foreground truncate">
              {selectedItemName.name}
            </span>
            <svg className="w-3 h-3 text-foreground-subtle flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-subtle text-primary rounded-full text-sm font-medium">
              {selectedItemName.name}
              <button
                type="button"
                onClick={() => {
                  setIsChanging(true);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                aria-label="Change name"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <button
              type="button"
              onClick={() => {
                setIsChanging(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="text-sm text-foreground-muted hover:text-foreground"
            >
              Change
            </button>
          </div>
        )
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={variant === 'compact' ? 'Search...' : 'Search or create name...'}
            className={variant === 'compact'
              ? 'w-full h-[26px] px-1.5 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent'
              : 'w-full px-3 py-2 border border-border bg-surface text-foreground placeholder:text-foreground-subtle rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent'
            }
          />
          
          {isOpen && typeof document !== 'undefined' && createPortal(
            <div 
              ref={dropdownRef}
              className="fixed bg-surface-overlay border border-border rounded-md shadow-lg flex flex-col overflow-hidden"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                maxHeight: dropdownPosition.maxHeight,
                minHeight: Math.min(256, dropdownPosition.maxHeight),
                zIndex: 10000,
              }}
            >
              <ul ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
                {filteredItemNames.map((itemName, index) => (
                  <li key={itemName.id}>
                    {editingId === itemName.id ? (
                      <div className="flex items-center gap-2 px-4 py-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="flex-1 px-2 py-1 border border-border bg-surface text-foreground rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={isSavingEdit}
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit || !editingValue.trim()}
                          className="p-1 text-success hover:text-success hover:bg-success-subtle rounded transition-colors disabled:opacity-50"
                          aria-label="Save"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                          className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors disabled:opacity-50"
                          aria-label="Cancel"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div
                        role="option"
                        aria-selected={highlightedIndex === index}
                        onClick={() => handleSelect(itemName.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group cursor-pointer ${
                          highlightedIndex === index
                            ? 'bg-primary-subtle text-primary'
                            : 'hover:bg-primary-muted'
                        }`}
                      >
                        <span>{itemName.name}</span>
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(e, itemName)}
                          className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Edit name"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                ))}

                {filteredItemNames.length === 0 && !showCreateOption && (
                  <li className="px-4 py-3 text-sm text-foreground-muted text-center">
                    No names found
                  </li>
                )}

                {showCreateOption && (
                  <li>
                    <button
                      type="button"
                      onClick={handleCreate}
                      onMouseEnter={() => setHighlightedIndex(filteredItemNames.length)}
                      disabled={isCreating}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                        highlightedIndex === filteredItemNames.length
                          ? 'bg-primary-subtle text-primary'
                          : 'hover:bg-primary-muted'
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
