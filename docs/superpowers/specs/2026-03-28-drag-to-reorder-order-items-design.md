# Drag-to-Reorder Order Items — Design Spec

**Date:** 2026-03-28

## Overview

Add drag-to-reorder functionality to item rows inside each purchase order block. Users can grab a handle on any row to drag it up or down within the same order, changing the display order. The new order is persisted to the database immediately after each drop.

## Key Constraints

- The `order_items` table already has a `sort_order` (integer) column. Items are already fetched sorted by `sort_order` ascending. No schema migration needed.
- React 19 / Next.js 16 — must use a library compatible with React 19.

## Drag Handle UX

- A `⠿` (six-dot braille grid) icon is placed at the far **left** of each row, before the Priority column.
- The handle is **invisible by default** and becomes visible when the user hovers over the row (via Tailwind `group` / `group-hover`).
- Cursor is `grab` on hover; changes to `grabbing` while dragging.
- Dragging is restricted to within the same order block — items cannot be moved across orders.

## Drag Interaction

- When a row is lifted, it displays a slight box shadow and an indigo border to indicate it is active.
- A dashed placeholder slot appears at the drop target position so users can see where the item will land.
- The row list reorders immediately in local state when the drag ends (optimistic update).
- The new order is then persisted to the database via a server action.

## Library

`@dnd-kit/core` + `@dnd-kit/sortable` — the standard React drag-and-drop library, compatible with React 19, supports keyboard accessibility and touch.

## Architecture

### New dependency

```
@dnd-kit/core
@dnd-kit/sortable
```

### `src/app/actions/orders.ts` — new server action

```ts
reorderOrderItems(items: { id: string; sort_order: number }[]): Promise<void>
```

Updates `sort_order` for each provided item in Supabase. Called after every successful drag-and-drop.

### `OrderBlock.tsx` changes

- Wrap the items list with `DndContext` (from `@dnd-kit/core`) and `SortableContext` (from `@dnd-kit/sortable`), using item IDs as the sortable identifiers.
- Implement `handleDragEnd`:
  1. Use `arrayMove` to reorder the `orderItems` state array.
  2. Call `onOrderItemsChange` with the new order.
  3. Call `reorderOrderItems` with each item's new `sort_order` index.

### `OrderItemRow.tsx` changes

- Accept sortable props from a wrapping component or via `useSortable` hook.
- Render the drag handle element using the `attributes`, `listeners`, and `setNodeRef` values from `useSortable`.
- Apply `transform` and `transition` styles from `useSortable` to the row's root element to animate reordering.
- Use Tailwind `group` on the row root and `group-hover:opacity-100 opacity-0` on the handle span.

## Data Flow

```
User drops row
  → arrayMove() reorders local orderItems state  (immediate, optimistic)
  → onOrderItemsChange() propagates new order up to parent
  → reorderOrderItems() server action updates sort_order in Supabase
```

`sort_order` values are assigned as 0-based indices of the new array position (0, 1, 2, …) after each reorder.

## Out of Scope

- Dragging items between different purchase orders.
- Animated placeholder height matching the dragged row height (basic fixed-height placeholder is sufficient).
- Undo/redo of reordering.
