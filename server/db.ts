import type { IncomingMessage, ServerResponse } from "node:http";
import type { Client, InStatement, ResultSet } from "@libsql/client";

/**
 * The Data API contract (see DATABASE.md) served from our own server with the
 * private TURSO_* credentials. Used by the Vite dev proxy (scripts/local-db-proxy.ts).
 *
 *   GET  {base}/health
 *   POST {base}/query  { sql, params?, method? }
 *   POST {base}/batch  { queries: [...] }
 */

const MAX_ROWS = 1000;
const MAX_BODY_BYTES = 1024 * 1024;

type Method = "run" | "all" | "get" | "values";
type Query = { sql: string; params?: unknown[]; method?: Method };

const BLOCKED = [
  /^\s*(create|alter|drop|truncate|rename|reindex|attach|detach|vacuum)\b/i,
  /\bload_extension\s*\(/i,
  /^\s*pragma\b[^;]*=/i,
  /\b(insert\s+into|update|delete\s+from)\s+["'`]?(sqlite_|libsql_|__drizzle)/i,
];

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

function assertAllowed(sql: unknown) {
  if (typeof sql !== "string" || !sql.trim()) throw httpError(400, "Missing sql");
  const withoutTrailing = sql.trim().replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) throw httpError(403, "Multiple statements are not allowed");
  if (BLOCKED.some((re) => re.test(withoutTrailing))) {
    throw httpError(403, "Statement blocked: schema changes go through drizzle-kit");
  }
}

function toResponse(rs: ResultSet) {
  const rows = rs.rows.slice(0, MAX_ROWS).map((row) => rs.columns.map((_, i) => row[i]));
  return {
    rows,
    rowsAffected: rs.rowsAffected,
    lastInsertRowid: rs.lastInsertRowid === undefined ? undefined : Number(rs.lastInsertRowid),
    truncated: rs.rows.length > MAX_ROWS,
  };
}

function toStatement(q: Query): InStatement {
  assertAllowed(q?.sql);
  return { sql: q.sql, args: (q.params ?? []) as never };
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Request too large");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw httpError(400, "Invalid JSON");
  }
}

export function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** Serves one Data API action ("health" | "query" | "batch"). */
export async function handleDbRequest(db: Client, action: string, req: IncomingMessage, res: ServerResponse, mode: string) {
  try {
    if (action === "health" && req.method === "GET") {
      await db.execute("select 1");
      return send(res, 200, { ok: true, mode });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed", code: "method" });

    const body = await readJson(req);
    if (action === "query") {
      return send(res, 200, toResponse(await db.execute(toStatement(body as Query))));
    }
    if (action === "batch") {
      const queries = (Array.isArray(body.queries) ? body.queries : []) as Query[];
      const results = await db.batch(queries.map(toStatement), "write");
      return send(res, 200, { results: results.map(toResponse) });
    }
    send(res, 404, { error: "Not found", code: "not_found" });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    send(res, status, { error: error instanceof Error ? error.message : String(error), code: "query_failed" });
  }
}
