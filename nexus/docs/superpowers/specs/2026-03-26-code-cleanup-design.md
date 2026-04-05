# Code Cleanup Design — PAMS

**Date:** 2026-03-26
**Scope:** Option A — Surgical targeted fixes (duplication + code quality, no structural reorganization)

---

## Goals

Fix code duplication and quality issues across the PAMS codebase without restructuring the architecture. All existing behavior is preserved.

---

## New Files

| File | Purpose |
|---|---|
| `src/components/ui/CategoryBadge.tsx` | Shared component for rendering a colored category tag |
| `src/components/ui/index.ts` | Barrel export for the `ui/` folder |

---

## Changes to Existing Files

### 1. Extract `CategoryBadge` component

**Problem:** The IIFE pattern for rendering a colored category badge is copy-pasted in two places:
- `src/app/(protected)/page.tsx` (main content header)
- `src/components/layout/Sidebar.tsx` (sidebar item list)

**Fix:** Create `src/components/ui/CategoryBadge.tsx` that accepts a `Category` object and renders the badge. Replace both IIFEs with `<CategoryBadge category={...} />`.

---

### 2. Extract `sendEmailNotification` helper

**Problem:** The same `fetch('/api/email', { method: 'POST', ... })` pattern with try/catch is repeated three times in `src/app/(protected)/page.tsx`:
- `handleFilesSelected` (type: `new_upload`)
- `handleStatusChange` (type: `status_change`)
- `handleNotesChange` (type: `note_added`)

**Fix:** Extract a module-level `sendEmailNotification(type, data)` async function at the top of `page.tsx`. All three handlers call it instead.

---

### 3. Move `sanitizeFileName` to utils

**Problem:** `sanitizeFileName` is defined inline in `src/app/(protected)/page.tsx`. Utility functions belong in `src/lib/utils/`.

**Fix:** Add `sanitizeFileName` to `src/lib/utils/index.ts` and import it in `page.tsx`.

---

### 4. Fix N+1 queries

**Problem:** Both `fetchSessionsClient` (in `page.tsx`) and `getUploadSessions` (in `src/app/actions/uploads.ts`) fetch sessions then loop to fetch files and uploader separately per session — causing N×2 extra DB requests.

**Fix:** Rewrite both to use a single Supabase nested select:

```ts
supabase
  .from('upload_sessions')
  .select('*, files(*), uploader:users!uploaded_by(*)')
  .eq('packaging_id', packagingId)
  .order('uploaded_at', { ascending: false })
```

Return type stays `UploadSessionWithDetails[]` — no downstream changes needed.

---

### 5. Remove unused `getUploadSessionFiles`

**Problem:** `getUploadSessionFiles` in `src/app/actions/uploads.ts` is never called anywhere in the codebase.

**Fix:** Delete the function.

---

### 6. Fix `PackagingForm` props-to-state mirroring

**Problem:** `PackagingForm` copies `productLines`, `itemNames`, and `categories` props into local state on mount. If the parent updates those lists after the form opens, the form won't see the changes. This is a React anti-pattern.

**Fix:** Remove `localProductLines`, `localItemNames`, `localCategories` state. Instead, track only new items created during the current form session:

```ts
const [newProductLines, setNewProductLines] = useState<ProductLine[]>([]);
const [newItemNames, setNewItemNames] = useState<ItemName[]>([]);
const [newCategories, setNewCategories] = useState<Category[]>([]);
```

Derive the full list inline: `[...productLines, ...newProductLines]`. Props remain the source of truth.

---

### 7. Fix indentation in `page.tsx`

**Problem:** Lines ~537–545 in `page.tsx` have inconsistent indentation that makes the JSX nesting confusing to read.

**Fix:** Correct indentation to match the surrounding context.

---

## What Does NOT Change

- `fetchSessionsClient` stays client-side (intentional per CLAUDE.md — avoids Next.js serialization issues)
- No custom hooks extracted
- No file reorganization beyond adding `src/components/ui/`
- All existing behavior preserved

---

## Testing

Since there are no automated tests, verify manually after each change:
1. App loads and displays packaging items
2. Selecting an item shows its upload sessions
3. Category badges display correctly in sidebar and main content
4. Uploading files works and sends email notification
5. Status changes and note additions send email notifications
6. Creating/editing a packaging item works, including inline creation of categories, product lines, and item names
