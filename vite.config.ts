import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localDbProxy } from "./scripts/local-db-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PORT = 5173;
const rawPort = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PORT;

function extractRepoName(repoUrl?: string) {
  if (!repoUrl) return "";
  const trimmed = repoUrl.trim().replace(/\.git$/i, "");
  const match = trimmed.match(/([^/:]+)$/);
  return match ? match[1] : "";
}

const repoName = extractRepoName(process.env.REPO_URL);
const allowedHosts = new Set(["localhost", "127.0.0.1", ".up.railway.app"]);
if (repoName) {
  allowedHosts.add(`${repoName}-production.up.railway.app`);
}

export default defineConfig(({ command }) => {
  // The workspace may start Vite with NODE_ENV=production inherited from the
  // backend; a dev server needs development React builds.
  if (command === "serve") process.env.NODE_ENV = "development";

  return {
    base: "/",
    plugins: [react(), localDbProxy()],
    server: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      allowedHosts: Array.from(allowedHosts),
    },
    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
