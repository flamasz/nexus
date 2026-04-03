# Revision 1: Order Items Field Upgrades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simple `<select>` dropdowns in OrderItemRow with reusable advanced components (searchable comboboxes, color-coded status pills) that match the Packaging Form UX.

**Architecture:** Adapt 3 existing components (ItemNameCombobox, CategorySelector, ItemStatusDropdown) with a `variant` prop for compact/inline mode. Create 2 new components (VersionCombobox, ItemOrderStatusDropdown). Update OrderItemRow to use all of them. Hide QTY spinners via global CSS.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Supabase

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| MODIFY | `src/components/packaging/ItemNameCombobox.tsx` | Add `variant` prop, compact trigger mode |
| MODIFY | `src/components/packaging/CategorySelector.tsx` | Add `variant` prop, compact trigger mode |
| MODIFY | `src/components/packaging/ItemStatusDropdown.tsx` | Add `variant` prop, compact sizing |
| CREATE | `src/components/packaging/VersionCombobox.tsx` | Searchable version picker with create-new |
| CREATE | `src/components/orders/ItemOrderStatusDropdown.tsx` | Color-coded order status pill + dropdown |
| MODIFY | `src/components/orders/OrderItemRow.tsx` | Swap selects for new components |
| MODIFY | `src/components/orders/OrderBlock.tsx` | Pass create/update handlers down to OrderItemRow |
| MODIFY | `src/app/globals.css` | Hide number input spinners |

---

### Task 1: Hide QTY Spinner Buttons (CSS)

**Files:**
- Modify: `pams/src/app/globals.css`

- [ ] **Step 1: Add spinner-hiding CSS**

Add at the end of `pams/src/app/globals.css`:

```css
/* Hide number input spinner buttons globally */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

- [ ] **Step 2: Verify in dev server**

Run: `cd pams && npm run dev`

Open the orders page, check that QTY fields no longer show up/down arrow buttons. The field should still accept typed numbers.

- [ ] **Step 3: Commit**

```bash
git add pams/src/app/globals.css
git commit -m "style: hide number input spinner buttons globally"
```

---

### Task 2: Add Compact Variant to ItemStatusDropdown

**Files:**
- Modify: `pams/src/components/packaging/ItemStatusDropdown.tsx`

- [ ] **Step 1: Add variant prop to interface and component**

In `pams/src/components/packaging/ItemStatusDropdown.tsx`, update the props interface and component signature:

```typescript
interface ItemStatusDropdownProps {
  status: ItemStatus;
  onStatusChange: (status: ItemStatus) => Promise<void>;
  variant?: 'default' | 'compact';
}

export function ItemStatusDropdown({ status, onStatusChange, variant = 'default' }: ItemStatusDropdownProps) {
```

- [ ] **Step 2: Update the trigger button styling**

Replace the trigger `<button>` className to use variant-aware sizing:

```typescript
<button
  type="button"
  onClick={() => setIsOpen(!isOpen)}
  disabled={isUpdating}
  className={`inline-flex items-center gap-1 rounded-full font-medium border transition-colors ${config.bg} ${config.text} ${config.border} hover:opacity-80 disabled:opacity-50 ${
    variant === 'compact'
      ? 'px-1.5 py-0.5 text-[11px] gap-0.5'
      : 'px-2.5 py-1 text-sm gap-1.5'
  }`}
>
  {config.label}
  <svg className={variant === 'compact' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
</button>
```

- [ ] **Step 3: Verify existing PackagingForm usage is unchanged**

Open the packaging items page. Click a packaging item's status dropdown. Verify it still looks and works the same (default variant).

- [ ] **Step 4: Commit**

```bash
git add pams/src/components/packaging/ItemStatusDropdown.tsx
git commit -m "feat: add compact variant to ItemStatusDropdown"
```

---

### Task 3: Add Compact Variant to ItemNameCombobox

**Files:**
- Modify: `pams/src/components/packaging/ItemNameCombobox.tsx`

- [ ] **Step 1: Add variant prop to interface and component**

In `pams/src/components/packaging/ItemNameCombobox.tsx`, update the interface:

```typescript
interface ItemNameComboboxProps {
  itemNames: ItemName[];
  selectedId: string | null;
  onSelect: (itemNameId: string | null) => void;
  onCreate: (name: string) => Promise<ItemName>;
  onUpdate: (id: string, name: string) => Promise<ItemName>;
  required?: boolean;
  variant?: 'default' | 'compact';
}
```

Update the component signature to destructure `variant`:

```typescript
export function ItemNameCombobox({
  itemNames,
  selectedId,
  onSelect,
  onCreate,
  onUpdate,
  required = true,
  variant = 'default',
}: ItemNameComboboxProps) {
```

- [ ] **Step 2: Add compact trigger for selected state**

Replace the selected-state block (the `{selectedItemName && !isChanging ? (` branch, lines 249-277) with variant-aware rendering:

```typescript
{selectedItemName && !isChanging ? (
  variant === 'compact' ? (
    <div
      onClick={() => {
        setIsChanging(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }}
      className="flex items-center gap-1 px-1.5 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 text-xs bg-white"
    >
      <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[11px] font-medium truncate max-w-[120px]">
        {selectedItemName.name}
      </span>
      <svg className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
        {selectedItemName.name}
        <button
          type="button"
          onClick={() => {
            setIsChanging(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
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
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Change
      </button>
    </div>
  )
) : (
```

- [ ] **Step 3: Add compact styling to the search input**

Replace the search input (line 280-288) with variant-aware styling:

```typescript
<input
  ref={inputRef}
  type="text"
  value={search}
  onChange={handleInputChange}
  onFocus={handleFocus}
  onKeyDown={handleKeyDown}
  placeholder={variant === 'compact' ? 'Search...' : 'Search or create name...'}
  className={variant === 'compact'
    ? 'w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent'
    : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  }
/>
```

- [ ] **Step 4: Update position calculation to use containerRef in compact mode**

The `updatePosition` callback currently uses `inputRef.current`. In compact selected state, the input isn't rendered — the compact trigger div is. Update to fall back to `containerRef`:

```typescript
const updatePosition = useCallback(() => {
  const el = inputRef.current || containerRef.current;
  if (el) {
    const rect = el.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 200),
    });
  }
}, []);
```

The `Math.max(rect.width, 200)` ensures the dropdown is at least 200px wide even when the compact trigger is narrow.

- [ ] **Step 5: Verify PackagingForm still works**

Open the packaging page, create or edit a packaging item. Verify the ItemNameCombobox behaves exactly as before (it uses default variant).

- [ ] **Step 6: Commit**

```bash
git add pams/src/components/packaging/ItemNameCombobox.tsx
git commit -m "feat: add compact variant to ItemNameCombobox"
```

---

### Task 4: Add Compact Variant to CategorySelector

**Files:**
- Modify: `pams/src/components/packaging/CategorySelector.tsx`

- [ ] **Step 1: Add variant prop to interface and component**

Update the interface in `pams/src/components/packaging/CategorySelector.tsx`:

```typescript
interface CategorySelectorProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateNew: (prefillName?: string) => void;
  onEdit?: (category: Category) => void;
  variant?: 'default' | 'compact';
}
```

Update the component signature:

```typescript
export function CategorySelector({
  categories,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit,
  variant = 'default',
}: CategorySelectorProps) {
```

- [ ] **Step 2: Replace the trigger div with variant-aware rendering**

Replace the trigger div (lines 86-120) with:

```typescript
<div
  onClick={() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }}
  className={variant === 'compact'
    ? 'w-full px-1.5 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 bg-white'
    : 'w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent'
  }
>
  {selectedCategory ? (
    <div className="flex items-center gap-1.5">
      {(() => {
        const colorStyles = getCategoryColorClasses(selectedCategory.color, selectedCategory.name);
        if (colorStyles.style) {
          return (
            <span
              className={`inline-block rounded font-medium border ${variant === 'compact' ? 'px-1 py-0 text-[11px]' : 'px-2 py-0.5 text-sm'}`}
              style={colorStyles.style}
            >
              {selectedCategory.name}
            </span>
          );
        }
        return (
          <span className={`inline-block rounded font-medium border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border} ${variant === 'compact' ? 'px-1 py-0 text-[11px]' : 'px-2 py-0.5 text-sm'}`}>
            {selectedCategory.name}
          </span>
        );
      })()}
      {variant === 'default' && (
        <span className="text-sm text-gray-500">
          {formatDimensions(selectedCategory.width, selectedCategory.height, selectedCategory.depth, selectedCategory.unit)}
        </span>
      )}
      {variant === 'compact' && (
        <svg className="w-2.5 h-2.5 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </div>
  ) : (
    <span className={variant === 'compact' ? 'text-gray-400 text-xs' : 'text-gray-400'}>
      {variant === 'compact' ? '— Cat —' : 'Select a category...'}
    </span>
  )}
</div>
```

- [ ] **Step 3: Conditionally hide the dimensions info box**

Replace the dimensions info box (lines 224-231) with:

```typescript
{variant === 'default' && selectedCategory && (
  <div className="mt-2 p-3 bg-gray-50 rounded-md">
    <p className="text-sm text-gray-600">
      <span className="font-medium">Dimensions:</span>{' '}
      {formatDimensions(selectedCategory.width, selectedCategory.height, selectedCategory.depth, selectedCategory.unit)}
    </p>
  </div>
)}
```

- [ ] **Step 4: Ensure dropdown minimum width for compact mode**

Update the `updatePosition` callback to ensure the dropdown is wide enough:

```typescript
const updatePosition = useCallback(() => {
  if (containerRef.current) {
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 220),
    });
  }
}, []);
```

- [ ] **Step 5: Verify PackagingForm still works**

Open the packaging page, create or edit a packaging item. Verify the CategorySelector behaves exactly as before — color badges, dimensions, create/edit all work.

- [ ] **Step 6: Commit**

```bash
git add pams/src/components/packaging/CategorySelector.tsx
git commit -m "feat: add compact variant to CategorySelector"
```

---

### Task 5: Create VersionCombobox

**Files:**
- Create: `pams/src/components/packaging/VersionCombobox.tsx`

- [ ] **Step 1: Create the VersionCombobox component**

Create `pams/src/components/packaging/VersionCombobox.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface VersionComboboxProps {
  versions: string[];
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newVersionInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredVersions = versions.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );

  const updatePosition = useCallback(() => {
    const el = inputRef.current || containerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: Math.max(rect.width, 180),
      });
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
          handleSelect(filteredVersions[highlightedIndex]);
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
          ? 'px-1.5 py-1 border border-gray-200 rounded bg-gray-50 text-gray-400 text-xs'
          : 'px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-400'
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
            ? 'flex items-center gap-1 px-1.5 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 text-xs bg-white'
            : 'flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400'
          }
        >
          <span className={selectedVersion ? '' : 'text-gray-400'}>
            {selectedVersion || (isCompact ? '— Ver —' : 'Select version...')}
          </span>
          <svg className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-gray-400 ml-auto flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            ? 'w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500'
            : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          }
        />
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
          }}
        >
          <ul ref={listRef} className="max-h-40 overflow-y-auto">
            {filteredVersions.map((version, index) => (
              <li key={version}>
                <button
                  type="button"
                  onClick={() => handleSelect(version)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                    highlightedIndex === index
                      ? 'bg-blue-50 text-blue-900'
                      : 'hover:bg-gray-50'
                  } ${selectedVersion === version ? 'font-medium' : ''}`}
                >
                  <span>{version}</span>
                  {selectedVersion === version && (
                    <svg className="w-4 h-4 text-blue-600 inline ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </li>
            ))}

            {filteredVersions.length === 0 && !isCreatingNew && (
              <li className="px-4 py-3 text-sm text-gray-500 text-center">
                No versions found
              </li>
            )}
          </ul>

          <div className="border-t border-gray-100 p-2">
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
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCreateConfirm}
                  disabled={!newVersionValue.trim()}
                  className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
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
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
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
```

- [ ] **Step 2: Verify the component renders without errors**

Import it temporarily in a test page or check for TypeScript errors:

Run: `cd pams && npx tsc --noEmit`

Expected: No errors related to VersionCombobox.

- [ ] **Step 3: Commit**

```bash
git add pams/src/components/packaging/VersionCombobox.tsx
git commit -m "feat: create VersionCombobox component with search and create-new"
```

---

### Task 6: Create ItemOrderStatusDropdown

**Files:**
- Create: `pams/src/components/orders/ItemOrderStatusDropdown.tsx`

- [ ] **Step 1: Create the ItemOrderStatusDropdown component**

Create `pams/src/components/orders/ItemOrderStatusDropdown.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { ItemOrderStatus } from '@/types/database';

const ORDER_STATUS_CONFIG: Record<ItemOrderStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  new: {
    label: 'New',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  final: {
    label: 'Final',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  cancel: {
    label: 'Cancel',
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
} as const;

const ORDER_STATUS_OPTIONS: ItemOrderStatus[] = ['new', 'final', 'cancel'];

interface ItemOrderStatusDropdownProps {
  status: ItemOrderStatus;
  onStatusChange: (status: ItemOrderStatus) => Promise<void>;
  variant?: 'default' | 'compact';
}

export function ItemOrderStatusDropdown({
  status,
  onStatusChange,
  variant = 'default',
}: ItemOrderStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const config = ORDER_STATUS_CONFIG[status];

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

  const handleSelect = async (newStatus: ItemOrderStatus) => {
    if (newStatus === status || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to update order status:', error);
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
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
          <ul className="py-1">
            {ORDER_STATUS_OPTIONS.map((option) => {
              const optionConfig = ORDER_STATUS_CONFIG[option];
              const isSelected = option === status;
              return (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={isUpdating}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                      isSelected ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${optionConfig.bg} ${optionConfig.text} ${optionConfig.border}`}
                    >
                      {optionConfig.label}
                    </span>
                    {isSelected && (
                      <svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
```

- [ ] **Step 2: Type-check**

Run: `cd pams && npx tsc --noEmit`

Expected: No errors related to ItemOrderStatusDropdown.

- [ ] **Step 3: Commit**

```bash
git add pams/src/components/orders/ItemOrderStatusDropdown.tsx
git commit -m "feat: create ItemOrderStatusDropdown with color-coded status pills"
```

---

### Task 7: Rewrite OrderItemRow to Use New Components

**Files:**
- Modify: `pams/src/components/orders/OrderItemRow.tsx`
- Modify: `pams/src/components/orders/OrderBlock.tsx`

- [ ] **Step 1: Update OrderItemRow props to accept create/update handlers**

The new components need `onCreate`, `onUpdate` etc. callbacks that OrderItemRow doesn't currently receive. Update the interface in `pams/src/components/orders/OrderItemRow.tsx`:

```typescript
import { OrderItemWithDetails, ItemName, Category, ItemStatus, ItemOrderStatus } from '@/types/database';
import { updateOrderItem, deleteOrderItem, getVersionsForItemCategory } from '@/app/actions/orders';
import { ItemNameCombobox } from '@/components/packaging/ItemNameCombobox';
import { CategorySelector } from '@/components/packaging/CategorySelector';
import { VersionCombobox } from '@/components/packaging/VersionCombobox';
import { ItemStatusDropdown } from '@/components/packaging/ItemStatusDropdown';
import { ItemOrderStatusDropdown } from './ItemOrderStatusDropdown';
```

Update the props interface:

```typescript
interface OrderItemRowProps {
  orderItem: OrderItemWithDetails;
  itemNames: ItemName[];
  categories: Category[];
  artworkStatus?: string;
  onOpenArtwork: (orderItem: OrderItemWithDetails) => void;
  onDelete: (id: string) => void;
  onChange: (updated: OrderItemWithDetails) => void;
  onCreateItemName: (name: string) => Promise<ItemName>;
  onUpdateItemName: (id: string, name: string) => Promise<ItemName>;
  onCreateCategory: (prefillName?: string) => void;
  onEditCategory?: (category: Category) => void;
}
```

Update the destructured props:

```typescript
export function OrderItemRow({
  orderItem,
  itemNames,
  categories,
  artworkStatus,
  onOpenArtwork,
  onDelete,
  onChange,
  onCreateItemName,
  onUpdateItemName,
  onCreateCategory,
  onEditCategory,
}: OrderItemRowProps) {
```

- [ ] **Step 2: Remove the old constants**

Delete the `APPROVAL_STATUS_OPTIONS` and `ORDER_STATUS_OPTIONS` constants (lines 7-18). They are no longer needed — the new dropdown components define their own configs internally.

- [ ] **Step 3: Replace the Item Name select with ItemNameCombobox**

Replace the Item Name `<select>` block (lines 111-120) with:

```typescript
{/* Item Name */}
<div className="flex-1 min-w-0">
  <ItemNameCombobox
    itemNames={itemNames}
    selectedId={orderItem.item_name_id}
    onSelect={(id) => update({ item_name_id: id, version: null, category_id: null })}
    onCreate={onCreateItemName}
    onUpdate={onUpdateItemName}
    required={false}
    variant="compact"
  />
</div>
```

- [ ] **Step 4: Replace the Category select with CategorySelector**

Replace the Category `<select>` block (lines 122-132) with:

```typescript
{/* Category */}
<div className="w-28">
  <CategorySelector
    categories={categories}
    selectedId={orderItem.category_id}
    onSelect={(id) => update({ category_id: id, version: null })}
    onCreateNew={onCreateCategory}
    onEdit={onEditCategory}
    variant="compact"
  />
</div>
```

- [ ] **Step 5: Replace the Version select with VersionCombobox**

Replace the Version `<select>` block (lines 134-145) with:

```typescript
{/* Version */}
<div className="w-20">
  <VersionCombobox
    versions={versions}
    selectedVersion={orderItem.version}
    onSelect={(v) => update({ version: v })}
    onCreate={(v) => update({ version: v })}
    disabled={!orderItem.item_name_id || !orderItem.category_id}
    variant="compact"
  />
</div>
```

- [ ] **Step 6: Replace the Approval Status select with ItemStatusDropdown**

Replace the Approval Status `<select>` block (lines 147-157) with:

```typescript
{/* Approval Status */}
<div className="w-28">
  <ItemStatusDropdown
    status={orderItem.approval_status ?? 'new'}
    onStatusChange={async (s) => { await update({ approval_status: s }); }}
    variant="compact"
  />
</div>
```

- [ ] **Step 7: Replace the Item Order Status select with ItemOrderStatusDropdown**

Replace the Item Order Status `<select>` block (lines 179-187) with:

```typescript
{/* Item Order Status */}
<div className="w-20">
  <ItemOrderStatusDropdown
    status={orderItem.item_order_status}
    onStatusChange={async (s) => { await update({ item_order_status: s }); }}
    variant="compact"
  />
</div>
```

- [ ] **Step 8: Remove the unused orderStatusStyle variable**

Delete the `orderStatusStyle` computation (lines 104-106) since it's no longer needed.

- [ ] **Step 9: Update OrderBlock to pass new props**

In `pams/src/components/orders/OrderBlock.tsx`, add the new imports at the top:

```typescript
import { createItemName, updateItemName } from '@/app/actions/itemNames';
import { Category } from '@/types/database';
```

Add state and handlers for category creation/editing. Add these inside the `OrderBlock` component, before the return:

```typescript
const [creatingCategory, setCreatingCategory] = useState(false);
const [newCategoryName, setNewCategoryName] = useState('');
const [editingCategory, setEditingCategory] = useState<Category | null>(null);
```

Update the `<OrderItemRow>` usage to pass the new props:

```typescript
<OrderItemRow
  key={oi.id}
  orderItem={oi}
  itemNames={itemNames}
  categories={categories}
  artworkStatus={getArtworkStatus(oi)}
  onOpenArtwork={setArtworkModalItem}
  onDelete={handleItemDelete}
  onChange={handleItemChange}
  onCreateItemName={createItemName}
  onUpdateItemName={updateItemName}
  onCreateCategory={(prefillName) => {
    setNewCategoryName(prefillName || '');
    setCreatingCategory(true);
  }}
  onEditCategory={setEditingCategory}
/>
```

Note: The `creatingCategory`/`editingCategory` state and the `CategoryForm` modal integration will need to be wired up to show the modal. Check how the PackagingForm does this — it renders `<CategoryForm>` conditionally. For now, the create/edit callbacks are passed through. If the orders page doesn't already render a CategoryForm modal, add it to OrderBlock:

```typescript
{/* Add after the ArtworkModal at the bottom of the return JSX */}
{creatingCategory && (
  <CategoryForm
    prefillName={newCategoryName}
    onSave={async (cat) => {
      setCreatingCategory(false);
      // Category list will refresh from parent
    }}
    onClose={() => setCreatingCategory(false)}
  />
)}
{editingCategory && (
  <CategoryForm
    category={editingCategory}
    onSave={async () => {
      setEditingCategory(null);
    }}
    onClose={() => setEditingCategory(null)}
  />
)}
```

Import CategoryForm at the top:

```typescript
import { CategoryForm } from '@/components/packaging/CategoryForm';
```

- [ ] **Step 10: Type-check the changes**

Run: `cd pams && npx tsc --noEmit`

Fix any TypeScript errors. Common issues: import paths, prop mismatches.

- [ ] **Step 11: Visual verification**

Run: `cd pams && npm run dev`

Open the orders page. For each order item row, verify:
1. Item Name shows a compact combobox — click to search, type to filter, create new works
2. Category shows a compact selector with color badge — search, create, edit all work
3. Version shows a compact combobox — disabled when no item+category, shows versions, create new works
4. Approval Status shows a colored pill — click to see colored dropdown options
5. QTY has no spinner buttons
6. Item Order Status shows a colored pill — click to see colored dropdown

- [ ] **Step 12: Commit**

```bash
git add pams/src/components/orders/OrderItemRow.tsx pams/src/components/orders/OrderBlock.tsx
git commit -m "feat: replace order item selects with reusable advanced components"
```

---

### Task 8: Final Verification and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Full type-check**

Run: `cd pams && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Lint check**

Run: `cd pams && npm run lint`

Expected: No new lint errors.

- [ ] **Step 3: Build check**

Run: `cd pams && npm run build`

Expected: Build succeeds.

- [ ] **Step 4: End-to-end verification**

Run: `cd pams && npm run dev`

Test the full flow:
1. Open the packaging page — verify ItemNameCombobox, CategorySelector, and ItemStatusDropdown work exactly as before (default variant, no visual changes)
2. Open the orders page — verify all 6 fields work correctly in compact variant
3. Create a new order item — verify all fields start empty/default and each field can be filled
4. Test the version dependency — select item name + category, verify versions populate, create a new version
5. Test category create/edit from the order row — verify the CategoryForm modal opens and works

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup for revision 1 order items upgrade"
```
