import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const pkg = readJson(path.join(root, "package.json"));
const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
const supervisor = fs.readFileSync(path.join(root, "scripts", "dev-supervisor.js"), "utf8");

assert(
  pkg.scripts?.dev?.includes("vite --host 0.0.0.0 --strictPort"),
  "package.json script 'dev' must explicitly set host and strictPort"
);

assert(
  pkg.scripts?.preview?.includes("vite preview --host 0.0.0.0 --strictPort"),
  "package.json script 'preview' must explicitly set host and strictPort"
);

assert(
  viteConfig.includes("const DEFAULT_PORT = 5173"),
  "vite.config.ts must define DEFAULT_PORT as 5173"
);

assert(
  viteConfig.includes('host: "0.0.0.0"'),
  "vite.config.ts must set host to 0.0.0.0"
);

assert(
  viteConfig.includes("strictPort: true"),
  "vite.config.ts must enable strictPort"
);

assert(
  viteConfig.includes("process.env.PORT"),
  "vite.config.ts must continue supporting PORT env override"
);

assert(
  supervisor.includes('return "5173"'),
  "scripts/dev-supervisor.js must default to port 5173"
);

assert(
  supervisor.includes('"--host", "0.0.0.0"') && supervisor.includes('"--strictPort"'),
  "scripts/dev-supervisor.js must run Vite with explicit host and strictPort"
);

assert(
  supervisor.includes('"--port", PORT'),
  "scripts/dev-supervisor.js must keep explicit --port for env-driven overrides"
);

console.log("verify-dev-runtime: OK");
