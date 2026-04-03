# Revision 1: Order Items Field Upgrades

## Summary

Replace the simple `<select>` dropdowns in the Order Items row with the same advanced components used in the Packaging Form. Each component gets a `variant="compact"` prop for inline row usage. Two new components are created (VersionCombobox, ItemOrderStatusDropdown). The QTY field spinner buttons are hidden via CSS.

## Decisions

- **Reuse strategy:** Adapt existing components in-place with a `variant` prop (default | compact), rather than extracting shared primitives or creating separate components.
- **Version field:** Structured creation with "+ Create new version" button (mirrors ItemNameCombobox pattern). No new DB table — versions remain plain strings.
- **Dropdown positioning:** Floating dropdown below the field using portal rendering (same as existing CategorySelector pattern).
- **Scope:** Order Items fields only. The general note about consistency elsewhere is achieved by these components being reusable — any future usage can import them with the appropriate variant.

## Component Changes

### 1. ItemNameCombobox (MODIFY)

**File:** `src/components/packaging/ItemNameCombobox.tsx`

Add `variant?: 'default' | 'compact'` prop.

- **default (unchanged):** Current behavior — full-size trigger with label support, pill badge, "Change" button.
- **compact:** Smaller trigger (reduced padding, smaller font). Pill badge stays. No "Change" text — just show dropdown chevron. Dropdown panel is identical in both variants.

Props interface stays the same, just adds `variant`.

### 2. CategorySelector (MODIFY)

**File:** `src/components/packaging/CategorySelector.tsx`

Add `variant?: 'default' | 'compact'` prop.

- **default (unchanged):** Current behavior — full-size trigger with color dot, name, dimensions text, "Change" link. Dimensions info box shown below when selected.
- **compact:** Smaller trigger with color dot + category name (truncated with ellipsis if too long). No dimensions info box below. Dropdown panel is identical — still shows colors, dimensions, edit buttons.

### 3. ItemStatusDropdown (MODIFY)

**File:** `src/components/packaging/ItemStatusDropdown.tsx`

Add `variant?: 'default' | 'compact'` prop.

- **default (unchanged):** Current color-coded pill badge with dropdown.
- **compact:** Same pill badge but smaller (reduced padding, smaller font). Dropdown panel identical.

Used for the **Approval Status** field in OrderItemRow.

### 4. VersionCombobox (CREATE)

**File:** `src/components/packaging/VersionCombobox.tsx`

New component modeled after ItemNameCombobox.

**Props:**
- `versions: string[]` — list of existing version strings for the current item_name + category combination
- `selectedVersion: string | null`
- `onSelect: (version: string) => void`
- `onCreate: (version: string) => void`
- `disabled?: boolean` — true when item_name_id or category_id is null
- `variant?: 'default' | 'compact'`

**Behavior:**
- Searchable dropdown showing existing versions
- "+ Create new version" button at bottom of dropdown
- Clicking "+ Create new version" shows inline text input within the dropdown to type the new version string, with confirm/cancel
- Disabled state shown with grayed-out appearance and "Select item & category first" placeholder
- Keyboard navigation: arrow keys, enter to select, escape to close

### 5. ItemOrderStatusDropdown (CREATE)

**File:** `src/components/orders/ItemOrderStatusDropdown.tsx`

New component modeled after ItemStatusDropdown.

**Props:**
- `status: ItemOrderStatus` — 'new' | 'final' | 'cancel'
- `onStatusChange: (status: ItemOrderStatus) => Promise<void>`
- `variant?: 'default' | 'compact'`

**Color config:**
- new: red (bg-red-50, text-red-600, border-red-200)
- final: green (bg-green-50, text-green-700, border-green-200)
- cancel: gray (bg-gray-50, text-gray-500, border-gray-200)

**Behavior:** Same as ItemStatusDropdown — colored pill trigger, click opens dropdown with all options in their colors, selecting an option calls onStatusChange.

### 6. QTY Field (CSS FIX)

**File:** `src/app/globals.css`

Add CSS to hide number input spinner buttons:

```css
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```

Applied globally — removes spinners from all number inputs app-wide.

## OrderItemRow Rewrite

**File:** `src/components/orders/OrderItemRow.tsx`

Replace the 4 `<select>` elements and update the QTY input:

| Field | Current | After |
|-------|---------|-------|
| Item Name | `<select>` | `<ItemNameCombobox variant="compact" />` |
| Category | `<select>` | `<CategorySelector variant="compact" />` |
| Version | `<select>` | `<VersionCombobox variant="compact" />` |
| Approval Status | `<select>` | `<ItemStatusDropdown variant="compact" />` |
| QTY | `<input type="number">` with spinners | Same input, spinners hidden by global CSS |
| Item Order Status | `<select>` | `<ItemOrderStatusDropdown variant="compact" />` |

The existing debounce logic for QTY and Notes stays unchanged. The version dependency logic (disabled until item_name + category selected, re-fetches on change) stays unchanged but moves into VersionCombobox's disabled prop.

## What Does NOT Change

- **Database schema** — no new tables, no column changes
- **Server actions** — all existing actions (updateOrderItem, getVersionsForItemCategory, createItemName, createCategory, etc.) remain as-is
- **PackagingForm** — continues using default variant of all components, no behavior change
- **Data flow** — OrderItemRow still manages state the same way, just passes it to richer components instead of raw selects
- **Notes field** — stays as a text input with debounce
- **Artwork button** — unchanged
- **Delete button** — unchanged
