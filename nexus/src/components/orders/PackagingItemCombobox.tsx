'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { CategorySelector } from '@/components/packaging/CategorySelector';
import { ItemNameCombobox } from '@/components/packaging/ItemNameCombobox';
import { getAnchoredDropdownPosition } from '@/lib/dropdownPosition';
import { Category, ItemName, PackagingItemCombo } from '@/types/database';

interface PackagingItemComboboxProps {
  combos: PackagingItemCombo[];
  itemNames: ItemName[];
  categories: Category[];
  selectedItemNameId: string | null;
  selectedCategoryId: string | null;
  onSelect: (combo: PackagingItemCombo | null) => void;
  onCreateItemName: (name: string) => Promise<ItemName>;
  onUpdateItemName: (id: string, name: string) => Promise<ItemName>;
  onCreateCategory: (prefillName?: string, onCreated?: (category: Category) => void) => void;
  onEditCategory?: (category: Category) => void;
  onCreateCombination: (itemNameId: string, categoryId: string) => Promise<PackagingItemCombo>;
  showDropdownEditAction?: boolean;
  disabled?: boolean;
}

function comboLabel(combo: PackagingItemCombo) {
  return `${combo.item_name?.name ?? 'Unnamed'} · ${combo.category?.name ?? 'Uncategorized'}`;
}

function comboSearchText(combo: PackagingItemCombo) {
  return `${comboLabel(combo)} ${combo.latest_version ?? ''}`.toLowerCase();
}

export function PackagingItemCombobox({
  combos,
  itemNames,
  categories,
  selectedItemNameId,
  selectedCategoryId,
  onSelect,
  onCreateItemName,
  onUpdateItemName,
  onCreateCategory,
  onEditCategory,
  onCreateCombination,
  showDropdownEditAction = false,
  disabled = false,
}: PackagingItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [draftItemNameId, setDraftItemNameId] = useState<string | null>(null);
  const [draftCategoryId, setDraftCategoryId] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 320, maxHeight: 420 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCombo = combos.find(
    (combo) => combo.item_name_id === selectedItemNameId && combo.category_id === selectedCategoryId
  ) ?? null;

  const filteredCombos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((combo) => comboSearchText(combo).includes(q));
  }, [combos, search]);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      setDropdownPosition(getAnchoredDropdownPosition(buttonRef.current, { minWidth: 320, maxHeight: 420 }));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-nested-dropdown-root="true"]')) {
        return;
      }
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setOpen(false);
        setSearch('');
        setEditorMode('closed');
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
        setEditorMode('closed');
      }
    }
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
  }, [open, updatePosition]);

  const handleSelect = (combo: PackagingItemCombo | null) => {
    if (disabled) return;
    onSelect(combo);
    setOpen(false);
    setSearch('');
    setEditorMode('closed');
  };

  const startCreateCombination = () => {
    setDraftItemNameId(null);
    setDraftCategoryId(null);
    setEditorMode('create');
  };

  const startEditCombination = (event: ReactMouseEvent, combo: PackagingItemCombo) => {
    event.preventDefault();
    event.stopPropagation();
    setDraftItemNameId(combo.item_name_id);
    setDraftCategoryId(combo.category_id);
    setEditorMode('edit');
  };

  const handleCreateCombination = async () => {
    if (!draftItemNameId || !draftCategoryId || pendingCreate) return;
    const existingCombo = combos.find(
      (combo) => combo.item_name_id === draftItemNameId && combo.category_id === draftCategoryId
    );
    if (existingCombo) {
      onSelect(existingCombo);
      setOpen(false);
      setSearch('');
      setEditorMode('closed');
      setDraftItemNameId(null);
      setDraftCategoryId(null);
      return;
    }

    setPendingCreate(true);
    try {
      const combo = await onCreateCombination(draftItemNameId, draftCategoryId);
      onSelect(combo);
      setOpen(false);
      setSearch('');
      setEditorMode('closed');
      setDraftItemNameId(null);
      setDraftCategoryId(null);
    } finally {
      setPendingCreate(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) updatePosition();
          setOpen((value) => !value);
        }}
        className="flex h-[26px] w-full items-center gap-1 rounded border border-border bg-surface px-1.5 text-left text-xs text-foreground hover:border-foreground-subtle disabled:cursor-default disabled:opacity-60"
        title={selectedCombo ? comboLabel(selectedCombo) : 'Select packaging item'}
      >
        {selectedCombo ? (
          <span className="min-w-0 flex-1 truncate">{comboLabel(selectedCombo)}</span>
        ) : (
          <span className="text-foreground-subtle">— Packaging Item —</span>
        )}
        <svg className="ml-auto h-3 w-3 shrink-0 text-foreground-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed flex flex-col overflow-hidden rounded-lg border border-border bg-surface-overlay p-2 shadow-lg"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
            zIndex: 10000,
          }}
        >
          {editorMode === 'closed' ? (
            <>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
                placeholder="Search packaging items"
                className="mb-2 w-full rounded border border-border bg-surface px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground-muted hover:bg-surface-raised"
                >
                  No packaging item
                </button>
                {filteredCombos.map((combo) => (
                  <div key={combo.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => handleSelect(combo)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-raised ${showDropdownEditAction ? 'pr-8' : ''}`}
                    >
                      <span className="block truncate">{comboLabel(combo)}</span>
                    </button>
                    {showDropdownEditAction && (
                      <button
                        type="button"
                        onClick={(event) => startEditCombination(event, combo)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-foreground-subtle opacity-0 transition-opacity hover:bg-surface-overlay hover:text-foreground group-hover:opacity-100"
                        aria-label={`Edit ${comboLabel(combo)}`}
                        title="Edit item/category combination"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {filteredCombos.length === 0 && (
                  <div className="px-2 py-3 text-xs text-foreground-muted">
                    No packaging item name/category combinations found.
                  </div>
                )}
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={startCreateCombination}
                  className="w-full rounded border border-dashed border-border px-2 py-1.5 text-left text-xs text-primary hover:bg-primary-subtle"
                >
                  + Create item/category combination
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="text-xs font-medium text-foreground">{editorMode === 'edit' ? 'Edit item/category combination' : 'Create item/category combination'}</div>
                  <div className="text-[11px] text-foreground-muted">{editorMode === 'edit' ? 'Update the selected packaging item fields.' : 'Creates a packaging item record.'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorMode('closed')}
                  className="rounded px-1.5 py-1 text-xs text-foreground-muted hover:bg-surface-raised"
                >
                  Back
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground-muted">Item name</label>
                <ItemNameCombobox
                  itemNames={itemNames}
                  selectedId={draftItemNameId}
                  onSelect={setDraftItemNameId}
                  onCreate={onCreateItemName}
                  onUpdate={onUpdateItemName}
                  required={false}
                  variant="compact"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground-muted">Category</label>
                <CategorySelector
                  categories={categories}
                  selectedId={draftCategoryId}
                  onSelect={setDraftCategoryId}
                  onCreateNew={(prefillName) => {
                    onCreateCategory(prefillName, (category) => setDraftCategoryId(category.id));
                  }}
                  onEdit={onEditCategory}
                  variant="compact"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateCombination}
                disabled={!draftItemNameId || !draftCategoryId || pendingCreate}
                className="w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {pendingCreate ? (editorMode === 'edit' ? 'Saving…' : 'Creating…') : (editorMode === 'edit' ? 'Save combination' : 'Create combination')}
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
