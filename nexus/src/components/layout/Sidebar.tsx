'use client';

import { useState } from 'react';
import { ItemWithCategory } from '@/types/database';
import { cn } from '@/lib/utils';
import { CategoryBadge, ItemStatusBadge } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Search, X, Package, SearchX } from 'lucide-react';

interface SidebarProps {
  items: ItemWithCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  canCreateNew?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  items,
  selectedId,
  onSelect,
  onCreateNew,
  canCreateNew = true,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const archivedCount = items.filter((item) => item.archived).length;

  const archivedFiltered = showArchived
    ? items
    : items.filter((item) => !item.archived);

  const filteredItems = searchQuery.trim()
    ? archivedFiltered.filter((item) => {
        const query = searchQuery.toLowerCase();
        const nameMatch = item.item_name?.name.toLowerCase().includes(query);
        const categoryMatch = item.category?.name.toLowerCase().includes(query);
        return nameMatch || categoryMatch;
      })
    : archivedFiltered;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-80 bg-sidebar border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col overflow-hidden flex-shrink-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Packaging Items</h2>
            {canCreateNew && (
              <Button
                onClick={onCreateNew}
                size="icon"
                aria-label="Create new packaging item"
              >
                <Plus className="size-5" />
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-subtle" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground-subtle hover:text-foreground-muted"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-foreground-muted">
              {searchQuery.trim() ? (
                <>
                  <SearchX className="size-10 mx-auto text-foreground-subtle mb-2" />
                  <p className="text-sm">No items found</p>
                </>
              ) : (
                <>
                  <div className="mb-2">
                    <Package className="size-12 mx-auto text-foreground-subtle" />
                  </div>
                  <p className="text-sm">No packaging items yet</p>
                  {canCreateNew && (
                    <button
                      onClick={onCreateNew}
                      className="mt-2 text-sm text-primary hover:text-primary-hover"
                    >
                      Create your first item
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onSelect(item.id);
                      onClose?.();
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-surface transition-colors',
                      selectedId === item.id && 'bg-primary-subtle border-r-2 border-primary'
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                          {item.category && (
                            <CategoryBadge category={item.category} fontWeight="font-semibold" />
                          )}
                          {item.product_line && (
                            <span className="inline-block px-2 py-0.5 bg-purple-500/15 text-purple-400 text-sm font-semibold rounded border border-purple-500/30">
                              {item.product_line.name}
                            </span>
                          )}
                          {!item.category && !item.product_line && (
                            <span className="inline-block px-2 py-0.5 bg-surface text-foreground-subtle text-sm italic rounded">
                              No category
                            </span>
                          )}
                        </div>
                        {item.version && (
                          <span className="text-sm font-bold text-warning whitespace-nowrap">
                            {item.version}
                          </span>
                        )}
                        {item.archived && !item.version && (
                          <span className="text-xs text-foreground-subtle">Archived</span>
                        )}
                      </div>
                      <p className={cn(
                        'font-medium truncate',
                        item.archived ? 'text-foreground-subtle' : 'text-foreground'
                      )}>
                        {item.item_name?.name}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <ItemStatusBadge status={item.status} />
                        {item.archived && item.version && (
                          <span className="text-xs text-foreground-subtle">Archived</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {archivedCount > 0 && (
          <div className="p-4 border-t border-border flex-shrink-0">
            <Label className="flex items-center gap-2 text-sm text-foreground-muted cursor-pointer">
              <Checkbox
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked === true)}
              />
              Show archived ({archivedCount})
            </Label>
          </div>
        )}
      </aside>
    </>
  );
}
