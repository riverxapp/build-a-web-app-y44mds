# FILES.md

Structural index for the current RiverX base Vite template.

## High-Level Overview

- Purpose: conversion-focused Vite + React base template for AI-editable SaaS landing pages.
- Runtime shape: frontend-first app with backend-agnostic API layer and optional runtime scripts.
- Primary goal: deterministic structure + fast preview + easy safe edits by agents.

## Key Technologies

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui (default style conventions)
- React Router
- pnpm

## Entry Points

- `index.html`: Vite HTML entry
- `src/main.tsx`: React mount + router + global styles
- `src/app/App.tsx`: app shell root
- `src/app/routes.tsx`: route definitions

## Source Areas

| Area | Path | Responsibility |
|---|---|---|
| App shell | `src/app/` | Global app composition and routes |
| Pages | `src/pages/` | Route-level pages (`/`, `*`) |
| Layout components | `src/components/layout/` | Header, footer, navbar, shell |
| UI primitives | `src/components/ui/` | `Button`, `Card`, `Input` (shadcn-style) |
| Core libs | `src/lib/` | Env config, API wrapper, utility helpers |
| Global styles | `src/styles/globals.css` | Tailwind directives + CSS variable tokens |

## Root Config Files

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `tailwind.config.js`
- `postcss.config.js`
- `components.json`
- `.env.example`
- `README.md`
- `RULES.md`
- `DATABASE.md`
- `DESIGN.md`

## Scripts

Current runtime/infrastructure scripts:

- `scripts/dev-supervisor.js`: Vite server supervisor + warmup + optional git bootstrap/poll.
- `scripts/git-poll.js`: polling-based repo sync for live preview environments.
- `scripts/error-reporter.ts`: browser error forwarding helper (Bubble endpoint).
- `scripts/db-init.js`: database migration helper used in DB workflow contexts.
- `scripts/local-db-proxy.ts`: dev-only Data API for the Turso database (`/__local-db/v1`), loaded in `vite.config.ts`; used in `pnpm dev` and the RiverX preview. See `DATABASE.md`.
- `server/db.ts`: Data API handler and SQL guard (no DDL, one statement per query, no writes to system tables, 1,000-row cap) behind the dev proxy.

## Safe Modification Guide

- Add pages in `src/pages` and wire them in `src/app/routes.tsx`.
- Use `src/components/ui` for reusable primitives and `src/components/layout` for shell elements.
- Keep API/backend integration centralized in `src/lib/api.ts`.
- Keep docs aligned after structural changes (`README.md`, `FILES.md`, `RULES.md`, `DESIGN.md`).
