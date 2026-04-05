# Purchase Orders Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Purchase Orders line items and dropdowns to use Nexus dark design system tokens instead of white/light backgrounds.

**Architecture:** Replace hardcoded Tailwind light-mode classes with Nexus CSS custom property tokens. Portal dropdowns get glass effect. Status badges get darkened versions of current semantic colors.

**Tech Stack:** Next.js, React, Tailwind CSS, Nexus design tokens (CSS custom properties)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/orders/OrderItemRow.tsx` | Modify | Row container, inputs, drag handle, delete button |
| `src/components/orders/ItemOrderStatusDropdown.tsx` | Modify | Status badge colors, dropdown panel |
| `src/components/orders/PriorityDropdown.tsx` | Modify | Priority badge colors, dropdown panel |
| `src/components/packaging/ItemStatusDropdown.tsx` | Modify | Dropdown panel only (badges already dark) |
| `src/components/packaging/ItemNameCombobox.tsx` | Modify | Trigger, input, portal dropdown, list items |
| `src/components/packaging/CategorySelector.tsx` | Modify | Trigger, portal dropdown, search, list items |
| `src/components/packaging/VersionCombobox.tsx` | Modify | Trigger, input, portal dropdown, list items |

---

### Task 1: Update OrderItemRow.tsx

**Files:**
- Modify: `src/components/orders/OrderItemRow.tsx`

- [ ] **Step 1: Update row container classes**

Find line ~197:
```tsx
className={`group flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100 last:border-0 text-xs bg-white ${
  isDragging ? 'shadow-lg rounded-lg border border-indigo-400 z-10' : ''
} ${deleting ? 'opacity-50 pointer-events-none' : ''}`}
```

Replace with:
```tsx
className={`group flex items-center gap-1.5 px-2 py-1.5 border-b border-border last:border-0 text-xs bg-surface-raised ${
  isDragging ? 'shadow-lg rounded-lg border border-primary z-10' : ''
} ${deleting ? 'opacity-50 pointer-events-none' : ''}`}
```

- [ ] **Step 2: Update drag handle colors**

Find line ~203:
```tsx
className="w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
```

Replace with:
```tsx
className="w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity text-foreground-subtle hover:text-foreground-muted"
```

- [ ] **Step 3: Update QTY input styling**

Find line ~242:
```tsx
className="w-[4.8rem] border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
```

Replace with:
```tsx
className="w-[4.8rem] border border-border rounded px-1.5 py-1 text-xs bg-surface-raised text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-right"
```

- [ ] **Step 4: Update Notes input styling**

Find line ~271:
```tsx
className="flex-1 min-w-0 border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
```

Replace with:
```tsx
className="flex-1 min-w-0 border border-border rounded px-1.5 py-1 text-xs bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-ring"
```

- [ ] **Step 5: Update delete button styling**

Find line ~280:
```tsx
className="p-1 text-gray-300 hover:text-red-500 transition-colors"
```

Replace with:
```tsx
className="p-1 text-foreground-subtle hover:text-destructive transition-colors"
```

- [ ] **Step 6: Verify changes visually**

Run: `cd /Users/macbook/Documents/AI\ Dev\ Projects/Artwork\ Review\ Tool/nexus && npm run dev`

Open http://localhost:3000/orders and verify:
- Row backgrounds are dark slate (#2d3448)
- Inputs have dark backgrounds with visible borders
- Drag handle and delete button use muted colors

- [ ] **Step 7: Commit**

```bash
git add src/components/orders/OrderItemRow.tsx
git commit -m "feat(orders): apply dark theme to OrderItemRow

- Row container: bg-surface-raised, border-border
- Inputs: dark backgrounds with ring focus
- Drag handle and delete button: foreground tokens"
```

---

### Task 2: Update ItemOrderStatusDropdown.tsx

**Files:**
- Modify: `src/components/orders/ItemOrderStatusDropdown.tsx`

- [ ] **Step 1: Update ORDER_STATUS_CONFIG badge colors**

Find lines ~6-22:
```tsx
const ORDER_STATUS_CONFIG: Record<ItemOrderStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  new: {
    label: 'New',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  final: {
    label: 'Final',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  cancel: {
    label: 'Cancel',
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
} as const;
```

Replace with:
```tsx
const ORDER_STATUS_CONFIG: Record<ItemOrderStatus, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  new: {
    label: 'New',
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-700/50',
  },
  final: {
    label: 'Final',
    bg: 'bg-green-900/30',
    text: 'text-green-400',
    border: 'border-green-700/50',
  },
  cancel: {
    label: 'Cancel',
    bg: 'bg-gray-800/50',
    text: 'text-gray-400',
    border: 'border-gray-600/50',
  },
} as const;
```

- [ ] **Step 2: Update dropdown panel styling**

Find line ~76:
```tsx
<div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
```

Replace with:
```tsx
<div className="absolute left-0 top-full mt-1 glass border-border rounded-lg shadow-lg z-50 min-w-[120px]">
```

- [ ] **Step 3: Update dropdown list item styling**

Find line ~83:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
  isSelected ? 'bg-gray-50' : ''
}`}
```

Replace with:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay flex items-center gap-2 ${
  isSelected ? 'bg-surface-overlay' : ''
}`}
```

- [ ] **Step 4: Update checkmark color**

Find line ~92:
```tsx
<svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 5: Verify changes visually**

Open http://localhost:3000/orders and verify:
- Status badges have dark backgrounds with colored text
- Dropdown has glass blur effect
- Hover states are dark

- [ ] **Step 6: Commit**

```bash
git add src/components/orders/ItemOrderStatusDropdown.tsx
git commit -m "feat(orders): apply dark theme to ItemOrderStatusDropdown

- Badge colors: darkened semantic backgrounds
- Dropdown: glass effect with surface-overlay hover"
```

---

### Task 3: Update PriorityDropdown.tsx

**Files:**
- Modify: `src/components/orders/PriorityDropdown.tsx`

- [ ] **Step 1: Update PRIORITY_CONFIG badge colors**

Find lines ~6-24:
```tsx
const PRIORITY_CONFIG: Record<ItemPriority, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  '1_critical': {
    label: '1 - Critical',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  '2_standard': {
    label: '2 - Standard',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  '3_low': {
    label: '3 - Low',
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
} as const;
```

Replace with:
```tsx
const PRIORITY_CONFIG: Record<ItemPriority, {
  label: string;
  bg: string;
  text: string;
  border: string;
}> = {
  '1_critical': {
    label: '1 - Critical',
    bg: 'bg-red-900/30',
    text: 'text-red-400',
    border: 'border-red-700/50',
  },
  '2_standard': {
    label: '2 - Standard',
    bg: 'bg-blue-900/30',
    text: 'text-blue-400',
    border: 'border-blue-700/50',
  },
  '3_low': {
    label: '3 - Low',
    bg: 'bg-gray-800/50',
    text: 'text-gray-400',
    border: 'border-gray-600/50',
  },
} as const;
```

- [ ] **Step 2: Update dropdown panel styling**

Find line ~76:
```tsx
<div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[161px]">
```

Replace with:
```tsx
<div className="absolute left-0 top-full mt-1 glass border-border rounded-lg shadow-lg z-50 min-w-[161px]">
```

- [ ] **Step 3: Update dropdown list item styling**

Find line ~83:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
  isSelected ? 'bg-gray-50' : ''
}`}
```

Replace with:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay flex items-center gap-2 ${
  isSelected ? 'bg-surface-overlay' : ''
}`}
```

- [ ] **Step 4: Update checkmark color**

Find line ~92:
```tsx
<svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 5: Commit**

```bash
git add src/components/orders/PriorityDropdown.tsx
git commit -m "feat(orders): apply dark theme to PriorityDropdown

- Badge colors: darkened semantic backgrounds
- Dropdown: glass effect with surface-overlay hover"
```

---

### Task 4: Update ItemStatusDropdown.tsx

**Files:**
- Modify: `src/components/packaging/ItemStatusDropdown.tsx`

- [ ] **Step 1: Update dropdown panel styling**

Find line ~52:
```tsx
<div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]">
```

Replace with:
```tsx
<div className="absolute left-0 top-full mt-1 glass border-border rounded-lg shadow-lg z-50 min-w-[140px]">
```

- [ ] **Step 2: Update dropdown list item styling**

Find line ~59:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
  isSelected ? 'bg-gray-50' : ''
}`}
```

Replace with:
```tsx
className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay flex items-center gap-2 ${
  isSelected ? 'bg-surface-overlay' : ''
}`}
```

- [ ] **Step 3: Update checkmark color**

Find line ~68:
```tsx
<svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 4: Commit**

```bash
git add src/components/packaging/ItemStatusDropdown.tsx
git commit -m "feat(packaging): apply dark theme to ItemStatusDropdown dropdown panel"
```

---

### Task 5: Update ItemNameCombobox.tsx

**Files:**
- Modify: `src/components/packaging/ItemNameCombobox.tsx`

- [ ] **Step 1: Update compact trigger styling**

Find line ~150:
```tsx
className="w-full h-[26px] flex items-center gap-1 px-1.5 border border-gray-200 rounded cursor-pointer hover:border-gray-300 bg-white text-xs"
```

Replace with:
```tsx
className="w-full h-[26px] flex items-center gap-1 px-1.5 border border-border rounded cursor-pointer hover:border-foreground-subtle bg-surface-raised text-xs"
```

- [ ] **Step 2: Update compact trigger text colors**

Find line ~158:
```tsx
<span className="text-xs font-bold text-gray-900 truncate">
```

Replace with:
```tsx
<span className="text-xs font-bold text-foreground truncate">
```

Find line ~161:
```tsx
<svg className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-3 h-3 text-foreground-subtle flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 3: Update default variant selected tag**

Find line ~169:
```tsx
<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
```

Replace with:
```tsx
<span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-subtle text-primary rounded-full text-sm font-medium">
```

Find line ~178:
```tsx
className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
```

Replace with:
```tsx
className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
```

- [ ] **Step 4: Update change button**

Find line ~188:
```tsx
className="text-sm text-gray-500 hover:text-gray-700"
```

Replace with:
```tsx
className="text-sm text-foreground-muted hover:text-foreground"
```

- [ ] **Step 5: Update input styling**

Find line ~199:
```tsx
className={variant === 'compact'
  ? 'w-full h-[26px] px-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent'
  : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
}
```

Replace with:
```tsx
className={variant === 'compact'
  ? 'w-full h-[26px] px-1.5 border border-border rounded text-xs bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent'
  : 'w-full px-3 py-2 border border-border rounded-md bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent'
}
```

- [ ] **Step 6: Update portal dropdown container**

Find line ~206:
```tsx
className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-96 min-h-64 flex flex-col overflow-hidden"
```

Replace with:
```tsx
className="fixed glass border-border rounded-md shadow-lg max-h-96 min-h-64 flex flex-col overflow-hidden"
```

- [ ] **Step 7: Update edit input in dropdown**

Find line ~222:
```tsx
className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
```

Replace with:
```tsx
className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface-raised text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
```

- [ ] **Step 8: Update edit action buttons**

Find line ~229:
```tsx
className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
```

Replace with:
```tsx
className="p-1 text-success hover:text-success hover:bg-success-subtle rounded transition-colors disabled:opacity-50"
```

Find line ~237:
```tsx
className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
```

Replace with:
```tsx
className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors disabled:opacity-50"
```

- [ ] **Step 9: Update list item styling**

Find line ~251:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group cursor-pointer ${
  highlightedIndex === index
    ? 'bg-blue-50 text-blue-900'
    : 'hover:bg-gray-50'
}`}
```

Replace with:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between group cursor-pointer ${
  highlightedIndex === index
    ? 'bg-primary-subtle text-primary'
    : 'hover:bg-surface-overlay'
}`}
```

- [ ] **Step 10: Update edit pencil button**

Find line ~256:
```tsx
className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors opacity-0 group-hover:opacity-100"
```

Replace with:
```tsx
className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors opacity-0 group-hover:opacity-100"
```

- [ ] **Step 11: Update empty state and create option**

Find line ~270:
```tsx
<li className="px-4 py-3 text-sm text-gray-500 text-center">
```

Replace with:
```tsx
<li className="px-4 py-3 text-sm text-foreground-muted text-center">
```

Find line ~279:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
  highlightedIndex === filteredItemNames.length
    ? 'bg-blue-50 text-blue-900'
    : 'hover:bg-gray-50'
} ${isCreating ? 'opacity-50' : ''}`}
```

Replace with:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
  highlightedIndex === filteredItemNames.length
    ? 'bg-primary-subtle text-primary'
    : 'hover:bg-surface-overlay'
} ${isCreating ? 'opacity-50' : ''}`}
```

Find line ~285:
```tsx
<svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 12: Commit**

```bash
git add src/components/packaging/ItemNameCombobox.tsx
git commit -m "feat(packaging): apply dark theme to ItemNameCombobox

- Trigger and inputs: surface-raised background
- Portal dropdown: glass effect
- List items: primary-subtle highlight, surface-overlay hover"
```

---

### Task 6: Update CategorySelector.tsx

**Files:**
- Modify: `src/components/packaging/CategorySelector.tsx`

- [ ] **Step 1: Update compact trigger styling**

Find line ~47:
```tsx
className="flex items-center gap-1 w-full px-1.5 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 bg-white"
```

Replace with:
```tsx
className="flex items-center gap-1 w-full px-1.5 py-1 border border-border rounded cursor-pointer hover:border-foreground-subtle bg-surface-raised"
```

- [ ] **Step 2: Update compact trigger chevron and placeholder**

Find line ~64:
```tsx
<svg className="w-2.5 h-2.5 text-gray-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with (both occurrences in compact variant):
```tsx
<svg className="w-2.5 h-2.5 text-foreground-subtle ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Find line ~69:
```tsx
<span className="text-gray-400 text-xs">— Cat —</span>
```

Replace with:
```tsx
<span className="text-foreground-subtle text-xs">— Cat —</span>
```

- [ ] **Step 3: Update default variant trigger**

Find line ~78:
```tsx
className="w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
```

Replace with:
```tsx
className="w-full px-3 py-2 border border-border rounded-md cursor-pointer hover:border-foreground-subtle bg-surface-raised focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent"
```

Find line ~97:
```tsx
<span className="text-sm text-gray-500">
```

Replace with:
```tsx
<span className="text-sm text-foreground-muted">
```

Find line ~101:
```tsx
<span className="text-gray-400">Select a category...</span>
```

Replace with:
```tsx
<span className="text-foreground-subtle">Select a category...</span>
```

- [ ] **Step 4: Update portal dropdown container**

Find line ~108:
```tsx
className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-96 flex flex-col overflow-hidden"
```

Replace with:
```tsx
className="fixed glass border-border rounded-md shadow-lg max-h-96 flex flex-col overflow-hidden"
```

- [ ] **Step 5: Update search input**

Find line ~118:
```tsx
<div className="p-2 border-b border-gray-100">
```

Replace with:
```tsx
<div className="p-2 border-b border-border">
```

Find line ~124:
```tsx
className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
```

Replace with:
```tsx
className="w-full px-3 py-2 border border-border rounded-md bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
```

- [ ] **Step 6: Update list item styling**

Find line ~139:
```tsx
className={`w-full text-left px-2.5 py-1.5 hover:bg-gray-50 ${
  selectedId === category.id ? 'bg-blue-50' : ''
} ${onEdit ? 'pr-9' : ''}`}
```

Replace with:
```tsx
className={`w-full text-left px-2.5 py-1.5 hover:bg-surface-overlay ${
  selectedId === category.id ? 'bg-primary-subtle' : ''
} ${onEdit ? 'pr-9' : ''}`}
```

- [ ] **Step 7: Update dimension text**

Find line ~155:
```tsx
<div className="text-xs text-gray-500 mt-0.5">
```

Replace with:
```tsx
<div className="text-xs text-foreground-muted mt-0.5">
```

- [ ] **Step 8: Update edit button**

Find line ~165:
```tsx
className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
```

Replace with:
```tsx
className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded opacity-0 group-hover:opacity-100 transition-opacity"
```

- [ ] **Step 9: Update empty state**

Find line ~179:
```tsx
<li className="px-4 py-3 text-sm text-gray-500 text-center">
```

Replace with:
```tsx
<li className="px-4 py-3 text-sm text-foreground-muted text-center">
```

- [ ] **Step 10: Update create button**

Find line ~184:
```tsx
<div className="p-1.5 border-t border-gray-100 flex-shrink-0">
```

Replace with:
```tsx
<div className="p-1.5 border-t border-border flex-shrink-0">
```

Find line ~192:
```tsx
className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
```

Replace with:
```tsx
className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-primary hover:bg-primary-subtle rounded transition-colors"
```

- [ ] **Step 11: Update default variant detail section**

Find line ~202:
```tsx
<div className="mt-2 p-3 bg-gray-50 rounded-md">
```

Replace with:
```tsx
<div className="mt-2 p-3 bg-surface rounded-md">
```

Find line ~203:
```tsx
<p className="text-sm text-gray-600">
```

Replace with:
```tsx
<p className="text-sm text-foreground-muted">
```

- [ ] **Step 12: Commit**

```bash
git add src/components/packaging/CategorySelector.tsx
git commit -m "feat(packaging): apply dark theme to CategorySelector

- Triggers: surface-raised background
- Portal dropdown: glass effect
- Search input: dark styling
- List items: primary-subtle selected, surface-overlay hover"
```

---

### Task 7: Update VersionCombobox.tsx

**Files:**
- Modify: `src/components/packaging/VersionCombobox.tsx`

- [ ] **Step 1: Update disabled state styling**

Find line ~101:
```tsx
className={isCompact
  ? 'px-1.5 py-1 border border-gray-200 rounded bg-gray-50 text-gray-400 text-xs'
  : 'px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-400'
}
```

Replace with:
```tsx
className={isCompact
  ? 'px-1.5 py-1 border border-border rounded bg-surface text-foreground-subtle text-xs'
  : 'px-3 py-2 border border-border rounded-md bg-surface text-foreground-subtle'
}
```

- [ ] **Step 2: Update closed trigger styling**

Find line ~113:
```tsx
className={isCompact
  ? 'flex items-center gap-1 px-1.5 py-1 border border-gray-200 rounded cursor-pointer hover:border-gray-300 text-xs bg-white'
  : 'flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md cursor-pointer hover:border-gray-400'
}
```

Replace with:
```tsx
className={isCompact
  ? 'flex items-center gap-1 px-1.5 py-1 border border-border rounded cursor-pointer hover:border-foreground-subtle text-xs bg-surface-raised'
  : 'flex items-center gap-2 px-3 py-2 border border-border rounded-md cursor-pointer hover:border-foreground-subtle bg-surface-raised'
}
```

- [ ] **Step 3: Update trigger text colors**

Find line ~119:
```tsx
<span className={selectedVersion ? '' : 'text-gray-400'}>
```

Replace with:
```tsx
<span className={selectedVersion ? 'text-foreground' : 'text-foreground-subtle'}>
```

Find line ~122:
```tsx
<svg className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-gray-400 ml-auto flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} text-foreground-subtle ml-auto flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 4: Update open input styling**

Find line ~129:
```tsx
className={isCompact
  ? 'w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500'
  : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
}
```

Replace with:
```tsx
className={isCompact
  ? 'w-full px-1.5 py-1 border border-border rounded text-xs bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-ring'
  : 'w-full px-3 py-2 border border-border rounded-md bg-surface-raised text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent'
}
```

- [ ] **Step 5: Update portal dropdown container**

Find line ~139:
```tsx
className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden"
```

Replace with:
```tsx
className="fixed glass border-border rounded-md shadow-lg max-h-60 overflow-hidden"
```

- [ ] **Step 6: Update list item styling**

Find line ~150:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
  highlightedIndex === index
    ? 'bg-blue-50 text-blue-900'
    : 'hover:bg-gray-50'
} ${selectedVersion === v.version ? 'font-medium' : ''}`}
```

Replace with:
```tsx
className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
  highlightedIndex === index
    ? 'bg-primary-subtle text-primary'
    : 'hover:bg-surface-overlay'
} ${selectedVersion === v.version ? 'font-medium' : ''}`}
```

- [ ] **Step 7: Update checkmark color**

Find line ~157:
```tsx
<svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

Replace with:
```tsx
<svg className="w-4 h-4 text-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
```

- [ ] **Step 8: Update empty state**

Find line ~166:
```tsx
<li className="px-4 py-3 text-sm text-gray-500 text-center">
```

Replace with:
```tsx
<li className="px-4 py-3 text-sm text-foreground-muted text-center">
```

- [ ] **Step 9: Update create version section**

Find line ~171:
```tsx
<div className="border-t border-gray-100 p-2">
```

Replace with:
```tsx
<div className="border-t border-border p-2">
```

Find line ~180:
```tsx
className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
```

Replace with:
```tsx
className="flex-1 px-2 py-1 border border-border rounded text-sm bg-surface-raised text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
```

- [ ] **Step 10: Update confirm/cancel buttons**

Find line ~188:
```tsx
className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
```

Replace with:
```tsx
className="p-1 text-success hover:text-success hover:bg-success-subtle rounded transition-colors disabled:opacity-50"
```

Find line ~196:
```tsx
className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
```

Replace with:
```tsx
className="p-1 text-foreground-subtle hover:text-foreground-muted hover:bg-surface-overlay rounded transition-colors"
```

- [ ] **Step 11: Update create button**

Find line ~207:
```tsx
className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
```

Replace with:
```tsx
className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary-subtle rounded-md transition-colors"
```

- [ ] **Step 12: Commit**

```bash
git add src/components/packaging/VersionCombobox.tsx
git commit -m "feat(packaging): apply dark theme to VersionCombobox

- Triggers and inputs: surface-raised background
- Portal dropdown: glass effect
- List items: primary-subtle highlight, surface-overlay hover"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run development server**

```bash
cd /Users/macbook/Documents/AI\ Dev\ Projects/Artwork\ Review\ Tool/nexus && npm run dev
```

- [ ] **Step 2: Visual verification checklist**

Open http://localhost:3000/orders and verify:
- [ ] Order item rows have dark slate backgrounds
- [ ] All inputs (QTY, Notes) have dark backgrounds with visible text
- [ ] Priority dropdown badges are readable with darkened backgrounds
- [ ] Order Status dropdown badges are readable with darkened backgrounds
- [ ] Approval Status dropdown uses glass effect
- [ ] Item Name combobox trigger and dropdown are dark themed
- [ ] Category selector trigger and dropdown are dark themed
- [ ] Version combobox trigger and dropdown are dark themed
- [ ] All hover states work correctly
- [ ] All dropdowns have glass blur effect
- [ ] Focus rings are visible (blue primary color)
- [ ] Drag and drop still works
- [ ] Keyboard navigation still works in comboboxes

- [ ] **Step 3: Run type check**

```bash
cd /Users/macbook/Documents/AI\ Dev\ Projects/Artwork\ Review\ Tool/nexus && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 4: Run lint**

```bash
cd /Users/macbook/Documents/AI\ Dev\ Projects/Artwork\ Review\ Tool/nexus && npm run lint
```

Expected: No lint errors

- [ ] **Step 5: Final commit for plan file**

```bash
git add docs/superpowers/plans/2026-03-31-purchase-orders-dark-theme.md
git commit -m "docs: add implementation plan for purchase orders dark theme"
```
