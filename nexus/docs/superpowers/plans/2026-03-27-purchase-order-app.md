# Purchase Order App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global navigation sidebar, purchase orders management page with compact inline-editable order items, artwork upload modal, and real-time artwork status updates; rename `packaging_items` → `items` throughout the entire codebase.

**Architecture:** A new `AppNav` global sidebar lives in `(protected)/layout.tsx` and wraps all protected pages. `packaging_items` is renamed to `items` in the DB and all TypeScript/component references. Purchase orders are stored in new `purchase_orders` and `order_items` tables; per-org order number format (prefix + padding) is stored in `org_order_settings`. A Postgres function handles atomic sequence generation. Supabase Realtime watches `upload_sessions` on the orders page to show live artwork status on each order item.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (Postgres + Auth + Storage + Realtime), Tailwind CSS

---

## File Map

**New files:**
- `src/components/layout/AppNav.tsx` — Collapsible global left nav with links to PAMS, Orders, Invoices, Shipments
- `src/app/(protected)/orders/page.tsx` — Purchase orders page
- `src/app/(protected)/invoices/page.tsx` — Placeholder page
- `src/app/(protected)/shipments/page.tsx` — Placeholder page
- `src/app/actions/items.ts` — Renamed from `packaging.ts`; queries `items` table
- `src/app/actions/orders.ts` — CRUD for purchase_orders and order_items
- `src/components/orders/OrderItemRow.tsx` — Compact inline-editable order item row
- `src/components/orders/ArtworkModal.tsx` — Upload modal (item info + dropzone + history)
- `src/components/orders/OrderBlock.tsx` — Single order card with header + item rows
- `src/components/orders/index.ts` — Exports

**Modified files:**
- `src/types/database.ts` — Rename `PackagingItem`→`Item`, `PackagingItemWithCategory`→`ItemWithCategory`; add `PurchaseOrder`, `OrderItem`, `OrgOrderSettings` types
- `src/app/actions/packaging.ts` — **Delete** (replaced by `items.ts`)
- `src/app/actions/uploads.ts` — Change `packaging_items` table ref to `items`
- `src/app/actions/settings.ts` — Add `getOrgOrderSettings`, `upsertOrgOrderSettings`
- `src/components/layout/Sidebar.tsx` — Update `PackagingItemWithCategory` → `ItemWithCategory`
- `src/components/layout/index.ts` — Add `AppNav` export
- `src/app/(protected)/layout.tsx` — Add `AppNav` wrapper shell
- `src/app/(protected)/page.tsx` — Update imports; change root from `h-screen` to `flex-1`
- `src/app/(protected)/settings/page.tsx` — Add order number format section; change root
- `src/app/(protected)/admin/page.tsx` — Change root div

---

## Task 1: DB Migration — Run SQL in Supabase

**Files:** Run in Supabase SQL Editor (Dashboard → SQL Editor)

- [ ] **Step 1: Run the full migration SQL**

Open Supabase Dashboard → SQL Editor → New Query. Paste and run:

```sql
-- 1. Rename packaging_items to items
ALTER TABLE packaging_items RENAME TO items;

-- 2. Add current_sequence to a new org_order_settings table
CREATE TABLE org_order_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  order_prefix     TEXT NOT NULL DEFAULT 'PO',
  order_padding    INT  NOT NULL DEFAULT 5,
  current_sequence INT  NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create purchase_orders table
CREATE TABLE purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number    TEXT NOT NULL,
  order_sequence  INT  NOT NULL,
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, order_sequence)
);

-- 4. Create order_items table
CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_name_id      UUID REFERENCES item_names(id),
  category_id       UUID REFERENCES categories(id),
  version           TEXT,
  approval_status   TEXT DEFAULT 'new'
                    CHECK (approval_status IN ('new','in_progress','approved','superceded')),
  notes             TEXT,
  order_qty         INT,
  item_order_status TEXT NOT NULL DEFAULT 'new'
                    CHECK (item_order_status IN ('new','final','cancel')),
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_order_settings ENABLE ROW LEVEL SECURITY;

-- 6. RLS: purchase_orders
CREATE POLICY "org members can select orders"
  ON purchase_orders FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org members can insert orders"
  ON purchase_orders FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org members can update orders"
  ON purchase_orders FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org members can delete orders"
  ON purchase_orders FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- 7. RLS: order_items
CREATE POLICY "org members can select order items"
  ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM purchase_orders
    WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "org members can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM purchase_orders
    WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "org members can update order items"
  ON order_items FOR UPDATE
  USING (order_id IN (
    SELECT id FROM purchase_orders
    WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY "org members can delete order items"
  ON order_items FOR DELETE
  USING (order_id IN (
    SELECT id FROM purchase_orders
    WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  ));

-- 8. RLS: org_order_settings (all org members can read; all can write for now)
CREATE POLICY "org members can select settings"
  ON org_order_settings FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "org members can upsert settings"
  ON org_order_settings FOR ALL
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- 9. Postgres function: create order with atomic sequence increment
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_organization_id UUID,
  p_order_date      DATE,
  p_created_by      UUID
) RETURNS purchase_orders AS $$
DECLARE
  v_prefix   TEXT;
  v_padding  INT;
  v_sequence INT;
  v_number   TEXT;
  v_order    purchase_orders%ROWTYPE;
BEGIN
  -- Ensure settings row exists with defaults, then increment sequence
  INSERT INTO org_order_settings (organization_id, order_prefix, order_padding, current_sequence)
  VALUES (p_organization_id, 'PO', 5, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE org_order_settings
  SET current_sequence = current_sequence + 1,
      updated_at = NOW()
  WHERE organization_id = p_organization_id
  RETURNING order_prefix, order_padding, current_sequence
  INTO v_prefix, v_padding, v_sequence;

  v_number := v_prefix || '-' || LPAD(v_sequence::TEXT, v_padding, '0');

  INSERT INTO purchase_orders (organization_id, order_number, order_sequence, order_date, created_by)
  VALUES (p_organization_id, v_number, v_sequence, p_order_date, p_created_by)
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
-- If upload_sessions is not already in realtime, add it:
ALTER PUBLICATION supabase_realtime ADD TABLE upload_sessions;
```

- [ ] **Step 2: Verify tables exist**

In SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('items','purchase_orders','order_items','org_order_settings');
```
Expected: 4 rows returned.

---

## Task 2: Rename TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/types/database.ts
export type UserRole = 'user' | 'admin';
export type DimensionUnit = 'mm' | 'cm' | 'in';
export type UploadStatus = 'uploaded' | 'approved' | 'rejected';
export type ItemStatus = 'new' | 'in_progress' | 'approved' | 'superceded';
export type ItemOrderStatus = 'new' | 'final' | 'cancel';

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  unit: DimensionUnit;
  color: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductLine {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
}

export interface ItemName {
  id: string;
  name: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  item_name_id: string;
  category_id: string | null;
  product_line_id: string | null;
  version: string | null;
  status: ItemStatus;
  archived: boolean;
  organization_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemWithCategory extends Item {
  item_name: ItemName;
  category: Category | null;
  product_line: ProductLine | null;
}

export interface UploadSession {
  id: string;
  packaging_id: string;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
  status: UploadStatus;
  archived: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadSessionWithDetails extends UploadSession {
  files: FileRecord[];
  uploader?: User;
}

export interface FileRecord {
  id: string;
  upload_session_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string;
  storage_path: string;
  created_at: string;
}

export interface OrgOrderSettings {
  organization_id: string;
  order_prefix: string;
  order_padding: number;
  current_sequence: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  organization_id: string;
  order_number: string;
  order_sequence: number;
  order_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_name_id: string | null;
  category_id: string | null;
  version: string | null;
  approval_status: ItemStatus | null;
  notes: string | null;
  order_qty: number | null;
  item_order_status: ItemOrderStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemWithDetails extends OrderItem {
  item_name: ItemName | null;
  category: Category | null;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  order_items: OrderItemWithDetails[];
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, 'id'>>;
      };
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Organization, 'id'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Category, 'id'>>;
      };
      product_lines: {
        Row: ProductLine;
        Insert: Omit<ProductLine, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProductLine, 'id'>>;
      };
      item_names: {
        Row: ItemName;
        Insert: Omit<ItemName, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ItemName, 'id'>>;
      };
      items: {
        Row: Item;
        Insert: Omit<Item, 'id' | 'created_at' | 'updated_at' | 'archived' | 'product_line_id' | 'version' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
          product_line_id?: string | null;
          version?: string | null;
          status?: ItemStatus;
        };
        Update: Partial<Omit<Item, 'id'>>;
      };
      upload_sessions: {
        Row: UploadSession;
        Insert: Omit<UploadSession, 'id' | 'created_at' | 'updated_at' | 'uploaded_at' | 'status'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          uploaded_at?: string;
          status?: UploadStatus;
        };
        Update: Partial<Omit<UploadSession, 'id'>>;
      };
      files: {
        Row: FileRecord;
        Insert: Omit<FileRecord, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<FileRecord, 'id'>>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'order_number' | 'order_sequence'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PurchaseOrder, 'id'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at' | 'updated_at' | 'item_order_status' | 'sort_order'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          item_order_status?: ItemOrderStatus;
          sort_order?: number;
        };
        Update: Partial<Omit<OrderItem, 'id'>>;
      };
      org_order_settings: {
        Row: OrgOrderSettings;
        Insert: Omit<OrgOrderSettings, 'created_at' | 'updated_at' | 'current_sequence'> & {
          created_at?: string;
          updated_at?: string;
          current_sequence?: number;
        };
        Update: Partial<Omit<OrgOrderSettings, 'organization_id'>>;
      };
    };
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd pams && npm run build 2>&1 | head -50
```
Expected: many errors about `PackagingItem` not found — that's correct, you haven't updated the other files yet.

---

## Task 3: Create items.ts (renamed packaging actions)

**Files:**
- Create: `src/app/actions/items.ts`
- Delete: `src/app/actions/packaging.ts`

- [ ] **Step 1: Create `src/app/actions/items.ts`**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { ItemWithCategory, ItemStatus } from '@/types/database';
import { revalidatePath } from 'next/cache';

export async function getItems(): Promise<ItemWithCategory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('items')
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ItemWithCategory[];
}

export async function getItem(id: string): Promise<ItemWithCategory | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('items')
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ItemWithCategory;
}

export async function createItem(data: {
  item_name_id: string;
  category_id: string;
  product_line_id?: string | null;
  version?: string | null;
}): Promise<ItemWithCategory> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: item, error } = await supabase
    .from('items')
    .insert({
      item_name_id: data.item_name_id,
      category_id: data.category_id,
      product_line_id: data.product_line_id || null,
      version: data.version || null,
      created_by: user.id,
    })
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .single();

  if (error) throw error;

  revalidatePath('/');
  return item as ItemWithCategory;
}

export async function updateItem(
  id: string,
  data: {
    item_name_id?: string;
    category_id?: string;
    product_line_id?: string | null;
    version?: string | null;
    status?: ItemStatus;
    archived?: boolean;
  }
): Promise<ItemWithCategory> {
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from('items')
    .update(data)
    .eq('id', id)
    .select('*, item_name:item_names(*), category:categories(*), product_line:product_lines(*)')
    .single();

  if (error) throw error;

  revalidatePath('/');
  return item as ItemWithCategory;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from('upload_sessions')
    .select('id')
    .eq('packaging_id', id);

  if (sessions) {
    for (const session of sessions) {
      const { data: files } = await supabase
        .from('files')
        .select('storage_path')
        .eq('upload_session_id', session.id);

      if (files && files.length > 0) {
        const paths = files.map((f) => f.storage_path);
        await supabase.storage.from('packaging-files').remove(paths);
      }
    }
  }

  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;

  revalidatePath('/');
}
```

- [ ] **Step 2: Delete the old packaging.ts**

```bash
rm pams/src/app/actions/packaging.ts
```

---

## Task 4: Update uploads.ts — fix table reference

**Files:**
- Modify: `src/app/actions/uploads.ts`

- [ ] **Step 1: Replace both `packaging_items` references with `items`**

In `src/app/actions/uploads.ts`, find the two places that say `.from('packaging_items')` and change them to `.from('items')`. There are two occurrences inside `createUploadSession`:

```typescript
  // Change this:
  const { data: packagingItem } = await supabase
    .from('packaging_items')
    .select('status')
    .eq('id', packagingId)
    .single();
  // ...
  await supabase
    .from('packaging_items')
    .update(updateData)
    .eq('id', packagingId);

  // To this:
  const { data: packagingItem } = await supabase
    .from('items')
    .select('status')
    .eq('id', packagingId)
    .single();
  // ...
  await supabase
    .from('items')
    .update(updateData)
    .eq('id', packagingId);
```

---

## Task 5: Update component files — rename type references

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/(protected)/page.tsx`
- Modify: `src/app/(protected)/admin/page.tsx` (if it imports packaging types)

- [ ] **Step 1: Update Sidebar.tsx**

In `src/components/layout/Sidebar.tsx`, change line 4:
```typescript
// From:
import { PackagingItemWithCategory } from '@/types/database';
// To:
import { ItemWithCategory } from '@/types/database';
```

Change the interface on line 8:
```typescript
// From:
interface SidebarProps {
  items: PackagingItemWithCategory[];
  selectedId: string | null;
// To:
interface SidebarProps {
  items: ItemWithCategory[];
  selectedId: string | null;
```

- [ ] **Step 2: Update page.tsx imports and item state type**

In `src/app/(protected)/page.tsx`:

Change line 6 import:
```typescript
// From:
import { PackagingItemWithCategory, User, UploadSession, UploadSessionWithDetails, UploadStatus, Category, ProductLine, ItemName, FileRecord } from '@/types/database';
// To:
import { ItemWithCategory, User, UploadSession, UploadSessionWithDetails, UploadStatus, Category, ProductLine, ItemName, FileRecord } from '@/types/database';
```

Change line 14–18 import block (packaging actions → items actions):
```typescript
// From:
import {
  getPackagingItems,
  createPackagingItem,
  updatePackagingItem,
  deletePackagingItem,
} from '@/app/actions/packaging';
// To:
import {
  getItems,
  createItem,
  updateItem,
  deleteItem,
} from '@/app/actions/items';
```

Change the state declaration on line 66:
```typescript
// From:
const [items, setItems] = useState<PackagingItemWithCategory[]>([]);
// To:
const [items, setItems] = useState<ItemWithCategory[]>([]);
```

Change line 76:
```typescript
// From:
const [editingItem, setEditingItem] = useState<PackagingItemWithCategory | null>(null);
// To:
const [editingItem, setEditingItem] = useState<ItemWithCategory | null>(null);
```

Change the four server action calls throughout the file:
```typescript
// getPackagingItems()  → getItems()
// createPackagingItem( → createItem(
// updatePackagingItem( → updateItem(
// deletePackagingItem( → deleteItem(
```
There are roughly 8 call sites — use your editor's find & replace within the file.

- [ ] **Step 3: Check admin/page.tsx for packaging references**

```bash
grep -n "packaging\|PackagingItem" pams/src/app/(protected)/admin/page.tsx
```

If any matches, replace `PackagingItem` → `Item`, `PackagingItemWithCategory` → `ItemWithCategory`, and `from '@/app/actions/packaging'` → `from '@/app/actions/items'`.

- [ ] **Step 4: Verify no remaining packaging references**

```bash
grep -rn "PackagingItem\|packaging_items\|from '@/app/actions/packaging'" pams/src/
```

Expected: no output. If any remain, fix them before continuing.

- [ ] **Step 5: Verify build passes**

```bash
cd pams && npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors related to the rename. (There may be other pre-existing lint warnings — ignore those.)

- [ ] **Step 6: Commit**

```bash
cd pams && git add -A && git commit -m "refactor: rename packaging_items to items throughout codebase"
```

---

## Task 6: Global AppNav + Layout Update

**Files:**
- Create: `src/components/layout/AppNav.tsx`
- Modify: `src/components/layout/index.ts`
- Modify: `src/app/(protected)/layout.tsx`
- Modify: `src/app/(protected)/page.tsx` (root div)
- Modify: `src/app/(protected)/settings/page.tsx` (root div)
- Modify: `src/app/(protected)/admin/page.tsx` (root div)

- [ ] **Step 1: Create `src/components/layout/AppNav.tsx`**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'PAMS',
    href: '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Shipments',
    href: '/shipments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
];

export function AppNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-gray-900 flex flex-col transition-all duration-200 ease-in-out',
        expanded ? 'w-44' : 'w-14'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="h-14 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
        aria-label={expanded ? 'Collapse menu' : 'Expand menu'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d={expanded ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7' : 'M13 5l7 7-7 7M5 5l7 7-7 7'} />
        </svg>
      </button>

      <nav className="flex-1 flex flex-col gap-1 px-1 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={expanded ? undefined : item.label}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-md transition-colors text-sm font-medium',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {expanded && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Add AppNav to `src/components/layout/index.ts`**

Open the file and add the export:
```typescript
export { AppNav } from './AppNav';
```

- [ ] **Step 3: Update `src/app/(protected)/layout.tsx`**

Replace the entire file:
```typescript
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppNav } from '@/components/layout';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <AppNav />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update root div in `src/app/(protected)/page.tsx`**

Change the outermost return div from:
```tsx
<div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
```
to:
```tsx
<div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
```

Also update the loading state div from:
```tsx
<div className="min-h-screen flex items-center justify-center bg-gray-50">
```
to:
```tsx
<div className="flex flex-1 items-center justify-center bg-gray-50">
```

- [ ] **Step 5: Update root div in `src/app/(protected)/settings/page.tsx`**

Change:
```tsx
<div className="min-h-screen bg-gray-50 flex flex-col">
```
to:
```tsx
<div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
```

Also update the loading state div from `min-h-screen` to `flex flex-1`.

- [ ] **Step 6: Update root div in `src/app/(protected)/admin/page.tsx`**

Find the outermost wrapper div and change any `min-h-screen` or `h-screen` to `flex flex-1 flex-col overflow-hidden`.

Also update any loading state divs from `min-h-screen` to `flex flex-1`.

- [ ] **Step 7: Start dev server and verify AppNav appears**

```bash
cd pams && npm run dev
```

Open http://localhost:3000. You should see a dark left nav (collapsed, ~56px wide) with 4 icons. Click the toggle to expand and see labels. Click Orders — page doesn't exist yet, that's fine. PAMS link should highlight when on `/`.

- [ ] **Step 8: Commit**

```bash
cd pams && git add -A && git commit -m "feat: add global AppNav sidebar to protected layout"
```

---

## Task 7: Settings — Order Number Format

**Files:**
- Modify: `src/app/actions/settings.ts`
- Modify: `src/app/(protected)/settings/page.tsx`

- [ ] **Step 1: Add order settings functions to `src/app/actions/settings.ts`**

Append to the end of the file:
```typescript
export async function getOrgOrderSettings(): Promise<{ order_prefix: string; order_padding: number } | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData?.organization_id) return null;

  const { data, error } = await supabase
    .from('org_order_settings')
    .select('order_prefix, order_padding')
    .eq('organization_id', userData.organization_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return { order_prefix: 'PO', order_padding: 5 };
    throw error;
  }

  return data;
}

export async function upsertOrgOrderSettings(data: {
  order_prefix: string;
  order_padding: number;
}): Promise<void> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData?.organization_id) throw new Error('No organization');

  const { error } = await supabase
    .from('org_order_settings')
    .upsert({
      organization_id: userData.organization_id,
      order_prefix: data.order_prefix.trim().toUpperCase(),
      order_padding: Math.max(1, Math.min(10, data.order_padding)),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id' });

  if (error) throw error;
}
```

- [ ] **Step 2: Add order format section to `src/app/(protected)/settings/page.tsx`**

Add the imports at the top:
```typescript
import { getOrgOrderSettings, upsertOrgOrderSettings } from '@/app/actions/settings';
```

Add state inside the component (after existing state declarations):
```typescript
  const [orderPrefix, setOrderPrefix] = useState('PO');
  const [orderPadding, setOrderPadding] = useState(5);
  const [orderSettingsSaving, setOrderSettingsSaving] = useState(false);
  const [orderSettingsSaved, setOrderSettingsSaved] = useState(false);
```

Inside `loadData()`, add the order settings fetch:
```typescript
      const [userData, categoriesData, orderSettings] = await Promise.all([
        getCurrentUser(),
        getCategories(),
        getOrgOrderSettings(),
      ]);
      setUser(userData);
      setCategories(categoriesData);
      if (orderSettings) {
        setOrderPrefix(orderSettings.order_prefix);
        setOrderPadding(orderSettings.order_padding);
      }
```

Add a save handler (after handleDeleteCategory):
```typescript
  const handleSaveOrderSettings = async () => {
    setOrderSettingsSaving(true);
    setOrderSettingsSaved(false);
    try {
      await upsertOrgOrderSettings({ order_prefix: orderPrefix, order_padding: orderPadding });
      setOrderSettingsSaved(true);
      setTimeout(() => setOrderSettingsSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save order settings:', error);
      alert('Failed to save order settings');
    } finally {
      setOrderSettingsSaving(false);
    }
  };
```

Add the UI section inside `<main>`, after the categories card:
```tsx
          {/* Order Number Format */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Order Number Format</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Configures how purchase order numbers are generated (e.g. PO-00001)
              </p>
            </div>
            <div className="px-6 py-5 flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                <input
                  type="text"
                  value={orderPrefix}
                  onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="PO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number padding</label>
                <input
                  type="number"
                  value={orderPadding}
                  onChange={(e) => setOrderPadding(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={10}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Preview</p>
                <p className="text-sm font-mono text-gray-900 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                  {orderPrefix}-{String(1).padStart(orderPadding, '0')}
                </p>
              </div>
              <button
                onClick={handleSaveOrderSettings}
                disabled={orderSettingsSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm rounded-md transition-colors"
              >
                {orderSettingsSaving ? 'Saving...' : orderSettingsSaved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/settings. You should see the new "Order Number Format" section below categories. Change the prefix to "ORD" and padding to 4 — preview shows `ORD-0001`. Click Save.

- [ ] **Step 4: Commit**

```bash
cd pams && git add -A && git commit -m "feat: add order number format configuration to settings"
```

---

## Task 8: Placeholder Pages

**Files:**
- Create: `src/app/(protected)/invoices/page.tsx`
- Create: `src/app/(protected)/shipments/page.tsx`

- [ ] **Step 1: Create invoices placeholder**

```typescript
// src/app/(protected)/invoices/page.tsx
'use client';

import { Header } from '@/components/layout';

export default function InvoicesPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <Header user={null} />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invoices</h1>
          <p className="text-gray-500">Coming soon</p>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create shipments placeholder**

```typescript
// src/app/(protected)/shipments/page.tsx
'use client';

import { Header } from '@/components/layout';

export default function ShipmentsPage() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <Header user={null} />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Shipments</h1>
          <p className="text-gray-500">Coming soon</p>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Click Invoices and Shipments in the AppNav. Each should show the "Coming soon" placeholder.

- [ ] **Step 4: Commit**

```bash
cd pams && git add -A && git commit -m "feat: add invoices and shipments placeholder pages"
```

---

## Task 9: Orders Server Actions

**Files:**
- Create: `src/app/actions/orders.ts`

- [ ] **Step 1: Create `src/app/actions/orders.ts`**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import {
  PurchaseOrder,
  PurchaseOrderWithItems,
  OrderItem,
  OrderItemWithDetails,
  ItemStatus,
  ItemOrderStatus,
} from '@/types/database';
import { revalidatePath } from 'next/cache';

async function getOrgId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (error || !data?.organization_id) throw new Error('No organization found');
  return data.organization_id;
}

export async function getOrders(): Promise<PurchaseOrderWithItems[]> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      order_items (
        *,
        item_name:item_names(*),
        category:categories(*)
      )
    `)
    .eq('organization_id', orgId)
    .order('order_sequence', { ascending: false });

  if (error) throw error;

  return (data || []).map((order) => ({
    ...order,
    order_items: (order.order_items || []).sort(
      (a: OrderItem, b: OrderItem) => a.sort_order - b.sort_order
    ),
  })) as PurchaseOrderWithItems[];
}

export async function createOrder(): Promise<PurchaseOrder> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .rpc('create_purchase_order', {
      p_organization_id: orgId,
      p_order_date: today,
      p_created_by: user.id,
    });

  if (error) throw error;

  revalidatePath('/orders');
  return data as PurchaseOrder;
}

export async function updateOrderDate(orderId: string, orderDate: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('purchase_orders')
    .update({ order_date: orderDate, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) throw error;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', orderId);

  if (error) throw error;

  revalidatePath('/orders');
}

export async function createOrderItem(orderId: string): Promise<OrderItemWithDetails> {
  const supabase = await createClient();

  // Get current max sort_order for this order
  const { data: existing } = await supabase
    .from('order_items')
    .select('sort_order')
    .eq('order_id', orderId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('order_items')
    .insert({
      order_id: orderId,
      item_order_status: 'new',
      sort_order: nextSortOrder,
    })
    .select('*, item_name:item_names(*), category:categories(*)')
    .single();

  if (error) throw error;
  return data as OrderItemWithDetails;
}

export async function updateOrderItem(
  itemId: string,
  data: {
    item_name_id?: string | null;
    category_id?: string | null;
    version?: string | null;
    approval_status?: ItemStatus | null;
    notes?: string | null;
    order_qty?: number | null;
    item_order_status?: ItemOrderStatus;
  }
): Promise<OrderItemWithDetails> {
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from('order_items')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*, item_name:item_names(*), category:categories(*)')
    .single();

  if (error) throw error;
  return updated as OrderItemWithDetails;
}

export async function deleteOrderItem(itemId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
}

/**
 * Returns a map of items.id → latest upload_session status
 * for all items referenced by the given order_items.
 */
export async function getArtworkStatusMap(
  orderItems: { item_name_id: string | null; category_id: string | null; version: string | null }[]
): Promise<Record<string, string>> {
  const supabase = await createClient();

  // Find unique combinations
  const combos = orderItems.filter((oi) => oi.item_name_id && oi.category_id);
  if (combos.length === 0) return {};

  // Get all items records matching those combos
  const { data: matchedItems } = await supabase
    .from('items')
    .select('id, item_name_id, category_id, version');

  if (!matchedItems) return {};

  // For each combo, find the matching items.id
  const itemIds = combos.reduce<string[]>((acc, combo) => {
    const match = matchedItems.find(
      (i) =>
        i.item_name_id === combo.item_name_id &&
        i.category_id === combo.category_id &&
        (i.version ?? null) === (combo.version ?? null)
    );
    if (match && !acc.includes(match.id)) acc.push(match.id);
    return acc;
  }, []);

  if (itemIds.length === 0) return {};

  // Get latest upload_session for each items.id
  const { data: sessions } = await supabase
    .from('upload_sessions')
    .select('packaging_id, status, uploaded_at')
    .in('packaging_id', itemIds)
    .order('uploaded_at', { ascending: false });

  if (!sessions) return {};

  // Build map: items.id → latest session status
  const map: Record<string, string> = {};
  for (const session of sessions) {
    if (!map[session.packaging_id]) {
      map[session.packaging_id] = session.status;
    }
  }

  return map;
}

export async function getVersionsForItemCategory(
  itemNameId: string,
  categoryId: string
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('items')
    .select('version')
    .eq('item_name_id', itemNameId)
    .eq('category_id', categoryId)
    .not('version', 'is', null);

  if (error) throw error;

  return [...new Set((data || []).map((r) => r.version as string))].sort();
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd pams && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors from orders.ts.

---

## Task 10: OrderItemRow Component

**Files:**
- Create: `src/components/orders/OrderItemRow.tsx`

- [ ] **Step 1: Create `src/components/orders/OrderItemRow.tsx`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { OrderItemWithDetails, ItemName, Category, ItemStatus, ItemOrderStatus } from '@/types/database';
import { updateOrderItem, deleteOrderItem, getVersionsForItemCategory } from '@/app/actions/orders';

const APPROVAL_STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'superceded', label: 'Superceded' },
];

const ORDER_STATUS_OPTIONS: { value: ItemOrderStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'final', label: 'Final', color: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'cancel', label: 'Cancel', color: 'text-gray-500 bg-gray-50 border-gray-200' },
];

interface OrderItemRowProps {
  orderItem: OrderItemWithDetails;
  itemNames: ItemName[];
  categories: Category[];
  artworkStatus?: string; // latest upload_session status for this item
  onOpenArtwork: (orderItem: OrderItemWithDetails) => void;
  onDelete: (id: string) => void;
  onChange: (updated: OrderItemWithDetails) => void;
}

export function OrderItemRow({
  orderItem,
  itemNames,
  categories,
  artworkStatus,
  onOpenArtwork,
  onDelete,
  onChange,
}: OrderItemRowProps) {
  const [versions, setVersions] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Load versions whenever item_name_id or category_id changes
  useEffect(() => {
    if (orderItem.item_name_id && orderItem.category_id) {
      getVersionsForItemCategory(orderItem.item_name_id, orderItem.category_id).then(setVersions);
    } else {
      setVersions([]);
    }
  }, [orderItem.item_name_id, orderItem.category_id]);

  const update = useCallback(
    async (patch: Partial<OrderItemWithDetails>) => {
      const updated = await updateOrderItem(orderItem.id, patch);
      onChange(updated);
    },
    [orderItem.id, onChange]
  );

  const handleDelete = async () => {
    if (!confirm('Remove this item from the order?')) return;
    setDeleting(true);
    await deleteOrderItem(orderItem.id);
    onDelete(orderItem.id);
  };

  const artworkStatusColor =
    artworkStatus === 'approved'
      ? 'bg-green-100 text-green-700'
      : artworkStatus === 'rejected'
      ? 'bg-red-100 text-red-700'
      : artworkStatus === 'uploaded'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-400';

  const orderStatusStyle =
    ORDER_STATUS_OPTIONS.find((o) => o.value === orderItem.item_order_status)?.color ??
    ORDER_STATUS_OPTIONS[0].color;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 last:border-0 text-xs ${deleting ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Item Name */}
      <select
        value={orderItem.item_name_id ?? ''}
        onChange={(e) => update({ item_name_id: e.target.value || null, version: null, category_id: null })}
        className="flex-1 min-w-0 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">— Item —</option>
        {itemNames.map((n) => (
          <option key={n.id} value={n.id}>{n.name}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={orderItem.category_id ?? ''}
        onChange={(e) => update({ category_id: e.target.value || null, version: null })}
        className="w-28 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">— Cat —</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Version */}
      <select
        value={orderItem.version ?? ''}
        onChange={(e) => update({ version: e.target.value || null })}
        disabled={!orderItem.item_name_id || !orderItem.category_id}
        className="w-20 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">— Ver —</option>
        {versions.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      {/* Approval Status */}
      <select
        value={orderItem.approval_status ?? ''}
        onChange={(e) => update({ approval_status: (e.target.value as ItemStatus) || null })}
        className="w-28 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">— Status —</option>
        {APPROVAL_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Notes */}
      <input
        type="text"
        value={orderItem.notes ?? ''}
        onChange={(e) => update({ notes: e.target.value || null })}
        placeholder="Notes"
        className="flex-1 min-w-0 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Order QTY */}
      <input
        type="number"
        value={orderItem.order_qty ?? ''}
        onChange={(e) => update({ order_qty: e.target.value ? parseInt(e.target.value) : null })}
        placeholder="QTY"
        min={0}
        className="w-14 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
      />

      {/* Item Order Status */}
      <select
        value={orderItem.item_order_status}
        onChange={(e) => update({ item_order_status: e.target.value as ItemOrderStatus })}
        className={`w-20 border rounded px-1.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 ${orderStatusStyle}`}
      >
        {ORDER_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Artwork Button */}
      <button
        onClick={() => onOpenArtwork(orderItem)}
        title={artworkStatus ? `Artwork: ${artworkStatus}` : 'No artwork yet'}
        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${artworkStatusColor} border-gray-200 hover:opacity-80`}
      >
        Art
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
        aria-label="Remove item"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
```

---

## Task 11: ArtworkModal Component

**Files:**
- Create: `src/components/orders/ArtworkModal.tsx`

The modal replicates the right pane from PAMS: item info header, upload dropzone, upload history. It accepts an `orderItem` and looks up the corresponding `items` record to load/upload sessions.

- [ ] **Step 1: Create `src/components/orders/ArtworkModal.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { OrderItemWithDetails, UploadSessionWithDetails, UploadStatus, FileRecord, UploadSession, User } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { DropZone } from '@/components/uploads/DropZone';
import { UploadSessionCard } from '@/components/uploads/UploadSessionCard';
import { UploadProgress } from '@/components/uploads/UploadProgress';
import { CategoryBadge } from '@/components/ui';
import { sanitizeFileName } from '@/lib/utils';
import { createUploadSession, updateUploadSessionStatus, updateUploadSessionNotes, archiveUploadSession, deleteUploadSession } from '@/app/actions/uploads';

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

interface ArtworkModalProps {
  orderItem: OrderItemWithDetails;
  currentUser: User;
  onClose: () => void;
}

export function ArtworkModal({ orderItem, currentUser, onClose }: ArtworkModalProps) {
  const [itemsId, setItemsId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<UploadSessionWithDetails[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showArchivedUploads, setShowArchivedUploads] = useState(false);

  // Find the matching items record for this orderItem's combo
  useEffect(() => {
    if (!orderItem.item_name_id || !orderItem.category_id) {
      setSessionsLoading(false);
      return;
    }

    const supabase = createClient();
    supabase
      .from('items')
      .select('id')
      .eq('item_name_id', orderItem.item_name_id)
      .eq('category_id', orderItem.category_id)
      .then(({ data }) => {
        // Find matching version
        const match = (data || []).find((i: { id: string }) => {
          if (orderItem.version) {
            return true; // will filter below
          }
          return true;
        });
        // Re-query with version filter
        return supabase
          .from('items')
          .select('id')
          .eq('item_name_id', orderItem.item_name_id!)
          .eq('category_id', orderItem.category_id!)
          .eq('version', orderItem.version ?? '')
          .limit(1);
      })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setItemsId(data[0].id);
        } else {
          // Try without version match (null version)
          return createClient()
            .from('items')
            .select('id')
            .eq('item_name_id', orderItem.item_name_id!)
            .eq('category_id', orderItem.category_id!)
            .is('version', null)
            .limit(1);
        }
      })
      .then((result) => {
        if (result && result.data && result.data.length > 0) {
          setItemsId(result.data[0].id);
        }
        setSessionsLoading(false);
      });
  }, [orderItem.item_name_id, orderItem.category_id, orderItem.version]);

  // Load sessions when itemsId is known
  useEffect(() => {
    if (!itemsId) return;

    const supabase = createClient();
    supabase
      .from('upload_sessions')
      .select('*, files(*), uploader:users!uploaded_by(*)')
      .eq('packaging_id', itemsId)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setSessions(
            (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[]).map(
              (s) => ({ ...s, files: s.files || [], uploader: s.uploader ?? undefined })
            )
          );
        }
        setSessionsLoading(false);
      });
  }, [itemsId]);

  const handleFilesSelected = async (files: File[]) => {
    if (!itemsId) return;

    const supabase = createClient();
    const uploadingList: UploadingFile[] = files.map((f) => ({ file: f, progress: 0, status: 'pending' as const }));
    setUploadingFiles(uploadingList);

    const uploadedFiles: { name: string; size: number; type: string; storagePath: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadingFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const sanitized = sanitizeFileName(file.name);
      const storagePath = `${itemsId}/${Date.now()}_${sanitized}`;

      try {
        const { error } = await supabase.storage.from('packaging-files').upload(storagePath, file);
        if (error) throw error;
        uploadedFiles.push({ name: file.name, size: file.size, type: ext, storagePath });
        setUploadingFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'complete', progress: 100 } : f));
      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : f
          )
        );
      }
    }

    if (uploadedFiles.length > 0) {
      await createUploadSession(itemsId, uploadedFiles);
      // Refresh sessions
      const { data } = await supabase
        .from('upload_sessions')
        .select('*, files(*), uploader:users!uploaded_by(*)')
        .eq('packaging_id', itemsId)
        .order('uploaded_at', { ascending: false });
      if (data) {
        setSessions(
          (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[]).map(
            (s) => ({ ...s, files: s.files || [], uploader: s.uploader ?? undefined })
          )
        );
      }
    }

    setTimeout(() => setUploadingFiles([]), 2000);
  };

  const handleStatusChange = async (sessionId: string, status: UploadStatus) => {
    await updateUploadSessionStatus(sessionId, status);
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, status } : s));
  };

  const handleNotesChange = async (sessionId: string, notes: string) => {
    await updateUploadSessionNotes(sessionId, notes);
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, notes } : s));
  };

  const handleArchive = async (sessionId: string, archived: boolean) => {
    await archiveUploadSession(sessionId, archived);
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, archived } : s));
  };

  const handleDelete = async (sessionId: string) => {
    await deleteUploadSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">
                {orderItem.item_name?.name ?? '—'}
              </h2>
              {orderItem.version && (
                <span className="text-lg font-bold text-orange-500">{orderItem.version}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {orderItem.category ? (
                <CategoryBadge category={orderItem.category} />
              ) : (
                <span className="text-sm text-gray-400 italic">No category</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!orderItem.item_name_id || !orderItem.category_id ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Select an item and category first to upload artwork.
            </p>
          ) : !itemsId && !sessionsLoading ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No PAMS record found for this item + category + version combination.
              Create the item in PAMS first to enable artwork uploads.
            </p>
          ) : (
            <>
              {/* Upload area */}
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Upload Files</h3>
                {uploadingFiles.length > 0 ? (
                  <UploadProgress files={uploadingFiles} />
                ) : (
                  <DropZone onFilesSelected={handleFilesSelected} />
                )}
              </div>

              {/* Upload history */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Upload History</h3>
                  {sessions.some((s) => s.archived) && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showArchivedUploads}
                        onChange={(e) => setShowArchivedUploads(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Show archived
                    </label>
                  )}
                </div>
                {sessionsLoading ? (
                  <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>
                ) : sessions.filter((s) => showArchivedUploads || !s.archived).length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">No uploads yet</div>
                ) : (
                  <div className="space-y-3">
                    {sessions
                      .filter((s) => showArchivedUploads || !s.archived)
                      .map((session) => (
                        <UploadSessionCard
                          key={session.id}
                          session={session}
                          onStatusChange={handleStatusChange}
                          onNotesChange={handleNotesChange}
                          onArchive={handleArchive}
                          onDelete={handleDelete}
                          isAdmin={currentUser.role === 'admin'}
                        />
                      ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Task 12: OrderBlock Component

**Files:**
- Create: `src/components/orders/OrderBlock.tsx`

- [ ] **Step 1: Create `src/components/orders/OrderBlock.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { PurchaseOrderWithItems, OrderItemWithDetails, ItemName, Category, User } from '@/types/database';
import { updateOrderDate, createOrderItem, deleteOrder } from '@/app/actions/orders';
import { OrderItemRow } from './OrderItemRow';
import { ArtworkModal } from './ArtworkModal';

interface OrderBlockProps {
  order: PurchaseOrderWithItems;
  itemNames: ItemName[];
  categories: Category[];
  currentUser: User;
  artworkStatusMap: Record<string, string>; // items.id → latest upload status
  itemsIdLookup: Record<string, string>; // "nameId|catId|version" → items.id
  onDelete: (orderId: string) => void;
  onOrderItemsChange: (orderId: string, items: OrderItemWithDetails[]) => void;
}

// Returns a human-readable date string like "Mar 27, 2026"
function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="text-xs text-gray-700 hover:text-blue-600 underline underline-offset-2 decoration-dashed"
      >
        {formatDate(value)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-6 left-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-medium">{MONTHS[month]} {year}</span>
              <button
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                <div key={d} className="text-[10px] text-gray-400 font-medium py-0.5">{d}</div>
              ))}
              {cells.map((day, idx) =>
                day === null ? (
                  <div key={idx} />
                ) : (
                  <button
                    key={idx}
                    onClick={() => {
                      const pad = (n: number) => String(n).padStart(2, '0');
                      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                      onChange(dateStr);
                      setOpen(false);
                    }}
                    className={`text-[11px] py-0.5 rounded hover:bg-blue-100 hover:text-blue-700 ${
                      value === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        ? 'bg-blue-600 text-white hover:bg-blue-600 hover:text-white'
                        : 'text-gray-700'
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
  currentUser,
  artworkStatusMap,
  itemsIdLookup,
  onDelete,
  onOrderItemsChange,
}: OrderBlockProps) {
  const [orderItems, setOrderItems] = useState<OrderItemWithDetails[]>(order.order_items);
  const [addingItem, setAddingItem] = useState(false);
  const [artworkModalItem, setArtworkModalItem] = useState<OrderItemWithDetails | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getArtworkStatus = (oi: OrderItemWithDetails) => {
    if (!oi.item_name_id || !oi.category_id) return undefined;
    const key = `${oi.item_name_id}|${oi.category_id}|${oi.version ?? ''}`;
    const itemId = itemsIdLookup[key];
    return itemId ? artworkStatusMap[itemId] : undefined;
  };

  const handleAddItem = async () => {
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
    await updateOrderDate(order.id, date);
    // Optimistic update handled by parent re-render on realtime or manual
  };

  const handleDeleteOrder = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await deleteOrder(order.id);
    onDelete(order.id);
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Order header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4">
            <span className="font-bold text-gray-900 text-sm font-mono">{order.order_number}</span>
            <DatePicker value={order.order_date} onChange={handleDateChange} />
          </div>
          <button
            onClick={handleDeleteOrder}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            }`}
          >
            {confirmDelete ? 'Confirm delete' : 'Delete order'}
          </button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border-b border-gray-100 text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          <span className="flex-1 min-w-0">Item</span>
          <span className="w-28">Category</span>
          <span className="w-20">Version</span>
          <span className="w-28">Approval</span>
          <span className="flex-1 min-w-0">Notes</span>
          <span className="w-14 text-right">QTY</span>
          <span className="w-20">Status</span>
          <span className="w-10 text-center">Art</span>
          <span className="w-5" />
        </div>

        {/* Order items */}
        {orderItems.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-400 italic">No items yet</div>
        ) : (
          orderItems.map((oi) => (
            <OrderItemRow
              key={oi.id}
              orderItem={oi}
              itemNames={itemNames}
              categories={categories}
              artworkStatus={getArtworkStatus(oi)}
              onOpenArtwork={setArtworkModalItem}
              onDelete={handleItemDelete}
              onChange={handleItemChange}
            />
          ))
        )}

        {/* Add Item button */}
        <div className="px-2 py-2 border-t border-gray-100">
          <button
            onClick={handleAddItem}
            disabled={addingItem}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded border border-dashed border-gray-200 hover:border-blue-300 transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {addingItem ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      </div>

      {artworkModalItem && (
        <ArtworkModal
          orderItem={artworkModalItem}
          currentUser={currentUser}
          onClose={() => setArtworkModalItem(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/orders/index.ts`**

```typescript
export { OrderBlock } from './OrderBlock';
export { OrderItemRow } from './OrderItemRow';
export { ArtworkModal } from './ArtworkModal';
```

---

## Task 13: Orders Page

**Files:**
- Create: `src/app/(protected)/orders/page.tsx`

- [ ] **Step 1: Create `src/app/(protected)/orders/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout';
import { OrderBlock } from '@/components/orders';
import {
  PurchaseOrderWithItems,
  OrderItemWithDetails,
  ItemName,
  Category,
  User,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { getOrders, createOrder, getArtworkStatusMap } from '@/app/actions/orders';
import { getCategories } from '@/app/actions/categories';
import { getItemNames } from '@/app/actions/itemNames';
import { getCurrentUser } from '@/app/actions/users';

export default function OrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderWithItems[]>([]);
  const [itemNames, setItemNames] = useState<ItemName[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [artworkStatusMap, setArtworkStatusMap] = useState<Record<string, string>>({});
  // "nameId|catId|version" → items.id
  const [itemsIdLookup, setItemsIdLookup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, ordersData, itemNamesData, categoriesData] = await Promise.all([
          getCurrentUser(),
          getOrders(),
          getItemNames(),
          getCategories(),
        ]);
        setUser(userData);
        setOrders(ordersData);
        setItemNames(itemNamesData);
        setCategories(categoriesData);

        // Build artwork status map
        const allOrderItems = ordersData.flatMap((o) => o.order_items);
        await refreshArtworkStatus(allOrderItems);
      } catch (error) {
        console.error('Failed to load orders:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase Realtime: watch upload_sessions for artwork status changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('orders-upload-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upload_sessions' },
        async () => {
          // Re-fetch artwork status map when any upload session changes
          const allOrderItems = orders.flatMap((o) => o.order_items);
          await refreshArtworkStatus(allOrderItems);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const refreshArtworkStatus = async (allOrderItems: OrderItemWithDetails[]) => {
    const supabase = createClient();

    // Build the items ID lookup map
    const combos = allOrderItems.filter((oi) => oi.item_name_id && oi.category_id);
    if (combos.length === 0) return;

    const { data: matchedItems } = await supabase
      .from('items')
      .select('id, item_name_id, category_id, version');

    if (!matchedItems) return;

    const lookup: Record<string, string> = {};
    for (const combo of combos) {
      const match = matchedItems.find(
        (i: { id: string; item_name_id: string; category_id: string; version: string | null }) =>
          i.item_name_id === combo.item_name_id &&
          i.category_id === combo.category_id &&
          (i.version ?? null) === (combo.version ?? null)
      );
      if (match) {
        const key = `${combo.item_name_id}|${combo.category_id}|${combo.version ?? ''}`;
        lookup[key] = match.id;
      }
    }
    setItemsIdLookup(lookup);

    const itemIds = [...new Set(Object.values(lookup))];
    if (itemIds.length === 0) return;

    const { data: sessions } = await supabase
      .from('upload_sessions')
      .select('packaging_id, status, uploaded_at')
      .in('packaging_id', itemIds)
      .order('uploaded_at', { ascending: false });

    if (!sessions) return;

    const statusMap: Record<string, string> = {};
    for (const session of sessions as { packaging_id: string; status: string; uploaded_at: string }[]) {
      if (!statusMap[session.packaging_id]) {
        statusMap[session.packaging_id] = session.status;
      }
    }
    setArtworkStatusMap(statusMap);
  };

  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      const newOrder = await createOrder();
      const orderWithItems: PurchaseOrderWithItems = { ...newOrder, order_items: [] };
      setOrders((prev) => [orderWithItems, ...prev]);
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Make sure your organization is set up.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleOrderItemsChange = (orderId: string, items: OrderItemWithDetails[]) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, order_items: items } : o))
    );
    // Refresh artwork status with updated items
    const allOrderItems = orders
      .map((o) => (o.id === orderId ? { ...o, order_items: items } : o))
      .flatMap((o) => o.order_items);
    refreshArtworkStatus(allOrderItems);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-gray-50">
      <Header user={user} />

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <button
              onClick={handleCreateOrder}
              disabled={creatingOrder}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
            >
              {creatingOrder ? 'Creating...' : '+ Create New Order'}
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
              <p className="text-gray-500 mb-4">Create your first purchase order to get started.</p>
              <button
                onClick={handleCreateOrder}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Create New Order
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderBlock
                  key={order.id}
                  order={order}
                  itemNames={itemNames}
                  categories={categories}
                  currentUser={user!}
                  artworkStatusMap={artworkStatusMap}
                  itemsIdLookup={itemsIdLookup}
                  onDelete={handleDeleteOrder}
                  onOrderItemsChange={handleOrderItemsChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run the dev server and test end-to-end**

```bash
cd pams && npm run dev
```

Test checklist:
- Navigate to `/orders` via AppNav
- Click "Create New Order" → a new OrderBlock appears with the correct formatted order number
- Click "Add Item" → a blank row appears
- Select an item name, category → version dropdown populates with available versions
- Edit notes, qty, change status colours (New=red, Final=green, Cancel=grey)
- Click "Art" button → ArtworkModal opens with item info
- Upload a file in the modal → file appears in upload history
- In PAMS, approve that upload → return to Orders, the Art button colour should update in real-time (within seconds via Realtime)
- Change order number format in Settings → create another order and verify the format applies

- [ ] **Step 3: Verify build**

```bash
cd pams && npm run build 2>&1 | grep -E "error|Error" | head -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd pams && git add -A && git commit -m "feat: add purchase orders page with inline editing, artwork modal, and realtime updates"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Expandable/hideable global left sidebar with PAMS, Orders, Invoices, Shipments | Task 6 |
| Invoices + Shipments as placeholders | Task 8 |
| Rename packaging_items → items (DB + codebase) | Tasks 1–5 |
| Order # auto-assigned with custom format | Tasks 1, 7, 9 |
| Order date with DatePicker (inline calendar, month nav, click to set) | Task 12 |
| OrderItem fields: name, category, version, approval status, notes, qty, item order status | Task 10 |
| Version dropdown filtered by item+category combo | Task 10 |
| Item Order Status colours (New=red, Final=green, Cancel=grey) | Task 10 |
| Artwork button opens modal with right-pane layout | Tasks 11, 12 |
| Add Item button at bottom (adds blank row, Item Order Status=New by default) | Task 12 |
| Compact UI on OrderItems (small padding, font, spacing) | Task 10 |
| Fields editable directly without click-in | Task 10 |
| Create New Order button (auto fills order#, today's date, 1 blank item) | Task 13 |
| Upload artwork same as PAMS | Task 11 |
| Real-time artwork status update on OrderItem | Task 13 |
| Order format configured in Settings | Task 7 |
| Per-org order sequence | Tasks 1 (DB function), 9 |
| Orders scoped to org | Tasks 1 (RLS), 9 |
| All org users can see all orders | Task 1 (RLS: all org members) |
| New tables: purchase_orders, order_items | Task 1 |

**Note on "1 blank OrderItem already added" when creating an order:** The current `createOrder` action in Task 9 only creates the order record, not the first order item. After creating the order, the Orders page in Task 13 adds the order to state with `order_items: []`. To auto-add one blank item, update `handleCreateOrder` in `orders/page.tsx`:

```typescript
  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      const newOrder = await createOrder();
      // Auto-create one blank order item
      const { createOrderItem } = await import('@/app/actions/orders');
      const firstItem = await createOrderItem(newOrder.id);
      const orderWithItems: PurchaseOrderWithItems = { ...newOrder, order_items: [firstItem] };
      setOrders((prev) => [orderWithItems, ...prev]);
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order.');
    } finally {
      setCreatingOrder(false);
    }
  };
```

Add this fix to Step 1 of Task 13 (replace the `handleCreateOrder` function in orders/page.tsx with the version above).
