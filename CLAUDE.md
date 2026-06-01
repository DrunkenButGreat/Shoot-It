# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PhotoShoot Organizer — a self-hosted Next.js app for photographers to manage shoots (projects, participants, moodboards, selection galleries, contracts, callsheets, results, applications, appointments). German is the default UI language; English is always provided alongside.

## Commands

```bash
npm run dev          # Dev server (Turbopack). Assumes Postgres is already running.
npm run devdb        # Start the docker Postgres container, then dev server
npm run build        # Production build (output: 'standalone')
npm run lint         # ESLint (next lint)
npm run format       # Prettier --write .

npm run db:generate  # prisma generate
npm run db:push      # prisma db push (sync schema without a migration)
npm run db:migrate   # prisma migrate dev
npm run db:studio    # Prisma Studio
```

There is **no test suite** in this repo. "Verifying" a change means building/linting and exercising the relevant route manually.

Local dev DB only: `docker compose up -d db`. The full `docker compose up` pulls the prebuilt app image from `ghcr.io/drunkenbutgreat/shoot-it:latest` and is for deployment, not local development.

## Stack & version notes

- **Next.js 16** (App Router) + **React 19** + TypeScript. The README/badges saying "Next.js 15" are stale — trust `package.json`.
- `src/proxy.ts` is the Next.js 16 **proxy** (the renamed `middleware.ts`). It exports `proxy = auth(...)` and a `config.matcher`. `next.config.ts` uses `proxyClientMaxBodySize`. Edit auth/route-protection logic here, not in a `middleware.ts`.
- **Auth.js v5** (`next-auth@5 beta`) with `@auth/prisma-adapter`, **JWT** sessions. Config in `src/auth.ts`. `session.user.id` is populated via the `jwt`/`session` callbacks — rely on it, don't refetch.
- **Prisma 6** + **PostgreSQL 18**. Client is generated to `prisma/generated` (custom output); import the singleton from `@/lib/prisma`, never instantiate `PrismaClient` directly.
- Tailwind 3 + shadcn/ui (`src/components/ui`), Radix primitives, lucide icons, framer-motion, sonner toasts.

## Architecture conventions

### API routes (`src/app/api/**/route.ts`)
Every protected handler follows the same shape — match it:
1. `const session = await auth()`; return `401` if no `session.user.id`.
2. Dynamic params are a **Promise**: `{ params }: { params: Promise<{ id: string }> }`, then `const { id } = await params`.
3. Authorize via `@/lib/permissions`: `canAccessProject` (read), `canEditProject` (write), `getUserRole`. Owner-only actions (e.g. project delete) check `project.ownerId` directly. Return `403` on failure.
4. Validate input with a Zod schema from `@/lib/validations` (often `.partial()` for updates).
5. `try/catch` → `console.error` + `500`.

### Permissions model (`src/lib/permissions.ts`)
Roles are `OWNER | EDITOR | VIEWER` (`ProjectRole`). Access comes from three sources: the project owner, explicit `ProjectAccess` rows, and **participants matched by email** (participants get implicit `VIEWER`). When a user signs up, the `createUser` event in `auth.ts` back-links existing `Participant` rows by email.

### File uploads — filesystem, not the DB
Uploaded images live on disk under `uploads/{moodboard,selection,results}/<projectId>/` (Docker volume `photoshoot_uploads`), with only paths/metadata stored in Postgres. Deleting a project must clean up these dirs (see the DELETE handler in `api/projects/[id]/route.ts`). Use `@/lib/file-utils` for validation and security: `validateUpload`, `generateSecureFilename`, `sanitizePath`/`isPathSafe` (path-traversal prevention). Limits and supported formats are in `src/config/app.config.ts`. Image processing (thumbnails, previews) via Sharp in `@/lib/image-processing`. `next.config.ts` raises Server Action / proxy body limits to 100 MB for large result uploads.

### Public sharing
Projects expose a public 8-char shortcode at `/p/[shortCode]` (`@/lib/shortcode`, charset/length in `app.config.ts`). These routes plus `/`, `/login`, `/signup`, `/api/health`, `/api/auth/register` are the only unauthenticated paths (see `proxy.ts`).

### Localization (i18n) — required for all UI text
Default language **German**; always add the English string too. Strings live in `src/dictionaries/de.json` and `en.json`.
- **Server Components**: `getLocale(cookies)` + `getDictionary(locale)` from `@/lib/i18n` (server-only). The root `layout.tsx` reads the `NEXT_LOCALE` cookie and seeds the provider.
- **Client Components**: `useI18n()` from `@/components/I18nProvider`; use `t('dot.path.key')`. `setLocale` writes the cookie and calls `router.refresh()`.

## Release discipline (from AGENTS.md)
- Follow **SemVer**; bump the version in `package.json` before each commit. The UI footer (`src/components/ui/Footer.tsx`) reads the version from `package.json` — that's the single source of truth (note: `app.config.ts` also has a `version` field that is *not* what the footer shows).
- Update `CHANGELOG.md` for every release (Added / Changed / Fixed / Removed).
- **DB migrations must be upgrade-safe**: avoid data loss; provide a migration or upgrade script so existing self-hosted instances can update without losing data.
