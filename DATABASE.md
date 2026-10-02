# DATABASE.md

How to add and use a database in a RiverX Vite app.

RiverX gives each project an optional **Turso (libSQL / SQLite)** database. The app never talks to Turso directly. It sends queries to a Data API that holds the real Turso credentials server-side: `/__local-db/v1`, served by the dev server (`scripts/local-db-proxy.ts`) in `pnpm dev`, including the RiverX preview, and the **RiverX Data API** in the published app. Both use the same request/response contract. You write queries with **Drizzle ORM** (`drizzle-orm/sqlite-proxy`).

```
preview:    browser app ──POST /__local-db/v1/query──▶ scripts/local-db-proxy.ts ──▶ Turso
                           x-riverx-key: {VITE_RIVERX_DB_KEY}  (random per-process key)
published:  browser app ──POST {VITE_RIVERX_DB_URL}/query──▶ RiverX Data API ──▶ Turso
                           x-riverx-key: {VITE_RIVERX_DB_KEY}  (publishable key)
```

> [!WARNING]
> **Anyone who visits your published app can read and write this database.** The publishable key ships in the published JS bundle, and there is no row-level security or end-user auth. The Data API blocks destructive statements, but it does not stop `SELECT * FROM <table>`. In the RiverX preview, anyone with the preview link can do the same through the dev proxy: this app has no login. The preview and the published app share the database.
> **Never store passwords, secrets, tokens, or personal data (PII) in it.**

---

## 1. Turn it on

The database is created on demand, not by default.

1. Open the project preview in RiverX and go to the **Data** tab.
2. Click **Create database**.
3. RiverX provisions the database, injects `TURSO_*` (below) into the preview and restarts it, so the dev proxy picks them up. When you publish, it sets the env vars on the Vercel project (section 8).

Until that happens, the env vars are empty. The client in step 4 handles this, so the app still boots.

## 2. Environment variables

Under RiverX, these are **injected by the platform**: `TURSO_*` into the dev server and workspace terminal, and all four into the Vercel env when you publish. In `pnpm dev` the dev proxy sets `VITE_RIVERX_DB_*` itself. RiverX doesn't write `.env.local` for this app. Never commit `.env*` files.

| Variable | Where it exists | Used by |
|---|---|---|
| `VITE_RIVERX_DB_URL` | Vite env (set by the dev proxy); Vercel env (set by RiverX on publish) | App (browser). `/__local-db/v1` in dev; in the published build, the RiverX Data API base URL, e.g. `https://agent.riverx.app/db/v1` |
| `VITE_RIVERX_DB_KEY` | As above | App (browser). Random per-process key `local_…` in dev; publishable key `rxdb_pk_…` in the published build, safe to ship |
| `TURSO_DATABASE_URL` | Process env of the dev server and workspace terminal; Vercel env (sensitive), set on publish | `drizzle-kit` (schema changes), the dev proxy; server functions, if you add any |
| `TURSO_AUTH_TOKEN` | Process env of the dev server and workspace terminal; Vercel env (sensitive), set on publish | `drizzle-kit` (schema changes), the dev proxy; server functions, if you add any |

`TURSO_*` values are full-access credentials for this project's database only. They are never written to disk. Never read them from `src/`, never copy them into a file, and never prefix them with `VITE_`.

Make sure `.gitignore` contains:

```gitignore
.env
.env.*
!.env.example
```

Add the public vars to `.env.example` (empty values; setting them in a `.env*` file turns the dev proxy off):

```bash
VITE_RIVERX_DB_URL=
VITE_RIVERX_DB_KEY=
```

## 3. Install

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

`@libsql/client` is already a dev dependency of the template. It is used only by `drizzle-kit`, the dev proxy (`scripts/local-db-proxy.ts`) and `server/db.ts`. **Never import it from `src/`**: it would bypass the Data API and needs the private token.

## 4. Files

### `src/lib/env.ts`: expose the vars

Per `RULES.md`, env vars are read only here.

```ts
export const env = {
  // ...existing fields
  dbUrl: import.meta.env.VITE_RIVERX_DB_URL || "",
  dbKey: import.meta.env.VITE_RIVERX_DB_KEY || "",
};
```

### `src/db/schema.ts`: tables

All tables live in this one file.

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
```

### `src/db/client.ts`: the `db` instance

Copy this as-is. The response shapes are strict: see [Why the shapes matter](#why-the-shapes-matter).

```ts
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { apiRequest } from "@/lib/api";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Method = "run" | "all" | "get" | "values";

type QueryResult = {
  rows: unknown[];
  rowsAffected?: number;
  lastInsertRowid?: number;
  truncated?: boolean;
};

export const isDatabaseConfigured = Boolean(env.dbUrl && env.dbKey);

// Absolute, so apiRequest never prefixes it with the API base URL. Handles the
// relative URL of the dev proxy as well as the RiverX Data API URL.
const dbBaseUrl = env.dbUrl ? new URL(env.dbUrl, window.location.origin).href.replace(/\/$/, "") : "";

function post<T>(path: string, body: unknown) {
  if (!isDatabaseConfigured) {
    throw new Error("Database is not configured. Create one from the RiverX Data tab.");
  }
  return apiRequest<T>(`${dbBaseUrl}/${path}`, {
    method: "POST",
    headers: { "x-riverx-key": env.dbKey },
    body,
  });
}

// drizzle maps rows by position: 'all'/'values' need unknown[][], 'get' needs one flat unknown[].
function shape(result: QueryResult, method: Method) {
  if (method === "run") return { rows: [] };
  if (method === "get") {
    const first = result.rows[0];
    return { rows: (Array.isArray(first) ? first : result.rows) as unknown[] };
  }
  return { rows: result.rows };
}

export const db = drizzle(
  async (sql, params, method) => {
    const result = await post<QueryResult>("query", { sql, params, method });
    return shape(result, method);
  },
  async (queries) => {
    const { results } = await post<{ results: QueryResult[] }>("batch", { queries });
    return results.map((result, i) => shape(result, queries[i].method));
  },
  { schema },
);
```

### `drizzle.config.ts`: schema tooling

This uses the **direct Turso connection**, not the proxy, because `drizzle-kit` can't push through `sqlite-proxy`.

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

## 5. Changing the schema

1. Edit `src/db/schema.ts`.
2. In the **workspace terminal**, where `TURSO_*` are available, run:

   ```bash
   pnpm exec drizzle-kit push
   ```

3. Check the result in the **Data** tab.

Rules:

- **Schema changes happen only through `drizzle-kit`.** `CREATE`/`ALTER`/`DROP` from app code is always rejected by the Data API, and the Data tab blocks DDL too.
- **Preview and the published app share the same database.** A push changes production data too.
- `drizzle-kit push` **will drop columns and tables** if you remove them from the schema. Before any destructive change (dropping or renaming a column or table, changing a type), stop and confirm with the user.
- Do not seed or bulk-insert data unless the user asks for it.

## 6. Querying

Import `db` and the tables, and write normal Drizzle queries:

```ts
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { todos } from "@/db/schema";

// read
const all = await db.select().from(todos).orderBy(desc(todos.createdAt));
const one = await db.select().from(todos).where(eq(todos.id, 1)).get();

// write
const [created] = await db.insert(todos).values({ title: "Ship it" }).returning();
await db.update(todos).set({ done: true }).where(eq(todos.id, created.id));
await db.delete(todos).where(eq(todos.id, created.id));
```

### Atomic multi-step writes: use `db.batch`, never `db.transaction`

`db.transaction()` is **not supported** by `sqlite-proxy` and throws at runtime. Use `db.batch()`, which Turso runs in one implicit transaction: all statements succeed or none do.

```ts
await db.batch([
  db.insert(todos).values({ title: "A" }),
  db.update(todos).set({ done: true }).where(eq(todos.id, 7)),
]);
```

### In React components

Query in effects or data hooks, not during render. Gate database features on `isDatabaseConfigured`:

```tsx
import { useEffect, useState } from "react";
import { db, isDatabaseConfigured } from "@/db/client";
import { todos, type Todo } from "@/db/schema";

export function TodoList() {
  const [items, setItems] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDatabaseConfigured) return;
    db.select().from(todos).then(setItems).catch((e) => setError(String(e)));
  }, []);

  if (!isDatabaseConfigured) return <p>Database not set up yet.</p>;
  if (error) return <p>Could not load todos.</p>;
  return <ul>{items.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

## 7. Limits and blocked statements

Enforced by the RiverX Data API (the published app) on every request:

| Limit | Default |
|---|---|
| Rows returned per query | 1,000 (extra rows are cut and the response has `truncated: true`, so paginate with `.limit()` / `.offset()`) |
| SQL length | 20,000 characters |
| Rate limit | 600 queries / minute per project |
| Query timeout | 15 seconds |
| Statements per `query` call | 1 (use `db.batch` for more) |

Always rejected: DDL (`CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`, `REINDEX`), `ATTACH`/`DETACH`, `VACUUM INTO`, `LOAD_EXTENSION`, `PRAGMA` writes, multiple statements in one call, and writes to `sqlite_*`, `libsql_*` and `__drizzle*` tables.

The dev proxy (`server/db.ts`, used in `pnpm dev` and the RiverX preview) applies the same row cap, one-statement rule and blocked list (it rejects `VACUUM` in any form). It has a 1 MB request body limit but no SQL-length limit, rate limit or query timeout of its own.

Errors come back as `{ error, code }` and surface as thrown errors from `apiRequest`.

| Status | Meaning |
|---|---|
| 401 | Missing or invalid `x-riverx-key` |
| 403 | Statement blocked by the guard, or origin not allowed |
| 413 | Request body over 1 MB (dev proxy) |
| 429 | Rate limited, so back off and retry (RiverX Data API) |

`GET {VITE_RIVERX_DB_URL}/health` (with `x-riverx-key`) returns liveness and the access mode (`local-proxy` from the dev proxy). Use it for a connection check.

## 8. Publishing

- RiverX adds `VITE_RIVERX_DB_URL` / `VITE_RIVERX_DB_KEY` to the Vercel env **before** the build. Vite inlines `import.meta.env.VITE_*` at build time. This app has no server, so the published build uses the RiverX Data API with the publishable key. The dev proxy exists in `vite dev` only; `vite build` output never contains it or the token.
- RiverX also sets `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` as **sensitive** Vercel variables (production and preview, readable only by server code). This app doesn't use them, but server functions you add under `api/` can read them from `process.env` and query Turso directly with `@libsql/client`. Once every query goes through such a server route behind a login, stop sending the publishable key from production builds (see `src/lib/env.ts` in the CRM, booking or ticketing template).
- The published domain and any custom domain are added to the database's allowed origins automatically.
- **Rotating the publishable key requires a redeploy.** The old key is baked into the existing bundle.
- The Data tab's **Key** button generates a new `TURSO_AUTH_TOKEN` and revokes the old one at once. RiverX updates the Vercel env, redeploys production and restarts the preview. It does not change the publishable key.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Database is not configured` | No database yet: create one from the **Data** tab. RiverX then restarts the preview so the dev proxy picks up `TURSO_*`; if the message stays, restart the preview. |
| Every field is `undefined` in results | Rows were returned as objects instead of positional arrays. Use the `client.ts` above unchanged. |
| `get()` returns nested garbage | `'get'` must return one flat array, not `[[...]]`. Use `shape()` above. |
| `db.transaction is not a function` / throws | Not supported. Use `db.batch([...])`. |
| 403 on `CREATE TABLE` | DDL is blocked at runtime. Change `schema.ts` and run `drizzle-kit push`. |
| `drizzle-kit push` can't connect | Run it in the RiverX workspace terminal, where `TURSO_*` are injected. They are not in `.env.local` by design. |
| Works in preview, CORS error on custom domain | The domain isn't in allowed origins yet. Re-attach the domain or republish. |
| Results stop at 1,000 rows | Row cap. Paginate. |

## Checklist for agents

- `db` comes from `src/db/client.ts`. Tables live in `src/db/schema.ts`.
- Apply schema changes with `pnpm exec drizzle-kit push`. There is no DDL at runtime.
- Use `db.batch([...])`, **never** `db.transaction()`.
- No secrets, passwords, or PII in the database: the published app makes it publicly readable and writable, and in the preview anyone with the link can use it.
- Don't set `VITE_RIVERX_DB_*` in `.env*` files (it turns the dev proxy off). Don't read `TURSO_*` from `src/`. Don't import `@libsql/client` in `src/`.
- Ask before destructive schema changes or seeding data.
- `scripts/db-init.js` is the separate Postgres (`DATABASE_URL`) migration helper. It is **not** used for the Turso database.
