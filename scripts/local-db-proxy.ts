import { randomBytes } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import { loadEnv, type Plugin } from "vite";
import { handleDbRequest, send } from "../server/db";

/**
 * The dev server's Data API: the RiverX preview, and `pnpm dev` anywhere else.
 *
 * Active only in `vite dev`, only when TURSO_DATABASE_URL is set and
 * VITE_RIVERX_DB_URL is not (RiverX sets TURSO_* and leaves VITE_RIVERX_DB_*
 * out for apps that load this plugin). The Turso token stays in this Node
 * process; the browser gets a random per-process key and talks to
 * /__local-db/v1 with the same request/response contract as the real Data API
 * (see DATABASE.md). This app has no login, so anyone who can open the dev
 * server can use it; in RiverX that is whoever has the preview link.
 */

const BASE_PATH = "/__local-db/v1";

/** TURSO_* from the process env first, then .env / .env.local (never VITE_-prefixed). */
export function loadTursoEnv(mode: string) {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  return {
    url: process.env.TURSO_DATABASE_URL || fileEnv.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN || fileEnv.TURSO_AUTH_TOKEN,
    riverxDbUrl: fileEnv.VITE_RIVERX_DB_URL,
  };
}

export function localDbProxy(): Plugin {
  let client: Client | null = null;
  // Survive config restarts: reuse the key this plugin already injected.
  const key =
    process.env.VITE_RIVERX_DB_URL === BASE_PATH && process.env.VITE_RIVERX_DB_KEY
      ? process.env.VITE_RIVERX_DB_KEY
      : `local_${randomBytes(16).toString("hex")}`;

  return {
    name: "local-db-proxy",
    apply: "serve",
    config(_, { mode }) {
      const { url, authToken, riverxDbUrl: fileDbUrl } = loadTursoEnv(mode);
      // loadEnv also sees process.env, so after a dev-server restart it returns our own injected BASE_PATH.
      const riverxDbUrl = fileDbUrl === BASE_PATH ? "" : fileDbUrl;
      const injectedByUs = process.env.VITE_RIVERX_DB_URL === BASE_PATH;
      if (!url || riverxDbUrl || (process.env.VITE_RIVERX_DB_URL && !injectedByUs)) return;

      client = createClient({ url, authToken });
      // Vite reads VITE_* from process.env after config hooks run.
      process.env.VITE_RIVERX_DB_URL = BASE_PATH;
      process.env.VITE_RIVERX_DB_KEY = key;
    },
    configureServer(server) {
      if (!client) return;
      const db = client;
      server.config.logger.info(`  ➜  Local DB proxy: ${BASE_PATH} → Turso`);

      server.middlewares.use(BASE_PATH, async (req, res) => {
        if (req.headers["x-riverx-key"] !== key) return send(res, 401, { error: "Invalid key", code: "unauthorized" });
        const action = (req.url ?? "").split("?")[0].replace(/^\/+|\/+$/g, "");
        await handleDbRequest(db, action, req, res, "local-proxy");
      });
    },
  };
}
