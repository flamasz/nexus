# Nexus – Packaging Artwork Management System

A Next.js web app for managing and reviewing packaging artwork files. Users upload artwork files against packaging items; admins review and approve/reject them. Email notifications are sent on uploads, status changes, and notes.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Database & Auth:** Supabase (Postgres + Auth + Storage)
- **Styling:** Tailwind CSS
- **Email:** Resend (via `/api/email` route)
- **Path alias:** `@/` → `src/`

## Commands

Run from the `nexus/` directory:

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Project Structure

```
nexus/src/
├── app/
│   ├── (auth)/              # Public routes: /login, /register
│   ├── (protected)/         # Auth-gated routes: /, /admin, /settings
│   ├── actions/             # Next.js Server Actions (DB mutations)
│   │   ├── packaging.ts     # PackagingItem CRUD
│   │   ├── uploads.ts       # UploadSession CRUD
│   │   ├── categories.ts
│   │   ├── productLines.ts
│   │   ├── itemNames.ts
│   │   ├── settings.ts
│   │   └── users.ts
│   └── api/email/route.ts   # Email notification API route
├── components/
│   ├── layout/              # Header, Sidebar
│   ├── packaging/           # PackagingForm, CategorySelector, etc.
│   └── uploads/             # DropZone, UploadSessionCard, etc.
├── lib/
│   ├── supabase/
│   │   ├── client.ts        # Browser Supabase client
│   │   ├── server.ts        # Server Supabase client
│   │   └── middleware.ts    # Session refresh middleware
│   ├── email.ts             # Resend email helpers
│   ├── categoryColors.ts    # Category color utilities
│   ├── constants.ts         # APP_NAME, APP_DESCRIPTION
│   ├── itemStatus.ts        # ItemStatus helpers
│   └── utils/               # formatHST, formatFileSize, formatDimensions, statusConfig
└── types/
    └── database.ts          # All TypeScript types + Database interface
```

## Data Model

| Table | Description |
|---|---|
| `users` | App users with `role: 'user' \| 'admin'` and `organization_id` |
| `organizations` | Multi-tenant organization grouping |
| `categories` | Packaging categories with dimensions (w/h/d + unit) and color |
| `product_lines` | Product line groupings |
| `item_names` | Reusable item name labels |
| `packaging_items` | Core entity — links item_name + category + product_line; has `status: 'new' \| 'in_progress' \| 'approved' \| 'superceded'` and `archived` flag |
| `upload_sessions` | A batch of files uploaded against a packaging item; has `status: 'uploaded' \| 'approved' \| 'rejected'` |
| `files` | Individual file records with `storage_path` in Supabase Storage bucket `packaging-files` |

## Architecture Patterns

**Server Actions vs. client queries:** DB mutations go through Server Actions in `src/app/actions/`. The main page (`(protected)/page.tsx`) fetches `upload_sessions` and `files` directly via the browser Supabase client to avoid Next.js serialization issues with complex joined data.

**Auth:** Supabase Auth + SSR session cookies. Middleware at `src/middleware.ts` refreshes the session on every request. Route groups enforce auth: `(protected)/layout.tsx` checks the session; `(auth)/` is public.

**File uploads:** Files go directly to Supabase Storage (`packaging-files` bucket) from the browser client. File paths follow `{packagingItemId}/{timestamp}_{sanitizedFileName}`. A Server Action then records the session and file metadata in the DB.

**Email notifications:** Triggered client-side via `POST /api/email` after uploads, status changes (to `approved`/`rejected`), and first-time notes. All org users receive notifications.

**State management:** The main page is a single large client component managing all state in React. Data is loaded once on mount; subsequent mutations update state optimistically/locally after server action resolves.

**URL state:** Selected packaging item ID is reflected in `?id=` query param via `window.history.replaceState` (no Next.js navigation triggered).

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Used server-side for privileged queries
RESEND_API_KEY=                  # For email notifications
NEXT_PUBLIC_APP_URL=             # Used in email links (e.g. http://localhost:3000)
```

## Roles & Permissions

- `user`: Can upload files, add notes, view all items in their org
- `admin`: Can additionally approve/reject uploads, manage users, manage categories/settings

Admin-only actions are gated by checking `user.role === 'admin'` in both UI and server actions.
