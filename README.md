# RiverX Base Vite Template

Production-ready base template for RiverX-generated apps using Vite + React + TypeScript + Tailwind + shadcn/ui (default style).

## Commands

Install dependencies:

```bash
pnpm install
```

Start development server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm run build
```

Preview production build:

```bash
pnpm preview
```

Type check:

```bash
pnpm typecheck
```

Validate dev runtime defaults:

```bash
pnpm verify:dev-runtime
```

Dev runtime defaults:

- Host: `0.0.0.0`
- Port: `5173`
- Strict port mode: enabled (fails fast if port is occupied)
- Override examples: `PORT=3001 pnpm dev` or `pnpm dev -- --port 3001`

## Environment Variables

Copy `.env.example` to `.env` (or `.env.local`) and adjust as needed.

- `VITE_APP_NAME`: App display name in header and UI. Default: `RiverX App`
- `VITE_API_BASE_URL`: Base URL for API wrapper in `src/lib/api.ts`. Default: empty (same origin). Do not use `/api`; the RiverX workspace preview reserves it.

## Project Structure

```text
src/
  app/
    App.tsx
    routes.tsx
  pages/
    home.tsx
    NotFoundPage.tsx
  components/
    layout/
      AppLayout.tsx
      Header.tsx
      Footer.tsx
      Navbar.tsx
    ui/
      Button.tsx
      Card.tsx
      Input.tsx
  lib/
    api.ts
    env.ts
    utils.ts
  styles/
    globals.css
  main.tsx
scripts/
  dev-supervisor.js
  git-poll.js
  error-reporter.ts
  db-init.js
components.json
DESIGN.md
```

## Homepage Structure

`src/pages/home.tsx` currently includes a full landing flow:

1. Full-width hero band (CTA-focused)
2. Trust/logo strip
3. Outcome cards
4. Product story demo section with image
5. Demo content blocks with images
6. Feature narrative rows
7. Use-case cards with images
8. Testimonials + lead capture panel
9. Final conversion CTA section

## RiverX Agent Notes

- Keep routing updates in `src/app/routes.tsx`.
- Keep page-level composition in `src/pages`.
- Use shadcn-style primitives in `src/components/ui`.
- Keep backend integration logic in `src/lib/api.ts` and env access in `src/lib/env.ts`.
- Generate/update `project.md` in RiverX first run and after major architecture changes.
- Keep files small and deterministic for safe AI editing.

## Backend Integration Direction

This template has no backend dependency by default. You can connect:

- PocketBase
- Supabase
- PostgreSQL-backed REST APIs
- Custom HTTP APIs

by extending `src/lib/api.ts` without changing overall page/component structure.
