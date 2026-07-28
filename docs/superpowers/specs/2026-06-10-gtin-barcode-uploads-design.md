# GTIN Tab Barcode Uploads — Design

**Date:** 2026-06-10
**Status:** Approved

## Summary

On the Items page item-detail pane, rename the "GS1" tab to "GTIN" and add a barcode-file upload area beneath the existing GS1 product fields. Uploaded barcode files are listed above the upload area, each row showing a file-type icon and the full file name, with a delete control.

## Goals

- Rename the tab label `GS1` → `GTIN` (internal tab key unchanged).
- Keep the existing GS1 product-link fields; add the upload area below them.
- Let users upload barcode files (drag-drop or click) tied to a Business Central item.
- List uploaded files newest-first above the drop zone with file-type icon + full file name.
- Allow deleting an uploaded file.

## Non-Goals

- No review/status/notes/archive workflow (artwork's `upload_sessions` system is **not** reused).
- No changes to artwork upload code (`DropZone`, `ArtworkModal`, `uploads.ts`).
- No new permission flags.

## Decisions (from brainstorming)

1. **Existing panel:** Keep GS1 fields, add upload area below.
2. **Storage model:** Simple flat file list — a new lightweight table, no session workflow.
3. **File types:** Images + PDF + vector — `.png .jpg .jpeg .svg .pdf .eps .ai`.

## Changes

### 1. Rename tab
`nexus/src/components/items/ItemsClient.tsx` (~line 974): change
`{ key: "gs1", label: "GS1" }` → `{ key: "gs1", label: "GTIN" }`.
Internal `TabKey` value `gs1` and all other references stay the same.

### 2. Tab layout
In the `tab === "gs1"` render block (~line 1114), keep `<Gs1FieldsPanel>` and add
`<BarcodeUploadsPanel bcItemId={item.id} canEdit={canEdit} />` underneath it.

### 3. Data model — new migration `037_add_barcode_files.sql`

```
barcode_files
  id                        uuid pk default gen_random_uuid()
  business_central_item_id  uuid  references business_central_items(id) on delete cascade
  organization_id           uuid  not null
  bc_connection_id          uuid  not null
  file_name                 text  not null   -- original full name, shown in list
  file_size                 bigint
  file_type                 text             -- extension, drives the icon
  storage_path              text  not null
  uploaded_by               uuid  references users(id)
  uploaded_at               timestamptz not null default now()
```

- Index on `(business_central_item_id)`.
- RLS policies mirroring the existing items/upload multi-environment scoping
  (org + bc_connection), following the pattern in the latest scoping migrations.

### 4. Storage
Reuse existing `packaging-files` Supabase bucket.
Path: `barcodes/${bcItemId}/${Date.now()}_${sanitizedName}` (using `sanitizeFileName`).
No new bucket.

### 5. Server actions — new `nexus/src/app/actions/barcodeFiles.ts`
- `getBarcodeFiles(bcItemId)` → list rows for the item, newest first, scoped by active BC env (`getActiveBusinessCentralScope`).
- `createBarcodeFile(bcItemId, { name, size, type, storagePath })` → insert row; gated on edit access (`requireActiveBusinessCentralScope`).
- `deleteBarcodeFile(id)` → remove the storage object from `packaging-files` then delete the row; gated on edit access.

### 6. UI components — new under `nexus/src/components/items/`
- **`BarcodeUploadsPanel.tsx`** — loads files via `getBarcodeFiles`, renders the file list above a drop zone. Handles upload client-side (upload to storage like `ArtworkModal.handleFilesSelected`, then call `createBarcodeFile`), and delete. Shows upload progress while uploading. Hides upload/delete controls when `!canEdit`.
- **`BarcodeDropZone.tsx`** — parallel to existing `DropZone`, tuned to accept
  `.png .jpg .jpeg .svg .pdf .eps .ai`. Existing `DropZone` stays untouched.
- **File list rows** — file-type icon mapped from extension via lucide icons
  (`FileImage` for png/jpg/jpeg/svg, `FileText` for pdf, `File` fallback for eps/ai/other)
  plus the full file name; delete button shown when `canEdit`.

### 7. Permissions
Upload and delete are gated on the `canEdit` flag already passed into the GTIN tab
(same gate as editing BC fields). No new permission flags.

## Data flow

1. Panel mounts → `getBarcodeFiles(bcItemId)` → render list.
2. User drops/selects files → client uploads each to `packaging-files` at the barcode path → on success `createBarcodeFile(...)` inserts the row → re-fetch list.
3. User clicks delete → `deleteBarcodeFile(id)` removes storage object + row → update list state.

## Error handling

- Per-file upload errors shown inline in the progress UI (mirrors artwork pattern); other files continue.
- Server actions throw on missing access / item-not-found; the panel surfaces a simple error message.
- Type validation in `BarcodeDropZone`: non-accepted files are skipped with a transient warning.

## Testing

- Manual: rename visible; upload an image/pdf/vector file; file appears in list with correct icon + full name; delete removes it; non-`canEdit` user sees list but no upload/delete.
- Verify artwork upload is unaffected.
