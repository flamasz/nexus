# Purchase Orders Dark Theme Update

**Date:** 2026-03-31  
**Status:** Approved  

## Overview

Update the Purchase Orders page line items and dropdowns to match the Nexus dark design system. Currently, these components use white/light backgrounds that break the dark theme consistency.

## Design Decisions

1. **Row Background:** Use `surface-raised` (#2d3448) for elevated card style
2. **Badge Colors:** Keep current semantic colors but darken backgrounds manually
3. **Dropdown Style:** Use glass effect (blur + transparency) for portal dropdowns

## Components to Update

### 1. OrderItemRow.tsx
| Element | Current | New |
|---------|---------|-----|
| Row container | `bg-white` | `bg-surface-raised` |
| Row border | `border-gray-100` | `border-border` |
| Drag handle | `text-gray-400 hover:text-gray-600` | `text-foreground-subtle hover:text-foreground-muted` |
| QTY input | `bg-white border-gray-200` | `bg-surface-raised border-border` |
| Notes input | `bg-white border-gray-200` | `bg-surface-raised border-border` |
| Focus ring | `focus:ring-blue-500` | `focus:ring-ring` |
| Delete button | `text-gray-300 hover:text-red-500` | `text-foreground-subtle hover:text-destructive` |
| Dragging state | `border-indigo-400` | `border-primary` |

### 2. ItemOrderStatusDropdown.tsx
**Badge Colors (darkened):**
- `new`: `bg-red-900/30 text-red-400 border-red-700/50`
- `final`: `bg-green-900/30 text-green-400 border-green-700/50`
- `cancel`: `bg-gray-800/50 text-gray-400 border-gray-600/50`

**Dropdown Panel:**
- `bg-white border-gray-200` → `glass border-border`
- `hover:bg-gray-50` → `hover:bg-surface-overlay`
- Selected: `bg-gray-50` → `bg-surface-overlay`

### 3. PriorityDropdown.tsx
**Badge Colors (darkened):**
- `1_critical`: `bg-red-900/30 text-red-400 border-red-700/50`
- `2_standard`: `bg-blue-900/30 text-blue-400 border-blue-700/50`
- `3_low`: `bg-gray-800/50 text-gray-400 border-gray-600/50`

**Dropdown Panel:** Same glass treatment as ItemOrderStatusDropdown

### 4. ItemStatusDropdown.tsx
- Badges already use Nexus tokens (no change needed)
- Dropdown panel: `bg-white border-gray-200` → `glass border-border`
- Hover: `hover:bg-gray-50` → `hover:bg-surface-overlay`

### 5. ItemNameCombobox.tsx
| Element | Current | New |
|---------|---------|-----|
| Compact trigger | `bg-white border-gray-200` | `bg-surface-raised border-border` |
| Input field | `border-gray-200/300` | `border-border bg-surface-raised` |
| Portal dropdown | `bg-white border-gray-200` | `glass border-border` |
| List item hover | `hover:bg-gray-50` | `hover:bg-surface-overlay` |
| Highlighted item | `bg-blue-50 text-blue-900` | `bg-primary-subtle text-primary` |
| Edit input | `border-gray-300` | `border-border bg-surface-raised` |
| Text colors | `text-gray-*` | `text-foreground-*` variants |
| Selected tag | `bg-blue-100 text-blue-800` | `bg-primary-subtle text-primary` |

### 6. CategorySelector.tsx
| Element | Current | New |
|---------|---------|-----|
| Compact trigger | `bg-white border-gray-200` | `bg-surface-raised border-border` |
| Default trigger | `border-gray-300` | `border-border` |
| Portal dropdown | `bg-white border-gray-200` | `glass border-border` |
| Search input | `border-gray-300` | `border-border bg-surface-raised` |
| List item hover | `hover:bg-gray-50` | `hover:bg-surface-overlay` |
| Selected item | `bg-blue-50` | `bg-primary-subtle` |
| Edit button | `hover:bg-gray-100` | `hover:bg-surface-overlay` |
| Create button | `text-blue-600 hover:bg-blue-50` | `text-primary hover:bg-primary-subtle` |

### 7. VersionCombobox.tsx
| Element | Current | New |
|---------|---------|-----|
| Disabled state | `bg-gray-50 text-gray-400` | `bg-surface border-border text-foreground-subtle` |
| Closed trigger | `bg-white border-gray-200` | `bg-surface-raised border-border` |
| Open input | `border-gray-200/300` | `border-border bg-surface-raised` |
| Portal dropdown | `bg-white border-gray-200` | `glass border-border` |
| List item hover | `hover:bg-gray-50` | `hover:bg-surface-overlay` |
| Highlighted | `bg-blue-50 text-blue-900` | `bg-primary-subtle text-primary` |
| Create input | `border-gray-300` | `border-border bg-surface-raised` |
| Create button | `text-blue-600 hover:bg-blue-50` | `text-primary hover:bg-primary-subtle` |

## Preserved Functionality

- All event handlers remain unchanged
- Portal positioning logic unchanged
- Keyboard navigation unchanged
- Focus states maintained (ring token)
- Drag-and-drop functionality unchanged

## Token Reference (from globals.css)

```css
--background:        oklch(0.18 0.012 240);   /* #1e2130 */
--surface:           oklch(0.22 0.014 240);   /* #252b3b */
--surface-raised:    oklch(0.26 0.016 240);   /* #2d3448 */
--surface-overlay:   oklch(0.30 0.018 240);   /* #343c52 */
--foreground:        oklch(0.94 0.008 220);   /* #e8edf5 */
--foreground-muted:  oklch(0.65 0.015 230);   /* #8a97b0 */
--foreground-subtle: oklch(0.45 0.012 230);   /* #5a677d */
--primary:           oklch(0.62 0.21 255);    /* #3b82f6 */
--primary-subtle:    oklch(0.62 0.21 255 / 0.15);
--border:            oklch(0.34 0.018 240 / 0.7);
--ring:              var(--primary);
```

## Glass Utility (from globals.css)

```css
.glass {
  background: var(--glass-bg);  /* oklch(0.26 0.016 240 / 0.65) */
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--glass-border);
}
```
