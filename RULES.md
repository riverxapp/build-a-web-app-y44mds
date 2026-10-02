# RULES.md

Change boundaries and placement rules for the RiverX base Vite template.

## Core Product Shape

- Frontend-only Vite + React base app.
- Single main marketing route (`/`) and 404 fallback.
- shadcn-style primitives over Tailwind tokens/CSS variables.
- No auth or backend SDK wired by default.

## Routing Rules

1. Define routes in `src/app/routes.tsx`.
2. Keep route-level views in `src/pages`.
3. Keep shell composition in `src/components/layout`.
4. The RiverX editor preview serves the app under `/preview/<session>/__frame/`, so the router must take that prefix as its `basename`, or every route shows the 404 page in the preview:
   ```ts
   const previewBasename = window.location.pathname.match(/^\/preview\/[^/]+\/__frame/)?.[0];
   export const router = createBrowserRouter(routes, { basename: previewBasename });
   ```
   Navigate with `<Link>` / `useNavigate`, never `window.location`, so the prefix is kept.

## Component Rules

1. Reusable primitives belong in `src/components/ui`.
2. Prefer shadcn-style component APIs (`CardHeader`, `CardContent`, etc.) for consistency.
3. Use named exports for reusable components.
4. Keep components small and readable.

## Data and Env Rules

1. Read env variables only from `src/lib/env.ts`.
2. Route all HTTP calls through `src/lib/api.ts`.
3. Keep backend-specific logic isolated in `src/lib`.
4. Add auth headers only where marked in `api.ts` when auth is introduced.

## Styling Rules

1. Use Tailwind utilities and token-based classes (`foreground`, `muted-foreground`, `border`, `card`, etc.).
2. Keep `src/styles/globals.css` focused on Tailwind directives + base variable tokens.
3. Avoid additional CSS frameworks.

## AI Editing Rules

1. Preserve deterministic folder structure.
2. Avoid monolithic files and broad unrelated edits.
3. Add comments only when they provide concrete implementation clarity.
4. Keep docs synchronized with code changes.

## Script Rules

1. Keep `scripts/dev-supervisor.js`, `scripts/git-poll.js`, `scripts/error-reporter.ts`, and `scripts/db-init.js` unless explicitly requested otherwise.
2. Any script behavior change must preserve current Vite runtime assumptions.

## Non-Negotiables

- Do not add backend services in this template.
- Do not add authentication in the base template.
- Do not migrate away from Vite + React in base setup.
