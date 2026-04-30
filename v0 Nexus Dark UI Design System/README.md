# Nexus ERP Design System

Reusable dark-first design system extracted from the current `nexus` app. Use this folder as the starter package/source kit when creating new apps that should look and behave like Nexus.

## What is included

- **Foundations:** Tailwind v4 tokens in `app/globals.css` for slate surfaces, electric-blue primary, semantic status colors, glass utilities, radius scale, scrollbar styling, and number-input normalization.
- **Primitive UI:** shadcn/Radix-style controls under `components/ui` plus `lib/utils.ts`.
- **Semantic Nexus components:** `CategoryBadge`, `ItemStatusBadge`, `UploadStatusBadge`, and `lib/category-colors.ts` for consistent workflow status language.
- **Application shell:** `components/ds/sidebar.tsx` and `components/ds/topbar.tsx` mirror the current Nexus route map, compact nav behavior, organization pill, search, notifications, and user menu.
- **Workflow blueprints:** `components/ds/nexus/*` documents the current app’s artwork workspace, purchase-order editor, upload review flow, admin access editor, and reusable shared demo data.
- **Reuse manifest:** `lib/design-system.ts` describes route groups, source-of-truth files, component families, workflow patterns, and recommended adoption order.

## Recommended adoption path for a new app

1. **Copy foundations first**
   - `app/globals.css`
   - `lib/utils.ts`
   - `postcss.config.mjs`
   - Tailwind v4 setup from this package or from `nexus`

2. **Copy primitive UI**
   - Start with `components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, `popover.tsx`, `select.tsx`, `separator.tsx`, `switch.tsx`, and `tooltip.tsx`.
   - Add additional primitives as the app needs them.

3. **Copy Nexus semantic components**
   - `components/ui/category-badge.tsx`
   - `components/ui/item-status-badge.tsx`
   - `components/ui/upload-status-badge.tsx`
   - `lib/category-colors.ts`

4. **Compose the shell**
   - Start from `components/ds/sidebar.tsx` and `components/ds/topbar.tsx`.
   - Replace demo user/org data with the new app’s auth provider.
   - Keep the route-group shape from `lib/design-system.ts` so permission-aware filtering remains straightforward.

5. **Promote workflow patterns intentionally**
   - Use `components/ds/nexus/packaging-workspace.tsx`, `order-workflow.tsx`, `upload-review.tsx`, and `admin-access.tsx` as UI blueprints.
   - Wire data fetching, mutations, permissions, file storage, and email notifications in the destination app rather than copying Nexus server actions blindly.

## Dependency baseline

The reusable UI expects the same families already used by the current app/design-system:

- `next`, `react`, `react-dom`
- `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`
- `@radix-ui/*` primitives used by copied components
- `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react`
- Optional product wiring: `@supabase/ssr`, `@supabase/supabase-js`, `resend`

Do not add dependencies just for the design system unless a copied primitive requires them.

## Source-of-truth relationship

The live product remains `../nexus`. When Nexus UI changes, sync this design system in this order:

1. Compare `nexus/src/app/globals.css` with `app/globals.css`.
2. Compare `nexus/src/components/layout/*` with `components/ds/sidebar.tsx` and `components/ds/topbar.tsx`.
3. Compare `nexus/src/components/ui/*` with `components/ui/*`.
4. Compare workflow components under `nexus/src/components/{packaging,orders,uploads,admin}` with `components/ds/nexus/*`.
5. Update `lib/design-system.ts` and the Reuse Kit section on the design-system homepage so new apps inherit the latest decisions.

## Import surface

This package exposes a small root index for local/source-package usage:

```ts
import { nexusDesignSystem, Button, CategoryBadge } from 'nexus-design-system'
```

If you copy files into a new app instead of importing this folder as a package, preserve the `@/*` alias or update imports to match the destination app.

## Verification

Run from this directory after dependencies are installed:

```bash
npm run lint
npm run typecheck
npm run build
```

This workspace currently keeps the design system as source files, not a published package. If publishing later, add a bundling step and remove app/demo-only exports from the package entrypoint.
