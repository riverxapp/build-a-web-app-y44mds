import { spawn, exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRANCH = process.env.PREVIEW_BRANCH || "main";
const REPO_URL = process.env.REPO_URL;
const appDevRaw = process.env.VITE_DEV ?? process.env.NEXT_DEV;
const gitBootstrapRaw = process.env.GIT_BOOTSTRAP;
const gitPollRaw = process.env.GIT_POLL;
const healthPathRaw = process.env.HEALTHCHECK_PATH;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function resolvePort(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.replace(/^['"]|['"]$/g, "");
  const port = Number.parseInt(normalized, 10);
  if (!Number.isFinite(port) || port <= 0) return "5173";
  return String(port);
}

const PORT = resolvePort(process.env.PORT);

function parseBoolean(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return !["false", "0", "no", "off"].includes(String(value).toLowerCase());
}

// Backward compatible: NEXT_DEV still works, but VITE_DEV is preferred.
const APP_DEV = parseBoolean(appDevRaw, true);
// Runtime images often start without .git; when REPO_URL is provided,
// bootstrap by default so polling has a repo to work with.
const GIT_BOOTSTRAP = parseBoolean(gitBootstrapRaw, Boolean(REPO_URL));
// Default on so repo-sync behavior is active unless explicitly disabled.
const GIT_POLL = parseBoolean(gitPollRaw, true);
const HEALTHCHECK_PATH =
  typeof healthPathRaw === "string" && healthPathRaw.trim()
    ? healthPathRaw.trim()
    : "/";

function run(name, cmd, args, envOverrides = {}, { exitOnFailure = true } = {}) {
  const p = spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...envOverrides },
  });

  p.on("exit", (code) => {
    console.error(`[supervisor] ${name} exited with code ${code}`);
    if (exitOnFailure) {
      process.exit(code ?? 1);
    }
  });

  return p;
}

function getViteCommand() {
  const binName = process.platform === "win32" ? "vite.cmd" : "vite";
  const candidates = [
    path.join(scriptDir, "..", "node_modules", ".bin", binName),
    path.join(process.cwd(), "node_modules", ".bin", binName),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) {
    return { cmd: found, args: [] };
  }

  // Fallback keeps the service bootable even when .bin symlinks are missing.
  console.warn(
    `[supervisor] ${binName} not found at expected paths. Falling back to 'pnpm exec vite'. Tried:\n${candidates.join("\n")}`
  );
  return { cmd: "pnpm", args: ["exec", "vite"] };
}

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        const details = (stderr || err.message || "unknown error").trim();
        reject(new Error(`command failed: ${cmd}\n${details}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function bootstrapGit() {
  if (!GIT_BOOTSTRAP) {
    console.log("[supervisor] git bootstrap disabled (set GIT_BOOTSTRAP=true to enable)");
    return;
  }

  if (fs.existsSync(".git")) return;

  if (!REPO_URL) {
    console.warn("[supervisor] no .git and no REPO_URL; skipping git bootstrap");
    return;
  }

  console.log("[supervisor] bootstrapping git repo");
  // Intentionally no "git clean -fd": it can delete node_modules in runtime
  // containers and cause Vite startup failures on restart.
  const cmds = [
    "git init",
    `git remote add origin ${REPO_URL}`,
    "git fetch origin --depth=1",
    `git reset --hard origin/${BRANCH}`,
  ];

  for (const cmd of cmds) {
    await execAsync(cmd);
  }
  console.log("[supervisor] git bootstrap complete");
}

async function warmup() {
  const normalizedPath = HEALTHCHECK_PATH.startsWith("/")
    ? HEALTHCHECK_PATH
    : `/${HEALTHCHECK_PATH}`;
  const url = `http://localhost:${PORT}${normalizedPath}`;
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[supervisor] warmup complete (${((i + 1) * 500 / 1000).toFixed(1)}s)`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.warn("[supervisor] warmup timed out after 45s");
}

// --- Start Vite immediately ---

const viteCommand = getViteCommand();
if (APP_DEV) {
  console.log("[supervisor] starting Vite dev server");
  run("vite-dev", viteCommand.cmd, [...viteCommand.args, "--host", "0.0.0.0", "--strictPort", "--port", PORT], {
    NODE_ENV: "development",
  });
} else {
  console.log("[supervisor] starting Vite preview server");
  run("vite-preview", viteCommand.cmd, [...viteCommand.args, "preview", "--host", "0.0.0.0", "--strictPort", "--port", PORT], {
    NODE_ENV: "production",
  });
}

// --- Async tasks: warmup, git bootstrap, deferred git-poll ---

warmup().catch((err) => console.error("[supervisor] warmup error:", err));

bootstrapGit().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(
    `[supervisor] git bootstrap skipped; continuing without repo sync. Reason: ${message}`
  );
});

if (GIT_POLL) {
  setTimeout(() => {
    console.log("[supervisor] starting git poller");
    run("git-poll", "node", ["scripts/git-poll.js"], {}, { exitOnFailure: false });
  }, 30_000);
} else {
  console.log("[supervisor] git poller disabled (set GIT_POLL=true to enable)");
}
