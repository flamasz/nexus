'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserAccess } from '@/lib/auth/permissions';
import { deleteOrderItem, getVersionsForItemCategory, updateOrderItem, VersionWithStatus } from '@/app/actions/orders';
import { CategorySelector } from '@/components/packaging/CategorySelector';
import { ItemNameCombobox } from '@/components/packaging/ItemNameCombobox';
import { ItemStatusDropdown } from '@/components/packaging/ItemStatusDropdown';
import { VersionCombobox } from '@/components/packaging/VersionCombobox';
import { ITEM_STATUS_CONFIG } from '@/lib/itemStatus';
import { Category, ItemName, ItemStatus, OrderItemWithDetails } from '@/types/database';
import { ItemOrderStatusDropdown } from './ItemOrderStatusDropdown';
import { PriorityDropdown } from './PriorityDropdown';

interface OrderItemRowProps {
  access: UserAccess;
  orderItem: OrderItemWithDetails;
  itemNames: ItemName[];
  categories: Category[];
  artworkStatus?: string;
  packagingItemId?: string;
  packagingItemStatus?: string;
  onOpenArtwork: (orderItem: OrderItemWithDetails) => void;
  onDelete: (id: string) => void;
  onChange: (updated: OrderItemWithDetails) => void;
  onCreateItemName: (name: string) => Promise<ItemName>;
  onUpdateItemName: (id: string, name: string) => Promise<ItemName>;
  onCreateCategory: (prefillName?: string) => void;
  onEditCategory?: (category: Category) => void;
  onUpdatePackagingItemStatus?: (itemId: string, status: ItemStatus) => Promise<void>;
  onCreatePackagingItem?: (itemNameId: string, categoryId: string, version: string) => Promise<void>;
}

function disableWrapper(disabled: boolean) {
  return disabled ? 'pointer-events-none opacity-60' : '';
}

export function OrderItemRow({
  access,
  orderItem,
  itemNames,
  categories,
  packagingItemId,
  packagingItemStatus,
  onOpenArtwork,
  onDelete,
  onChange,
  onCreateItemName,
  onUpdateItemName,
  onCreateCategory,
  onEditCategory,
  onUpdatePackagingItemStatus,
  onCreatePackagingItem,
}: OrderItemRowProps) {
  const [versions, setVersions] = useState<VersionWithStatus[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [localNotesOverride, setLocalNotesOverride] = useState<string | null>(null);
  const [localQtyOverride, setLocalQtyOverride] = useState<string | null>(null);
  const [localApprovalStatusOverride, setLocalApprovalStatusOverride] = useState<ItemStatus | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const qtyCursorRef = useRef<number | null>(null);
  const prevVersionKey = useRef<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: orderItem.id });

  const canEditOrderFields = access.canEditOrderItemDetails;
  const canViewArtworkFields = access.canViewArtworkFields;
  const canEditArtworkFields = access.canEditArtworkFields;
  const canOpenArtworkModal = access.canOpenArtworkModal;
  const canDeleteOrderItems = access.canDeleteOrderItems;

  const localNotes = localNotesOverride ?? (orderItem.notes ?? '');
  const localQty = localQtyOverride ?? (orderItem.order_qty ? orderItem.order_qty.toLocaleString() : '');

  const shouldFetchVersions = Boolean(orderItem.item_name_id && orderItem.category_id);
  const versionKey = shouldFetchVersions ? `${orderItem.item_name_id}-${orderItem.category_id}` : null;

  if (versionKey !== prevVersionKey.current) {
    if (!versionKey && versions.length > 0) {
      setVersions([]);
    }
    prevVersionKey.current = versionKey;
  }

  useEffect(() => {
    if (!orderItem.item_name_id || !orderItem.category_id) return;

    let cancelled = false;
    getVersionsForItemCategory(orderItem.item_name_id, orderItem.category_id).then((v) => {
      if (!cancelled) setVersions(v);
    });
    return () => {
      cancelled = true;
    };
  }, [orderItem.item_name_id, orderItem.category_id]);

  const update = useCallback(
    async (patch: Partial<OrderItemWithDetails>) => {
      const updated = await updateOrderItem(orderItem.id, patch);
      onChange(updated);
    },
    [orderItem.id, onChange]
  );

  const handleNotesChange = (value: string) => {
    if (!canEditOrderFields) return;

    setLocalNotesOverride(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => {
      update({ notes: value || null }).then(() => {
        setLocalNotesOverride(null);
      });
    }, 600);
  };

  useEffect(() => {
    if (qtyCursorRef.current !== null && qtyInputRef.current && document.activeElement === qtyInputRef.current) {
      const pos = qtyCursorRef.current;
      qtyInputRef.current.setSelectionRange(pos, pos);
      qtyCursorRef.current = null;
    }
  }, [localQty]);

  const posToDigitIndex = (str: string, pos: number) => {
    let digits = 0;
    for (let i = 0; i < pos; i++) {
      if (str[i] !== ',') digits++;
    }
    return digits;
  };

  const digitIndexToPos = (str: string, digitIdx: number) => {
    let digits = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== ',') {
        if (digits === digitIdx) return i;
        digits++;
      }
    }
    return str.length;
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditOrderFields) return;

    const newRaw = e.target.value.replace(/[^0-9]/g, '');
    const formatted = newRaw ? parseInt(newRaw).toLocaleString() : '';
    const cursorInNew = e.target.selectionStart ?? 0;
    const digitsBeforeCursor = posToDigitIndex(e.target.value, cursorInNew);
    qtyCursorRef.current = digitIndexToPos(formatted, digitsBeforeCursor);

    setLocalQtyOverride(formatted);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!canEditOrderFields) return;

    if (e.key === 'Enter') {
      e.currentTarget.blur();
      return;
    }

    const input = e.currentTarget;
    const pos = input.selectionStart ?? 0;

    if (e.key === 'ArrowLeft' && pos > 0 && localQty[pos - 1] === ',') {
      e.preventDefault();
      input.setSelectionRange(pos - 1, pos - 1);
      return;
    }
    if (e.key === 'ArrowRight' && pos < localQty.length && localQty[pos] === ',') {
      e.preventDefault();
      input.setSelectionRange(pos + 1, pos + 1);
      return;
    }

    if (e.key === 'Backspace' && pos > 0 && localQty[pos - 1] === ',') {
      e.preventDefault();
      const digitIdx = posToDigitIndex(localQty, pos - 1);
      const raw = localQty.replace(/[^0-9]/g, '');
      const newRaw = raw.slice(0, digitIdx - 1) + raw.slice(digitIdx);
      const formatted = newRaw ? parseInt(newRaw).toLocaleString() : '';
      qtyCursorRef.current = digitIndexToPos(formatted, digitIdx - 1);
      setLocalQtyOverride(formatted);
      return;
    }

    if (e.key === 'Delete' && pos < localQty.length && localQty[pos] === ',') {
      e.preventDefault();
      const digitIdx = posToDigitIndex(localQty, pos);
      const raw = localQty.replace(/[^0-9]/g, '');
      const newRaw = raw.slice(0, digitIdx) + raw.slice(digitIdx + 1);
      const formatted = newRaw ? parseInt(newRaw).toLocaleString() : '';
      qtyCursorRef.current = digitIndexToPos(formatted, digitIdx);
      setLocalQtyOverride(formatted);
    }
  };

  const handleQtyCommit = () => {
    if (!canEditOrderFields) return;

    const raw = localQty.replace(/[^0-9]/g, '');
    const newVal = raw ? parseInt(raw) : null;
    if (newVal !== orderItem.order_qty) {
      update({ order_qty: newVal }).then(() => {
        setLocalQtyOverride(null);
      });
    } else {
      setLocalQtyOverride(null);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteOrderItems) return;
    if (!confirm('Remove this item from the order?')) return;
    setDeleting(true);
    await deleteOrderItem(orderItem.id);
    onDelete(orderItem.id);
  };

  const effectiveApprovalStatus =
    localApprovalStatusOverride ?? (packagingItemStatus as ItemStatus) ?? orderItem.approval_status ?? 'new';
  const approvalConfig = ITEM_STATUS_CONFIG[effectiveApprovalStatus];
  const artBtnColor = approvalConfig
    ? `${approvalConfig.bg} ${approvalConfig.text} ${approvalConfig.border}`
    : 'bg-gray-100 text-gray-400 border-gray-200';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center w-max min-w-full px-2 py-1.5 border-b border-border last:border-0 text-xs bg-surface-raised ${
        isDragging ? 'shadow-lg rounded-lg border border-primary z-10' : ''
      } ${deleting ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <span
        {...(canEditOrderFields ? attributes : {})}
        {...(canEditOrderFields ? listeners : {})}
        className={`w-5 shrink-0 flex items-center justify-center ${
          canEditOrderFields
            ? 'cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-foreground-subtle hover:text-foreground-muted'
            : 'opacity-0'
        }`}
      >
        ⠿
      </span>

      <div className={`w-24 shrink-0 ml-1.5 ${disableWrapper(!canEditOrderFields)}`}>
        <PriorityDropdown
          priority={orderItem.priority ?? '2_standard'}
          onPriorityChange={async (p) => {
            if (!canEditOrderFields) return;
            await update({ priority: p });
          }}
          variant="compact"
        />
      </div>

      <div className={`w-14 shrink-0 ml-1.5 ${disableWrapper(!canEditOrderFields)}`}>
        <ItemOrderStatusDropdown
          status={orderItem.item_order_status}
          onStatusChange={async (s) => {
            if (!canEditOrderFields) return;
            await update({ item_order_status: s });
          }}
          variant="compact"
        />
      </div>

      <div className={`w-56 shrink-0 ml-1.5 ${disableWrapper(!canEditOrderFields)}`}>
        <ItemNameCombobox
          itemNames={itemNames}
          selectedId={orderItem.item_name_id}
          onSelect={(id) => {
            if (!canEditOrderFields) return;
            update({ item_name_id: id, version: null, category_id: null });
          }}
          onCreate={onCreateItemName}
          onUpdate={onUpdateItemName}
          required={false}
          variant="compact"
        />
      </div>

      <div className={`w-[8.4rem] shrink-0 ml-1.5 ${disableWrapper(!canEditOrderFields)}`}>
        <CategorySelector
          categories={categories}
          selectedId={orderItem.category_id}
          onSelect={(id) => {
            if (!canEditOrderFields) return;
            update({ category_id: id, version: null });
          }}
          onCreateNew={onCreateCategory}
          onEdit={canEditOrderFields ? onEditCategory : undefined}
          variant="compact"
        />
      </div>

      <input
        ref={qtyInputRef}
        type="text"
        inputMode="numeric"
        value={localQty}
        onChange={handleQtyChange}
        onBlur={handleQtyCommit}
        onKeyDown={handleQtyKeyDown}
        placeholder="QTY"
        readOnly={!canEditOrderFields}
        className="w-[4.8rem] shrink-0 ml-1.5 border border-border rounded px-1.5 py-1 text-xs bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right read-only:cursor-default read-only:opacity-70"
      />

      {canViewArtworkFields && (
        <div className={`w-20 shrink-0 ml-1.5 ${disableWrapper(!canEditArtworkFields)}`}>
          <VersionCombobox
            versions={versions}
            selectedVersion={orderItem.version}
            onSelect={(v) => {
              if (!canEditArtworkFields) return;
              update({ version: v });
            }}
            onCreate={async (v) => {
              if (!canEditArtworkFields) return;
              await update({ version: v });
              if (orderItem.item_name_id && orderItem.category_id && onCreatePackagingItem) {
                await onCreatePackagingItem(orderItem.item_name_id, orderItem.category_id, v);
              }
            }}
            disabled={!orderItem.item_name_id || !orderItem.category_id}
            variant="compact"
          />
        </div>
      )}

      {canViewArtworkFields && (
        <div className={`w-[5.5rem] shrink-0 ml-1.5 ${disableWrapper(!canEditArtworkFields)}`}>
          <ItemStatusDropdown
            status={effectiveApprovalStatus}
            onStatusChange={async (s) => {
              if (!canEditArtworkFields) return;
              setLocalApprovalStatusOverride(s);
              if (packagingItemId && onUpdatePackagingItemStatus) {
                await onUpdatePackagingItemStatus(packagingItemId, s);
              } else {
                await update({ approval_status: s });
              }
            }}
            variant="compact"
          />
        </div>
      )}

      {canOpenArtworkModal && (
        <button
          onClick={() => onOpenArtwork(orderItem)}
          title={approvalConfig ? approvalConfig.label : 'No status'}
          className={`shrink-0 ml-2 px-2 py-1 rounded text-xs font-medium border transition-colors ${artBtnColor} hover:opacity-80`}
        >
          Art
        </button>
      )}

      <input
        type="text"
        value={localNotes}
        onChange={(e) => handleNotesChange(e.target.value)}
        placeholder="Notes"
        readOnly={!canEditOrderFields}
        className="flex-1 min-w-[200px] ml-1.5 border border-border rounded px-1.5 py-1 text-xs bg-surface text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-ring read-only:cursor-default read-only:opacity-70"
      />

      {canDeleteOrderItems ? (
        <button
          onClick={handleDelete}
          className="shrink-0 ml-1.5 p-1 text-foreground-subtle hover:text-destructive transition-colors"
          aria-label="Remove item"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <span className="w-5 shrink-0 ml-1.5" />
      )}
    </div>
  );
}
