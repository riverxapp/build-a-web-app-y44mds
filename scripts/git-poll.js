import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BRANCH = process.env.PREVIEW_BRANCH || "main";
const INTERVAL = Number(process.env.GIT_POLL_INTERVAL || 2000);
const REPO_URL = process.env.REPO_URL;
let lastSha = null;
let pulling = false;
let authFailed = false;
let timer;

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

async function poll() {
  // Railway and other PaaS often ship source as a tarball without .git; bail if repo absent.
  if (!existsSync(join(process.cwd(), ".git"))) {
    console.log("[git-poll] skipped: no .git directory present");
    clearInterval(timer);
    return;
  }

  // If remote url stripped, restore from REPO_URL when provided.
  if (REPO_URL) {
    try {
      await run(`git remote set-url origin ${REPO_URL}`);
    } catch {
      // ignore; fetch will surface errors
    }
  }

  if (authFailed) return;
  if (pulling) return;

  try {
    pulling = true;

    await run("git fetch origin");
    const sha = await run(`git rev-parse origin/${BRANCH}`);

    if (sha !== lastSha) {
      console.log(`[git-poll] update detected → ${sha}`);
      await run(`git pull origin ${BRANCH}`);

      lastSha = sha;
    }
  } catch (err) {
    const msg = String(err || "");
    console.error("[git-poll] error:", msg);
    if (
      msg.includes("could not read Username") ||
      msg.includes("Authentication failed") ||
      msg.includes("Permission denied")
    ) {
      console.error(
        "[git-poll] auth failed; disabling polling. Provide repo access in REPO_URL or credentials."
      );
      authFailed = true;
    }
  } finally {
    pulling = false;
  }
}

console.log("[git-poll] started");
timer = setInterval(poll, INTERVAL);
