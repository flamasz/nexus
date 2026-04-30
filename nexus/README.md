# Nexus

Nexus is a Next.js app for managing packaging artwork reviews. Teams upload artwork files against packaging items, admins review them, and the app sends email notifications for uploads and review events.

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase for Postgres, Auth, and Storage
- Tailwind CSS 4
- Resend for email delivery

## Local App Setup

Run everything from [`nexus/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus).

1. Install dependencies:

```bash
npm install
```

2. Create `nexus/.env.local` from [`nexus/.env.example`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/.env.example) and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Project Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Supabase Notes

- SQL migrations live in [`nexus/supabase/migrations/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/supabase/migrations).
- Storage bucket setup lives in [`nexus/supabase/storage_setup.sql`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/supabase/storage_setup.sql).
- The app expects a `packaging-files` storage bucket.

## Develop With Pi

Install Pi from the official package:

```bash
npm install -g @mariozechner/pi-coding-agent
```

Then start Pi inside the app directory:

```bash
cd nexus
pi
```

Authenticate either with `/login` inside Pi or by exporting a supported provider API key before launch. Pi's official quick start supports both flows.

When you run Pi from `nexus/`, it can use the repo guidance already present in:

- [`AGENTS.md`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/AGENTS.md)
- [`nexus/CLAUDE.md`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/CLAUDE.md)

Project-local Pi additions for this repo live in:

- [`nexus/.pi/skills/nexus-dev/SKILL.md`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/.pi/skills/nexus-dev/SKILL.md)
- [`nexus/.pi/prompts/ship.md`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/.pi/prompts/ship.md)

Useful Pi flows for this app:

- `/skill:nexus-dev` for project context and verification expectations
- `/ship` for a final pass before declaring work complete
- `@src/...` to attach files into the prompt quickly

## Working Areas

- [`nexus/src/app/(protected)/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/src/app/(protected)) for the authenticated app routes
- [`nexus/src/app/actions/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/src/app/actions) for server actions
- [`nexus/src/components/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/src/components) for UI
- [`nexus/src/lib/supabase/`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/src/lib/supabase) for Supabase clients and middleware
- [`nexus/src/types/database.ts`](/Users/macbook/Documents/AI%20Dev%20Projects/Artwork%20Review%20Tool/nexus/src/types/database.ts) for database types
