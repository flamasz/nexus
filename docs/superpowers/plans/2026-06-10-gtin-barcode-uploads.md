# GTIN Tab Barcode Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the Items page "GS1" tab to "GTIN" and add a barcode-file upload area below the existing GS1 fields, listing uploaded files (icon + full name) above a drop zone.

**Architecture:** A new lightweight `barcode_files` table (no review/session workflow) tied to a `business_central_items` row, files stored in the existing `packaging-files` Supabase bucket under a `barcodes/` prefix. Server actions handle list/create/delete scoped to the active Business Central environment. A new `BarcodeUploadsPanel` renders inside the existing `gs1` tab beneath `Gs1FieldsPanel`.

**Tech Stack:** Next.js (App Router, server actions), React 19, Supabase (Postgres + Storage), TypeScript, Tailwind, lucide-react icons, Vitest.

**Working directory for all paths below:** `nexus/`

---

### Task 1: Pure barcode file-type helpers (TDD)

A small pure module holds the accepted extensions, a validation function, and an extension→icon mapping. This is the only genuinely unit-testable logic, so it is built test-first.

**Files:**
- Create: `nexus/src/lib/barcodeFiles.ts`
- Test: `nexus/src/lib/barcodeFiles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// nexus/src/lib/barcodeFiles.test.ts
import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_BARCODE_EXTENSIONS,
  filterAcceptedBarcodeFiles,
  iconNameForExtension,
} from './barcodeFiles';

function fakeFile(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

describe('ACCEPTED_BARCODE_EXTENSIONS', () => {
  it('includes the agreed image, pdf and vector formats', () => {
    expect(ACCEPTED_BARCODE_EXTENSIONS).toEqual([
      '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.eps', '.ai',
    ]);
  });
});

describe('filterAcceptedBarcodeFiles', () => {
  it('keeps accepted files and drops the rest', () => {
    const files = [fakeFile('a.png'), fakeFile('b.txt'), fakeFile('c.PDF')];
    const { accepted, rejectedCount } = filterAcceptedBarcodeFiles(files);
    expect(accepted.map((f) => f.name)).toEqual(['a.png', 'c.PDF']);
    expect(rejectedCount).toBe(1);
  });
});

describe('iconNameForExtension', () => {
  it('maps image extensions to FileImage', () => {
    expect(iconNameForExtension('.png')).toBe('FileImage');
    expect(iconNameForExtension('.svg')).toBe('FileImage');
  });
  it('maps pdf to FileText', () => {
    expect(iconNameForExtension('.pdf')).toBe('FileText');
  });
  it('falls back to File for vector/other', () => {
    expect(iconNameForExtension('.ai')).toBe('File');
    expect(iconNameForExtension('.eps')).toBe('File');
    expect(iconNameForExtension('.zzz')).toBe('File');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nexus && npx vitest run src/lib/barcodeFiles.test.ts`
Expected: FAIL — cannot resolve `./barcodeFiles`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// nexus/src/lib/barcodeFiles.ts
export const ACCEPTED_BARCODE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.eps', '.ai',
] as const;

export function extensionOf(fileName: string): string {
  const parts = fileName.split('.');
  if (parts.length < 2) return '';
  return '.' + parts.pop()!.toLowerCase();
}

export function filterAcceptedBarcodeFiles(
  files: File[]
): { accepted: File[]; rejectedCount: number } {
  const accepted = files.filter((file) =>
    (ACCEPTED_BARCODE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))
  );
  return { accepted, rejectedCount: files.length - accepted.length };
}

export type BarcodeIconName = 'FileImage' | 'FileText' | 'File';

export function iconNameForExtension(ext: string): BarcodeIconName {
  const lower = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.svg'].includes(lower)) return 'FileImage';
  if (lower === '.pdf') return 'FileText';
  return 'File';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nexus && npx vitest run src/lib/barcodeFiles.test.ts`
Expected: PASS (3 suites, all green).

- [ ] **Step 5: Commit**

```bash
git add nexus/src/lib/barcodeFiles.ts nexus/src/lib/barcodeFiles.test.ts
git commit -m "feat: add barcode file-type helpers"
```

---

### Task 2: Database migration for `barcode_files`

**Files:**
- Create: `nexus/supabase/migrations/037_add_barcode_files.sql`

- [ ] **Step 1: Write the migration**

```sql
-- nexus/supabase/migrations/037_add_barcode_files.sql
-- Barcode files attached to a Business Central item, shown in the GTIN tab.
-- Flat list (no review/session workflow); stored in the packaging-files bucket.

CREATE TABLE barcode_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_central_item_id UUID NOT NULL
    REFERENCES business_central_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_connection_id UUID NOT NULL
    REFERENCES business_central_connections(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_barcode_files_bc_item_id
  ON barcode_files(business_central_item_id);
CREATE INDEX idx_barcode_files_uploaded_at
  ON barcode_files(uploaded_at DESC);

ALTER TABLE barcode_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view barcode files" ON barcode_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create barcode files" ON barcode_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete barcode files" ON barcode_files
  FOR DELETE TO authenticated USING (true);
```

- [ ] **Step 2: Apply the migration to the local/dev database**

Run the project's usual migration command (e.g. `cd nexus && npx supabase db push`, or apply via the Supabase dashboard SQL editor if that is the team's flow).
Expected: `barcode_files` table created with no errors.

> Note: confirm `uuid_generate_v4()` is the convention in this repo (it is used in `001_initial_schema.sql`). If newer migrations use `gen_random_uuid()`, match the newest convention instead.

- [ ] **Step 3: Commit**

```bash
git add nexus/supabase/migrations/037_add_barcode_files.sql
git commit -m "feat: add barcode_files table migration"
```

---

### Task 3: TypeScript types for barcode files

**Files:**
- Modify: `nexus/src/types/database.ts` (add a `BarcodeFile` interface near the `FileRecord` interface, ~line 371)

- [ ] **Step 1: Add the `BarcodeFile` interface**

Add immediately after the `FileRecord` interface block:

```typescript
export interface BarcodeFile {
  id: string;
  business_central_item_id: string;
  organization_id: string;
  bc_connection_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: No new type errors introduced by this change. (Pre-existing errors elsewhere, if any, are out of scope — note them but do not fix.)

- [ ] **Step 3: Commit**

```bash
git add nexus/src/types/database.ts
git commit -m "feat: add BarcodeFile type"
```

---

### Task 4: Server actions for barcode files

Mirrors the scoping pattern in `itemPurchases.ts` (`verifyBusinessCentralItemInScope`) and `uploads.ts`.

**Files:**
- Create: `nexus/src/app/actions/barcodeFiles.ts`

- [ ] **Step 1: Write the actions**

```typescript
// nexus/src/app/actions/barcodeFiles.ts
'use server';

import { revalidatePath } from 'next/cache';
import {
  getActiveBusinessCentralScope,
  requireActiveBusinessCentralScope,
} from '@/lib/businessCentral/environmentScope';
import { createClient } from '@/lib/supabase/server';
import { BarcodeFile } from '@/types/database';

async function verifyBusinessCentralItemInScope(
  businessCentralItemRowId: string,
  orgId: string,
  bcConnectionId: string
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_central_items')
    .select('id')
    .eq('id', businessCentralItemRowId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (error || !data) {
    throw new Error('Business Central item not found in the active environment');
  }
}

export async function getBarcodeFiles(
  businessCentralItemRowId: string
): Promise<BarcodeFile[]> {
  const { orgId, bcConnectionId } = await getActiveBusinessCentralScope();
  if (!bcConnectionId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('barcode_files')
    .select('*')
    .eq('business_central_item_id', businessCentralItemRowId)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as BarcodeFile[];
}

export async function createBarcodeFile(
  businessCentralItemRowId: string,
  file: { name: string; size: number; type: string; storagePath: string }
): Promise<BarcodeFile> {
  const { orgId, bcConnectionId, user } = await requireActiveBusinessCentralScope();
  await verifyBusinessCentralItemInScope(businessCentralItemRowId, orgId, bcConnectionId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('barcode_files')
    .insert({
      business_central_item_id: businessCentralItemRowId,
      organization_id: orgId,
      bc_connection_id: bcConnectionId,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      storage_path: file.storagePath,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/items');
  return data as BarcodeFile;
}

export async function deleteBarcodeFile(id: string): Promise<void> {
  const { orgId, bcConnectionId } = await requireActiveBusinessCentralScope();
  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from('barcode_files')
    .select('storage_path')
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId)
    .single();

  if (fetchError || !row) {
    throw new Error('Barcode file not found in the active environment');
  }

  const { error: storageError } = await supabase.storage
    .from('packaging-files')
    .remove([row.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase
    .from('barcode_files')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('bc_connection_id', bcConnectionId);

  if (error) throw error;
  revalidatePath('/items');
}
```

> Note: confirm `requireActiveBusinessCentralScope()` returns `user` (it spreads `requireOrganizationContext()` which provides `user`). If the property differs, use the same accessor `itemPurchases.ts` uses for the current user id.

- [ ] **Step 2: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: No new type errors from this file.

- [ ] **Step 3: Commit**

```bash
git add nexus/src/app/actions/barcodeFiles.ts
git commit -m "feat: add barcode file server actions"
```

---

### Task 5: `BarcodeDropZone` component

A parallel to `DropZone` (which is hardcoded to `.ai`/`.pdf`), using the shared accept list from Task 1.

**Files:**
- Create: `nexus/src/components/items/BarcodeDropZone.tsx`

- [ ] **Step 1: Write the component**

```tsx
// nexus/src/components/items/BarcodeDropZone.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCEPTED_BARCODE_EXTENSIONS, filterAcceptedBarcodeFiles } from '@/lib/barcodeFiles';

interface BarcodeDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT_ATTR = ACCEPTED_BARCODE_EXTENSIONS.join(',');

export function BarcodeDropZone({ onFilesSelected, disabled }: BarcodeDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (fileList: FileList | File[]) => {
      const { accepted, rejectedCount } = filterAcceptedBarcodeFiles(Array.from(fileList));
      if (rejectedCount > 0) {
        setError(`Some files were skipped. Accepted: ${ACCEPTED_BARCODE_EXTENSIONS.join(', ')}`);
        setTimeout(() => setError(''), 3000);
      }
      if (accepted.length > 0) onFilesSelected(accepted);
    },
    [onFilesSelected]
  );

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-primary bg-primary-subtle'
            : 'border-border bg-surface-raised hover:border-foreground-subtle hover:bg-surface',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            if (e.target.files) handle(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex flex-col items-center">
          <Upload className={cn('w-8 h-8 mb-2', isDragging ? 'text-primary' : 'text-foreground-subtle')} />
          <p className="text-foreground font-medium text-sm mb-0.5">
            {isDragging ? 'Drop barcode files here' : 'Drag and drop barcode files'}
          </p>
          <p className="text-foreground-muted text-xs mb-1">or click to browse</p>
          <p className="text-foreground-subtle text-xs">
            Accepted: {ACCEPTED_BARCODE_EXTENSIONS.join(', ')}
          </p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 3: Commit**

```bash
git add nexus/src/components/items/BarcodeDropZone.tsx
git commit -m "feat: add BarcodeDropZone component"
```

---

### Task 6: `BarcodeUploadsPanel` component

Loads files, lists them above the drop zone, handles client-side upload + delete. Upload flow mirrors `ArtworkModal.handleFilesSelected` (client uploads to storage, then a server action records the row).

**Files:**
- Create: `nexus/src/components/items/BarcodeUploadsPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
// nexus/src/components/items/BarcodeUploadsPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { File as FileIcon, FileImage, FileText, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeFileName } from '@/lib/utils';
import { iconNameForExtension, extensionOf } from '@/lib/barcodeFiles';
import {
  createBarcodeFile,
  deleteBarcodeFile,
  getBarcodeFiles,
} from '@/app/actions/barcodeFiles';
import { BarcodeDropZone } from './BarcodeDropZone';
import type { BarcodeFile } from '@/types/database';

interface BarcodeUploadsPanelProps {
  bcItemId: string;
  canEdit: boolean;
}

interface UploadingFile {
  name: string;
  status: 'uploading' | 'error';
  error?: string;
}

function FileTypeIcon({ ext }: { ext: string }) {
  const name = iconNameForExtension(ext);
  const className = 'size-5 shrink-0 text-foreground-muted';
  if (name === 'FileImage') return <FileImage className={className} />;
  if (name === 'FileText') return <FileText className={className} />;
  return <FileIcon className={className} />;
}

export function BarcodeUploadsPanel({ bcItemId, canEdit }: BarcodeUploadsPanelProps) {
  const [files, setFiles] = useState<BarcodeFile[] | null>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFiles(null);
    getBarcodeFiles(bcItemId)
      .then((data) => active && setFiles(data))
      .catch(() => active && setError('Failed to load barcode files.'));
    return () => {
      active = false;
    };
  }, [bcItemId]);

  async function handleFilesSelected(selected: File[]) {
    if (!canEdit) return;
    setUploading(selected.map((f) => ({ name: f.name, status: 'uploading' as const })));
    const supabase = createClient();

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const ext = extensionOf(file.name);
      const storagePath = `barcodes/${bcItemId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('packaging-files')
          .upload(storagePath, file);
        if (uploadError) throw uploadError;
        const created = await createBarcodeFile(bcItemId, {
          name: file.name,
          size: file.size,
          type: ext,
          storagePath,
        });
        setFiles((prev) => (prev ? [created, ...prev] : [created]));
      } catch (err) {
        setUploading((prev) =>
          prev.map((u, idx) =>
            idx === i
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : u
          )
        );
      }
    }
    setTimeout(() => setUploading([]), 2000);
  }

  async function handleDelete(id: string) {
    if (!canEdit) return;
    const prev = files;
    setFiles((cur) => (cur ? cur.filter((f) => f.id !== id) : cur));
    try {
      await deleteBarcodeFile(id);
    } catch {
      setFiles(prev ?? null);
      setError('Failed to delete file.');
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Barcode files
      </h3>

      {error && (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {files === null ? (
        <div className="flex items-center justify-center py-6 text-foreground-muted">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : files.length === 0 && uploading.length === 0 ? (
        <p className="text-sm text-foreground-subtle">No barcode files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
            >
              <FileTypeIcon ext={file.file_type ?? extensionOf(file.file_name)} />
              <span className="min-w-0 flex-1 break-all text-sm text-foreground">{file.file_name}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(file.id)}
                  title="Delete file"
                  className="shrink-0 rounded p-1 text-foreground-subtle hover:bg-surface hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
          {uploading.map((u, idx) => (
            <li
              key={`uploading-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2"
            >
              {u.status === 'uploading' ? (
                <Loader2 className="size-4 animate-spin text-foreground-muted" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
              <span className="min-w-0 flex-1 break-all text-sm text-foreground-muted">
                {u.name}
                {u.status === 'error' && u.error ? ` — ${u.error}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && <BarcodeDropZone onFilesSelected={handleFilesSelected} />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd nexus && npx tsc --noEmit`
Expected: No new type errors. (Confirm `sanitizeFileName` and `createClient` import paths match `ArtworkModal.tsx`: `@/lib/utils` and `@/lib/supabase/client`.)

- [ ] **Step 3: Commit**

```bash
git add nexus/src/components/items/BarcodeUploadsPanel.tsx
git commit -m "feat: add BarcodeUploadsPanel component"
```

---

### Task 7: Wire into ItemsClient — rename tab + render panel

**Files:**
- Modify: `nexus/src/components/items/ItemsClient.tsx` (tab label ~line 974; gs1 render block ~line 1114; imports near line 61)

- [ ] **Step 1: Add the import**

Next to the existing `import { Gs1FieldsPanel } from "@/components/gs1/Gs1FieldsPanel";` line, add:

```tsx
import { BarcodeUploadsPanel } from "@/components/items/BarcodeUploadsPanel";
```

- [ ] **Step 2: Rename the tab label**

Change the tabs array entry:

```tsx
    { key: "gs1", label: "GTIN" },
```

(Leave the `key` as `"gs1"`; only the `label` changes.)

- [ ] **Step 3: Render the panel under the GS1 fields**

Replace the existing `gs1` render block:

```tsx
        {tab === "gs1" && (
          <Gs1FieldsPanel bcItemId={item.id} canEdit={canEdit} />
        )}
```

with:

```tsx
        {tab === "gs1" && (
          <div className="space-y-3">
            <Gs1FieldsPanel bcItemId={item.id} canEdit={canEdit} />
            <BarcodeUploadsPanel bcItemId={item.id} canEdit={canEdit} />
          </div>
        )}
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd nexus && npx tsc --noEmit && npx eslint src/components/items/ItemsClient.tsx src/components/items/BarcodeUploadsPanel.tsx src/components/items/BarcodeDropZone.tsx src/app/actions/barcodeFiles.ts src/lib/barcodeFiles.ts`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add nexus/src/components/items/ItemsClient.tsx
git commit -m "feat: render barcode uploads in GTIN tab and rename tab"
```

---

### Task 8: Full verification

- [ ] **Step 1: Run the unit tests**

Run: `cd nexus && npx vitest run`
Expected: PASS, including `src/lib/barcodeFiles.test.ts`.

- [ ] **Step 2: Build**

Run: `cd nexus && npm run build`
Expected: Build succeeds with no new type/lint errors.

- [ ] **Step 3: Manual smoke test** (dev server, `npm run dev`)

Open the Items page, select an item, open the detail pane:
- [ ] Tab reads **GTIN** (not GS1).
- [ ] GS1 product fields still render at the top of the tab.
- [ ] "Barcode files" section with a drop zone appears below.
- [ ] Upload a `.png`, a `.pdf`, and an `.ai` file — each appears in the list above the drop zone with the correct icon (image/text/file) and full file name.
- [ ] Dropping a `.txt` file shows the "skipped" warning and does not upload.
- [ ] Delete removes the file from the list and from storage.
- [ ] Artwork upload on the Orders page still works unchanged.
- [ ] As a non-edit user (if available), the list shows but no drop zone / delete buttons appear.

- [ ] **Step 4: Final commit (if any manual fixes were needed)**

```bash
git add -A
git commit -m "fix: barcode upload review tweaks"
```

---

## Notes / assumptions to confirm during execution

- `requireActiveBusinessCentralScope()` exposes `user` (via `requireOrganizationContext`). If not, use the same current-user accessor as `itemPurchases.ts`.
- `packaging-files` bucket is the right shared bucket and storage RLS allows authenticated upload under any path (artwork uses `${itemsId}/...`; barcodes use `barcodes/${bcItemId}/...`). If storage policies are path-restricted, add a policy for the `barcodes/` prefix.
- `canEdit` (BC-field edit gate) is the intended permission for barcode upload/delete per the approved spec.
- Migration UUID default (`uuid_generate_v4()` vs `gen_random_uuid()`) should match the repo's newest convention.
