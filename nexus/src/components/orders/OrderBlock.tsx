'use client';

import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { UserAccess } from '@/lib/auth/permissions';
import { createCategory, updateCategory } from '@/app/actions/categories';
import { createItemName, updateItemName } from '@/app/actions/itemNames';
import { createItem, updateItem } from '@/app/actions/items';
import { archiveOrder, createOrderItem, deleteOrder, reorderOrderItems, updateOrderDate } from '@/app/actions/orders';
import { CategoryForm } from '@/components/packaging/CategoryForm';
import { Category, ItemName, OrderItemWithDetails, PurchaseOrderWithItems } from '@/types/database';
import { ArtworkModal } from './ArtworkModal';
import { OrderItemRow } from './OrderItemRow';

interface OrderBlockProps {
  order: PurchaseOrderWithItems;
  itemNames: ItemName[];
  categories: Category[];
  access: UserAccess;
  artworkStatusMap: Record<string, string>;
  itemStatusMap: Record<string, string>;
  itemsIdLookup: Record<string, string>;
  onDelete: (orderId: string) => void;
  onArchive: (orderId: string) => void;
  onOrderItemsChange: (orderId: string, items: OrderItemWithDetails[]) => void;
  onCategoriesChange: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DatePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(value + 'T00:00:00'));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!disabled) {
            setOpen((p) => !p);
          }
        }}
        className="text-xs text-foreground hover:text-primary underline underline-offset-2 decoration-dashed disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
      >
        {formatDate(value)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-6 left-0 z-20 bg-surface-overlay border border-border rounded-lg shadow-lg p-3 w-56">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-surface-raised rounded">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-medium">{MONTHS[month]} {year}</span>
              <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-surface-raised rounded">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="text-[10px] text-foreground-subtle font-medium py-0.5">{d}</div>
              ))}
              {cells.map((day, idx) =>
                day === null ? (
                  <div key={idx} />
                ) : (
                  <button
                    key={idx}
                    onClick={() => {
                      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                      onChange(dateStr);
                      setOpen(false);
                    }}
                    className={`text-[11px] py-0.5 rounded hover:bg-primary-subtle hover:text-primary ${
                      value === `${year}-${pad(month + 1)}-${pad(day)}`
                        ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {day}
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function OrderBlock({
  order,
  itemNames,
  categories,
  access,
  artworkStatusMap,
  itemStatusMap,
  itemsIdLookup,
  onDelete,
  onArchive,
  onOrderItemsChange,
  onCategoriesChange,
}: OrderBlockProps) {
  const [orderItems, setOrderItems] = useState<OrderItemWithDetails[]>(order.order_items);
  const [addingItem, setAddingItem] = useState(false);
  const [artworkModalItem, setArtworkModalItem] = useState<OrderItemWithDetails | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [displayDate, setDisplayDate] = useState(order.order_date);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!access.canEditOrderItemDetails) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderItems.findIndex((item) => item.id === active.id);
    const newIndex = orderItems.findIndex((item) => item.id === over.id);

    const reordered = arrayMove(orderItems, oldIndex, newIndex);
    setOrderItems(reordered);
    onOrderItemsChange(order.id, reordered);

    const updates = reordered.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));
    await reorderOrderItems(updates);
  };

  const getItemKey = (oi: OrderItemWithDetails) => {
    if (!oi.item_name_id || !oi.category_id) return undefined;
    return `${oi.item_name_id}|${oi.category_id}|${oi.version ?? ''}`;
  };

  const getArtworkStatus = (oi: OrderItemWithDetails) => {
    const key = getItemKey(oi);
    if (!key) return undefined;
    const itemId = itemsIdLookup[key];
    return itemId ? artworkStatusMap[itemId] : undefined;
  };

  const getPackagingItemId = (oi: OrderItemWithDetails) => {
    const key = getItemKey(oi);
    if (!key) return undefined;
    return itemsIdLookup[key];
  };

  const getPackagingItemStatus = (oi: OrderItemWithDetails) => {
    const key = getItemKey(oi);
    if (!key) return undefined;
    const itemId = itemsIdLookup[key];
    return itemId ? itemStatusMap[itemId] : undefined;
  };

  const handleAddItem = async () => {
    if (!access.canAddOrderItems) return;
    setAddingItem(true);
    try {
      const newItem = await createOrderItem(order.id);
      const updated = [...orderItems, newItem];
      setOrderItems(updated);
      onOrderItemsChange(order.id, updated);
    } finally {
      setAddingItem(false);
    }
  };

  const handleDateChange = async (date: string) => {
    if (!access.canEditOrderDate) return;
    setDisplayDate(date);
    await updateOrderDate(order.id, date);
  };

  const handleDeleteOrder = async () => {
    if (!access.canArchiveOrders) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteOrder(order.id);
    onDelete(order.id);
  };

  const handleArchiveOrder = async () => {
    if (!access.canArchiveOrders) return;
    setIsArchiving(true);
    try {
      await archiveOrder(order.id, !order.archived);
      onArchive(order.id);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleItemChange = (updated: OrderItemWithDetails) => {
    const newItems = orderItems.map((oi) => (oi.id === updated.id ? updated : oi));
    setOrderItems(newItems);
    onOrderItemsChange(order.id, newItems);
  };

  const handleItemDelete = (id: string) => {
    const newItems = orderItems.filter((oi) => oi.id !== id);
    setOrderItems(newItems);
    onOrderItemsChange(order.id, newItems);
  };

  return (
    <>
      <div className="bg-surface border border-border rounded-lg shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised rounded-t-lg">
          <div className="flex items-center gap-4">
            <span className="font-bold text-foreground text-sm font-mono">{order.order_number}</span>
            <DatePicker value={displayDate} onChange={handleDateChange} disabled={!access.canEditOrderDate} />
          </div>
          <div className="flex items-center gap-1">
            {access.canArchiveOrders && (
              <>
                <button
                  onClick={handleArchiveOrder}
                  disabled={isArchiving}
                  title={order.archived ? 'Unarchive order' : 'Archive order'}
                  className="p-1.5 rounded transition-colors text-foreground-subtle hover:text-foreground hover:bg-surface-overlay disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </button>
                <button
                  onClick={handleDeleteOrder}
                  title={confirmDelete ? 'Click again to confirm' : 'Delete order'}
                  className={`p-1.5 rounded transition-colors ${
                    confirmDelete
                      ? 'bg-destructive text-white hover:bg-destructive/90'
                      : 'text-foreground-subtle hover:text-destructive hover:bg-destructive-subtle'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex items-center w-max min-w-full px-2 py-1 bg-surface-raised border-b border-border text-[10px] font-medium text-foreground-subtle uppercase tracking-wide">
              <span className="w-5 shrink-0" />
              <span className="w-24 shrink-0 ml-1.5">Priority</span>
              <span className="w-14 shrink-0 ml-1.5">Status</span>
              <span className="w-56 shrink-0 ml-1.5">Item</span>
              <span className="w-[8.4rem] shrink-0 ml-1.5">Category</span>
              <span className="w-[4.8rem] shrink-0 ml-1.5 text-right">QTY</span>
              {access.canViewArtworkFields && <span className="w-20 shrink-0 ml-1.5">Version</span>}
              {access.canViewArtworkFields && <span className="w-[5.5rem] shrink-0 ml-1.5">Approval</span>}
              {access.canOpenArtworkModal && <span className="w-10 shrink-0 ml-2 text-center">Art</span>}
              <span className="flex-1 min-w-[200px] ml-1.5">Notes</span>
              <span className="w-5 shrink-0 ml-1.5" />
            </div>

            {orderItems.length === 0 ? (
              <div className="px-4 py-3 text-xs text-foreground-subtle italic">No items yet</div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderItems.map((oi) => oi.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {orderItems.map((oi) => (
                    <OrderItemRow
                      key={oi.id}
                      access={access}
                      orderItem={oi}
                      itemNames={itemNames}
                      categories={categories}
                      artworkStatus={getArtworkStatus(oi)}
                      packagingItemId={getPackagingItemId(oi)}
                      packagingItemStatus={getPackagingItemStatus(oi)}
                      onOpenArtwork={setArtworkModalItem}
                      onDelete={handleItemDelete}
                      onChange={handleItemChange}
                      onCreateItemName={createItemName}
                      onUpdateItemName={updateItemName}
                      onCreateCategory={(prefillName) => {
                        if (!access.canManageCategories) return;
                        setNewCategoryName(prefillName || '');
                        setCreatingCategory(true);
                      }}
                      onEditCategory={access.canManageCategories ? setEditingCategory : undefined}
                      onUpdatePackagingItemStatus={async (itemId, status) => {
                        await updateItem(itemId, { status });
                      }}
                      onCreatePackagingItem={async (itemNameId, categoryId, version) => {
                        await createItem({
                          item_name_id: itemNameId,
                          category_id: categoryId,
                          version,
                        });
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {access.canAddOrderItems && (
          <div className="px-2 py-2 border-t border-border">
            <button
              onClick={handleAddItem}
              disabled={addingItem}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-foreground-muted hover:text-primary hover:bg-primary-subtle rounded border border-dashed border-border hover:border-primary/50 transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addingItem ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        )}
      </div>

      {artworkModalItem && access.canOpenArtworkModal && (
        <ArtworkModal
          orderItem={artworkModalItem}
          access={access}
          onClose={() => setArtworkModalItem(null)}
        />
      )}

      {creatingCategory && access.canManageCategories && (
        <CategoryForm
          initialName={newCategoryName}
          onSubmit={async (data) => {
            await createCategory(data);
            setCreatingCategory(false);
            onCategoriesChange();
          }}
          onCancel={() => setCreatingCategory(false)}
        />
      )}
      {editingCategory && access.canManageCategories && (
        <CategoryForm
          category={editingCategory}
          onSubmit={async (data) => {
            await updateCategory(editingCategory.id, data);
            setEditingCategory(null);
            onCategoriesChange();
          }}
          onCancel={() => setEditingCategory(null)}
        />
      )}
    </>
  );
}
