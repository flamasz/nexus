# Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix code duplication and quality issues in PAMS without changing any visible behavior.

**Architecture:** Surgical fixes only — extract shared components and helpers, fix N+1 DB queries, remove props-to-state anti-pattern, delete dead code. No structural reorganization.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase JS v2, Tailwind CSS

---

## File Map

| Action | File | Change |
|---|---|---|
| Create | `src/components/ui/CategoryBadge.tsx` | New shared category badge component |
| Create | `src/components/ui/index.ts` | Barrel export for `ui/` |
| Modify | `src/lib/utils/index.ts` | Add `sanitizeFileName` export |
| Modify | `src/components/layout/Sidebar.tsx` | Use `<CategoryBadge>` instead of IIFE |
| Modify | `src/app/(protected)/page.tsx` | Use `<CategoryBadge>`, `sendEmailNotification`, imported `sanitizeFileName`; fix indentation |
| Modify | `src/app/actions/uploads.ts` | Fix N+1 in `getUploadSessions`; remove `getUploadSessionFiles` |
| Modify | `src/components/packaging/PackagingForm.tsx` | Remove props-to-state mirroring |

---

## Task 1: Create `CategoryBadge` component

**Files:**
- Create: `src/components/ui/CategoryBadge.tsx`
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create the component file**

Create `src/components/ui/CategoryBadge.tsx` with this content:

```tsx
import { Category } from '@/types/database';
import { getCategoryColorClasses } from '@/lib/categoryColors';

interface CategoryBadgeProps {
  category: Category;
  fontWeight?: 'font-medium' | 'font-semibold';
}

export function CategoryBadge({ category, fontWeight = 'font-medium' }: CategoryBadgeProps) {
  const colorStyles = getCategoryColorClasses(category.color, category.name);
  const base = `inline-block px-2 py-0.5 text-sm ${fontWeight} rounded border`;

  if (colorStyles.style) {
    return (
      <span className={base} style={colorStyles.style}>
        {category.name}
      </span>
    );
  }
  return (
    <span className={`${base} ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
      {category.name}
    </span>
  );
}
```

- [ ] **Step 2: Create the barrel export**

Create `src/components/ui/index.ts` with this content:

```ts
export { CategoryBadge } from './CategoryBadge';
```

- [ ] **Step 3: Verify it type-checks**

Run from the `pams/` directory:
```bash
npm run lint
```
Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CategoryBadge.tsx src/components/ui/index.ts
git commit -m "feat: add CategoryBadge shared component"
```

---

## Task 2: Use `CategoryBadge` in `Sidebar.tsx`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

The sidebar currently renders category badges using an IIFE starting at line 148. Replace it with `<CategoryBadge>`.

- [ ] **Step 1: Add the import**

At the top of `src/components/layout/Sidebar.tsx`, add the import after the existing imports:

```ts
import { CategoryBadge } from '@/components/ui';
```

- [ ] **Step 2: Replace the IIFE**

Find this block (lines 148–165):

```tsx
{item.category && (() => {
  const colorStyles = getCategoryColorClasses(item.category.color, item.category.name);
  if (colorStyles.style) {
    return (
      <span
        className="inline-block px-2 py-0.5 text-sm font-semibold rounded border"
        style={colorStyles.style}
      >
        {item.category.name}
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-sm font-semibold rounded border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
      {item.category.name}
    </span>
  );
})()}
```

Replace it with:

```tsx
{item.category && (
  <CategoryBadge category={item.category} fontWeight="font-semibold" />
)}
```

- [ ] **Step 3: Remove the now-unused `getCategoryColorClasses` import**

Remove this line from the imports at the top of `Sidebar.tsx`:

```ts
import { getCategoryColorClasses } from '@/lib/categoryColors';
```

- [ ] **Step 4: Verify**

Run:
```bash
npm run lint
```
Expected: no errors. Also open the app in the browser and confirm category badges still display correctly in the sidebar.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "refactor: use CategoryBadge in Sidebar"
```

---

## Task 3: Use `CategoryBadge` in `page.tsx` + fix indentation

**Files:**
- Modify: `src/app/(protected)/page.tsx`

The main page has the same IIFE pattern at line 481, plus a JSX indentation inconsistency around lines 537–545.

- [ ] **Step 1: Add the import**

In `src/app/(protected)/page.tsx`, add `CategoryBadge` to the imports. Find this existing import:

```ts
import { getCategoryColorClasses } from '@/lib/categoryColors';
```

Replace it with:

```ts
import { CategoryBadge } from '@/components/ui';
```

- [ ] **Step 2: Replace the IIFE**

Find this block (around lines 480–499):

```tsx
{(() => {
  const colorStyles = getCategoryColorClasses(selectedItem.category.color, selectedItem.category.name);
  if (colorStyles.style) {
    return (
      <span
        className="inline-block px-2 py-0.5 text-sm font-medium rounded border"
        style={colorStyles.style}
      >
        {selectedItem.category.name}
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-sm font-medium rounded border ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}>
      {selectedItem.category.name}
    </span>
  );
})()}
```

Replace it with:

```tsx
<CategoryBadge category={selectedItem.category} />
```

- [ ] **Step 3: Fix indentation (lines ~537–545)**

Find this block with incorrect indentation (the `h2` and upload section are indented one level too shallow relative to their container):

```tsx
              <div className="max-w-4xl">
                <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Upload Files
              </h2>
              {uploadingFiles.length > 0 ? (
                <UploadProgress files={uploadingFiles} />
              ) : (
                <DropZone onFilesSelected={handleFilesSelected} />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  Upload History
                </h2>
```

Replace with correctly indented version:

```tsx
              <div className="max-w-4xl">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    Upload Files
                  </h2>
                  {uploadingFiles.length > 0 ? (
                    <UploadProgress files={uploadingFiles} />
                  ) : (
                    <DropZone onFilesSelected={handleFilesSelected} />
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Upload History
                    </h2>
```

Also fix the closing tags further down that correspond to the misindented open tags. Find:

```tsx
                )}
                  </div>
                </div>
              </div>
            </div>
          </div>
```

Replace with:

```tsx
                )}
                </div>
              </div>
            </div>
          </div>
```

- [ ] **Step 4: Verify**

Run:
```bash
npm run lint
```
Expected: no errors. Check the app in the browser — the main content header should still show the category badge correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/(protected)/page.tsx
git commit -m "refactor: use CategoryBadge in page, fix indentation"
```

---

## Task 4: Move `sanitizeFileName` to utils

**Files:**
- Modify: `src/lib/utils/index.ts`
- Modify: `src/app/(protected)/page.tsx`

- [ ] **Step 1: Add `sanitizeFileName` to utils**

Open `src/lib/utils/index.ts`. It currently reads:

```ts
export { formatHST, formatHSTShort } from './formatHST';
export { formatFileSize } from './formatFileSize';
export { statusConfig, getStatusClasses } from './statusConfig';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

Add `sanitizeFileName` after `cn`:

```ts
export { formatHST, formatHSTShort } from './formatHST';
export { formatFileSize } from './formatFileSize';
export { statusConfig, getStatusClasses } from './statusConfig';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')                     // decompose fullwidth chars to ASCII equivalents
    .replace(/[^\x20-\x7E]/g, '')          // strip remaining non-ASCII
    .replace(/\s+/g, '_')                  // spaces to underscores
    .replace(/[^a-zA-Z0-9._-]/g, '')       // keep only safe chars
    || 'file';                             // fallback if empty
}
```

- [ ] **Step 2: Import and use it in `page.tsx`**

In `src/app/(protected)/page.tsx`, find the existing local definition (around lines 44–51):

```ts
function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')                     // decompose fullwidth chars to ASCII equivalents
    .replace(/[^\x20-\x7E]/g, '')          // strip remaining non-ASCII
    .replace(/\s+/g, '_')                  // spaces to underscores
    .replace(/[^a-zA-Z0-9._-]/g, '')       // keep only safe chars
    || 'file';                             // fallback if empty
}
```

Delete that entire function. Then add `sanitizeFileName` to the existing utils import at the top of the file. Find:

```ts
import { getCategoryColorClasses } from '@/lib/categoryColors';
```

(This import was already removed in Task 3. Find the `formatDimensions` import instead.)

```ts
import { formatDimensions } from '@/lib/utils/formatDimensions';
```

Add the import from utils:

```ts
import { sanitizeFileName } from '@/lib/utils';
```

- [ ] **Step 3: Verify**

Run:
```bash
npm run lint
```
Expected: no errors. Test a file upload in the browser to confirm sanitization still works.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/index.ts src/app/(protected)/page.tsx
git commit -m "refactor: move sanitizeFileName to lib/utils"
```

---

## Task 5: Extract `sendEmailNotification` helper in `page.tsx`

**Files:**
- Modify: `src/app/(protected)/page.tsx`

The same `fetch('/api/email', ...)` + try/catch block appears three times in three handlers.

- [ ] **Step 1: Add the helper function**

In `src/app/(protected)/page.tsx`, add this function near the top of the file, just before the `HomePage` component definition (after the `sanitizeFileName` import and any other module-level code):

```ts
async function sendEmailNotification(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });
  } catch (e) {
    console.error('Failed to send email:', e);
  }
}
```

- [ ] **Step 2: Replace the call in `handleFilesSelected`**

Find (around lines 338–352):

```ts
      // Send email notification
      try {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_upload',
            data: {
              packagingName: selectedItem.item_name?.name,
              packagingId: selectedId,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to send email:', e);
      }
```

Replace with:

```ts
      await sendEmailNotification('new_upload', {
        packagingName: selectedItem.item_name?.name,
        packagingId: selectedId,
      });
```

- [ ] **Step 3: Replace the call in `handleStatusChange`**

Find (around lines 372–389):

```ts
    if (selectedItem) {
      try {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'status_change',
            data: {
              packagingName: selectedItem.item_name?.name,
              packagingId: selectedId,
              newStatus: status,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to send email:', e);
      }
    }
```

Replace with:

```ts
    if (selectedItem) {
      await sendEmailNotification('status_change', {
        packagingName: selectedItem.item_name?.name,
        packagingId: selectedId,
        newStatus: status,
      });
    }
```

- [ ] **Step 4: Replace the call in `handleNotesChange`**

Find (around lines 404–420):

```ts
    if (!hadNotesBefore && hasNotesNow && selectedItem) {
      try {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'note_added',
            data: {
              packagingName: selectedItem.item_name?.name,
              packagingId: selectedId,
              noteText: notes,
            },
          }),
        });
      } catch (e) {
        console.error('Failed to send email:', e);
      }
    }
```

Replace with:

```ts
    if (!hadNotesBefore && hasNotesNow && selectedItem) {
      await sendEmailNotification('note_added', {
        packagingName: selectedItem.item_name?.name,
        packagingId: selectedId,
        noteText: notes,
      });
    }
```

- [ ] **Step 5: Verify**

Run:
```bash
npm run lint
```
Expected: no errors. Test in the browser: upload a file, change a status, add a note — all should still trigger email notifications.

- [ ] **Step 6: Commit**

```bash
git add src/app/(protected)/page.tsx
git commit -m "refactor: extract sendEmailNotification helper"
```

---

## Task 6: Fix N+1 query in `fetchSessionsClient` (client-side)

**Files:**
- Modify: `src/app/(protected)/page.tsx`

The `fetchSessionsClient` function currently loops over sessions and makes 2 DB calls per session (files + uploader). Replace with a single nested select.

- [ ] **Step 1: Replace `fetchSessionsClient`**

Find the entire `fetchSessionsClient` function (around lines 117–151):

```ts
  const fetchSessionsClient = async (packagingId: string): Promise<UploadSessionWithDetails[]> => {
    const supabase = createClient();

    const { data: sessions, error } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('packaging_id', packagingId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    if (!sessions) return [];

    const sessionsWithDetails: UploadSessionWithDetails[] = [];

    for (const session of sessions) {
      const { data: files } = await supabase
        .from('files')
        .select('*')
        .eq('upload_session_id', session.id);

      const { data: uploader } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.uploaded_by!)
        .single();

      sessionsWithDetails.push({
        ...session,
        files: files || [],
        uploader: uploader || undefined,
      });
    }

    return sessionsWithDetails;
  };
```

Replace it with:

```ts
  const fetchSessionsClient = async (packagingId: string): Promise<UploadSessionWithDetails[]> => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('upload_sessions')
      .select('*, files(*), uploader:users!uploaded_by(*)')
      .eq('packaging_id', packagingId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[])
      .map((session) => ({
        ...session,
        files: session.files || [],
        uploader: session.uploader ?? undefined,
      }));
  };
```

- [ ] **Step 2: Add missing type imports**

Check the imports at the top of `page.tsx`. Make sure `UploadSession`, `FileRecord`, and `User` are imported from `@/types/database`. The current import line is:

```ts
import { PackagingItemWithCategory, User, UploadSessionWithDetails, UploadStatus, Category, ProductLine, ItemName, ItemStatus } from '@/types/database';
```

Add `UploadSession` and `FileRecord` to that import:

```ts
import { PackagingItemWithCategory, User, UploadSession, UploadSessionWithDetails, UploadStatus, Category, ProductLine, ItemName, ItemStatus, FileRecord } from '@/types/database';
```

- [ ] **Step 3: Verify**

Run:
```bash
npm run build
```
Expected: builds without type errors. Then open the app, select a packaging item, and confirm upload sessions (with files and uploader names) still load correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/(protected)/page.tsx
git commit -m "perf: fix N+1 query in fetchSessionsClient"
```

---

## Task 7: Fix N+1 query in `getUploadSessions` + remove dead code (server action)

**Files:**
- Modify: `src/app/actions/uploads.ts`

Same N+1 problem as Task 6, in the server action. Also remove `getUploadSessionFiles` which is never called.

- [ ] **Step 1: Replace `getUploadSessions`**

Find the entire `getUploadSessions` function (lines 7–43):

```ts
export async function getUploadSessions(
  packagingId: string
): Promise<UploadSessionWithDetails[]> {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from('upload_sessions')
    .select('*')
    .eq('packaging_id', packagingId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  if (!sessions) return [];

  const sessionsWithDetails: UploadSessionWithDetails[] = [];

  for (const session of sessions) {
    const { data: files } = await supabase
      .from('files')
      .select('*')
      .eq('upload_session_id', session.id);

    const { data: uploader } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.uploaded_by!)
      .single();

    sessionsWithDetails.push({
      ...session,
      files: files || [],
      uploader: uploader || undefined,
    });
  }

  return sessionsWithDetails;
}
```

Replace it with:

```ts
export async function getUploadSessions(
  packagingId: string
): Promise<UploadSessionWithDetails[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('upload_sessions')
    .select('*, files(*), uploader:users!uploaded_by(*)')
    .eq('packaging_id', packagingId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  return (data as unknown as (UploadSession & { files: FileRecord[]; uploader: User | null })[])
    .map((session) => ({
      ...session,
      files: session.files || [],
      uploader: session.uploader ?? undefined,
    }));
}
```

- [ ] **Step 2: Add missing type imports**

At the top of `src/app/actions/uploads.ts`, the current import is:

```ts
import { UploadSession, UploadSessionWithDetails, UploadStatus, FileRecord } from '@/types/database';
```

Add `User`:

```ts
import { UploadSession, UploadSessionWithDetails, UploadStatus, FileRecord, User } from '@/types/database';
```

- [ ] **Step 3: Remove `getUploadSessionFiles`**

Find and delete the entire `getUploadSessionFiles` function (lines 194–206):

```ts
export async function getUploadSessionFiles(
  sessionId: string
): Promise<FileRecord[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('upload_session_id', sessionId);

  if (error) throw error;
  return data || [];
}
```

- [ ] **Step 4: Verify**

Run:
```bash
npm run build
```
Expected: builds without errors. Verify in the browser that sessions still load correctly when selecting a packaging item.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/uploads.ts
git commit -m "perf: fix N+1 query in getUploadSessions, remove dead code"
```

---

## Task 8: Fix `PackagingForm` props-to-state mirroring

**Files:**
- Modify: `src/components/packaging/PackagingForm.tsx`

The form copies `productLines`, `itemNames`, and `categories` into local state. Replace with tracking only new additions, using props as the source of truth.

- [ ] **Step 1: Replace the local list state**

In `src/components/packaging/PackagingForm.tsx`, find these three state declarations (around lines 50–52):

```ts
  const [localProductLines, setLocalProductLines] = useState<ProductLine[]>(productLines);
  const [localItemNames, setLocalItemNames] = useState<ItemName[]>(itemNames);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
```

Replace them with:

```ts
  const [newProductLines, setNewProductLines] = useState<ProductLine[]>([]);
  const [newItemNames, setNewItemNames] = useState<ItemName[]>([]);
  const [newCategories, setNewCategories] = useState<Category[]>([]);

  const allProductLines = [...productLines, ...newProductLines].sort((a, b) => a.name.localeCompare(b.name));
  const allItemNames = [...itemNames, ...newItemNames].sort((a, b) => a.name.localeCompare(b.name));
  const allCategories = [...categories, ...newCategories].sort((a, b) => a.name.localeCompare(b.name));
```

- [ ] **Step 2: Update `handleCreateProductLine`**

Find (around lines 59–65):

```ts
  const handleCreateProductLine = async (plName: string): Promise<ProductLine> => {
    const newProductLine = await onCreateProductLine(plName);
    setLocalProductLines((prev) =>
      [...prev, newProductLine].sort((a, b) => a.name.localeCompare(b.name))
    );
    return newProductLine;
  };
```

Replace with:

```ts
  const handleCreateProductLine = async (plName: string): Promise<ProductLine> => {
    const newProductLine = await onCreateProductLine(plName);
    setNewProductLines((prev) => [...prev, newProductLine]);
    return newProductLine;
  };
```

- [ ] **Step 3: Update `handleCreateItemName`**

Find (around lines 67–73):

```ts
  const handleCreateItemName = async (inName: string): Promise<ItemName> => {
    const newItemName = await onCreateItemName(inName);
    setLocalItemNames((prev) =>
      [...prev, newItemName].sort((a, b) => a.name.localeCompare(b.name))
    );
    return newItemName;
  };
```

Replace with:

```ts
  const handleCreateItemName = async (inName: string): Promise<ItemName> => {
    const newItemName = await onCreateItemName(inName);
    setNewItemNames((prev) => [...prev, newItemName]);
    return newItemName;
  };
```

- [ ] **Step 4: Update `handleUpdateItemName`**

Find (around lines 75–81):

```ts
  const handleUpdateItemName = async (id: string, inName: string): Promise<ItemName> => {
    const updatedItemName = await onUpdateItemName(id, inName);
    setLocalItemNames((prev) =>
      prev.map((i) => (i.id === id ? updatedItemName : i)).sort((a, b) => a.name.localeCompare(b.name))
    );
    return updatedItemName;
  };
```

Replace with:

```ts
  const handleUpdateItemName = async (id: string, inName: string): Promise<ItemName> => {
    const updatedItemName = await onUpdateItemName(id, inName);
    setNewItemNames((prev) => prev.map((i) => (i.id === id ? updatedItemName : i)));
    return updatedItemName;
  };
```

- [ ] **Step 5: Update `handleUpdateCategory`**

Find (around lines 111–127):

```ts
  const handleUpdateCategory = async (data: {
    name: string;
    width: number;
    height: number;
    depth: number;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    if (!editingCategory) return;
    const { updateCategory } = await import('@/app/actions/categories');
    const updated = await updateCategory(editingCategory.id, data);
    setLocalCategories((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingCategory(null);
    onCategoryUpdated(updated);
  };
```

Replace with:

```ts
  const handleUpdateCategory = async (data: {
    name: string;
    width: number;
    height: number;
    depth: number;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    if (!editingCategory) return;
    const { updateCategory } = await import('@/app/actions/categories');
    const updated = await updateCategory(editingCategory.id, data);
    setNewCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCategory(null);
    onCategoryUpdated(updated);
  };
```

- [ ] **Step 6: Update `handleCreateNewCategory`**

Find (around lines 129–146):

```ts
  const handleCreateNewCategory = async (data: {
    name: string;
    width: number;
    height: number;
    depth: number;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    const { createCategory } = await import('@/app/actions/categories');
    const newCategory = await createCategory(data);
    setLocalCategories((prev) =>
      [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name))
    );
    setCategoryId(newCategory.id);
    setCreatingCategory(false);
    setNewCategoryName('');
    onCategoryCreated(newCategory);
  };
```

Replace with:

```ts
  const handleCreateNewCategory = async (data: {
    name: string;
    width: number;
    height: number;
    depth: number;
    unit: 'mm' | 'cm' | 'in';
    color: string;
  }) => {
    const { createCategory } = await import('@/app/actions/categories');
    const newCategory = await createCategory(data);
    setNewCategories((prev) => [...prev, newCategory]);
    setCategoryId(newCategory.id);
    setCreatingCategory(false);
    setNewCategoryName('');
    onCategoryCreated(newCategory);
  };
```

- [ ] **Step 7: Update JSX to use `all*` lists**

In the `return` JSX, find every place `localProductLines`, `localItemNames`, and `localCategories` are referenced and replace with `allProductLines`, `allItemNames`, and `allCategories` respectively.

There are three occurrences — one each in the `ItemNameCombobox`, `CategorySelector`, and `ProductLineCombobox` render:

```tsx
// Change:
itemNames={localItemNames}
// To:
itemNames={allItemNames}

// Change:
categories={localCategories}
// To:
categories={allCategories}

// Change:
productLines={localProductLines}
// To:
productLines={allProductLines}
```

- [ ] **Step 8: Verify**

Run:
```bash
npm run build
```
Expected: no type errors. Test in the browser:
1. Open the "New Packaging Item" form
2. Create a new category — it should appear in the category selector immediately
3. Create a new product line — it should appear in the product line selector immediately
4. Create a new item name — it should appear in the name selector immediately
5. Save the form — should work normally

- [ ] **Step 9: Commit**

```bash
git add src/components/packaging/PackagingForm.tsx
git commit -m "refactor: remove props-to-state mirroring in PackagingForm"
```

---

## Final Verification

- [ ] **Run lint and build**

```bash
npm run lint && npm run build
```
Expected: no errors or warnings.

- [ ] **Manual smoke test**

1. App loads, packaging items appear in sidebar
2. Category badges render correctly (sidebar + main content)
3. Selecting an item loads its upload sessions (check browser Network tab — should be one request, not many)
4. Uploading files works
5. Changing upload status sends email (check server logs)
6. Adding notes for the first time sends email
7. Creating/editing packaging items works, including inline creation of categories, product lines, and item names
