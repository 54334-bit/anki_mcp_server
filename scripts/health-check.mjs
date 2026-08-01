#!/usr/bin/env node
/**
 * Anki MCP Server — Environment Health Check
 *
 * Verifies that every prerequisite for running the server is in place:
 *   1. Node.js version meets the minimum requirement
 *   2. Compiled dist/ entry point exists
 *   3. node_modules/ dependencies are installed
 *   4. AnkiConnect is reachable on localhost:8765
 *   5. The MCP server responds to a JSON-RPC `initialize` handshake
 *
 * Usage:  node scripts/health-check.mjs
 *
 * Exit code 0 = all checks passed; 1 = one or more checks failed.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;

function ok(label, detail = "") {
  console.log(`${GREEN}✓${RESET} ${label}${detail ? `  ${CYAN}${detail}${RESET}` : ""}`);
  passed++;
}

function fail(label, hint = "") {
  console.log(`${RED}✗${RESET} ${label}`);
  if (hint) console.log(`  ${YELLOW}→ ${hint}${RESET}`);
  failed++;
}

function info(label) {
  console.log(`${CYAN}ℹ${RESET} ${label}`);
}

// ── Check 1: Node.js version ───────────────────────────────────────────────
function checkNodeVersion() {
  const version = process.versions.node;
  const [major, minor] = version.split(".").map(Number);
  const meets =
    (major === 20 && minor >= 19) ||
    (major === 22 && minor >= 12) ||
    major > 22;

  if (meets) {
    ok("Node.js version", `v${version}`);
  } else {
    fail(
      `Node.js version v${version}`,
      "Requires Node.js >=20.19.0 (20.x), >=22.12.0 (22.x+). Node 21.x is NOT supported.",
    );
  }
}

// ── Check 2: dist entry point exists ───────────────────────────────────────
function checkDist() {
  const entry = join(projectRoot, "dist", "main-stdio.js");
  if (existsSync(entry)) {
    ok("Build output", "dist/main-stdio.js exists");
  } else {
    fail(
      "Build output missing",
      'Run `npm run build` to compile TypeScript into dist/.',
    );
  }
}

// ── Check 3: node_modules installed ────────────────────────────────────────
function checkNodeModules() {
  const pkgPath = join(projectRoot, "package.json");
  const nmPath = join(projectRoot, "node_modules");
  if (!existsSync(nmPath)) {
    fail("Dependencies missing", "Run `npm install` to install dependencies.");
    return;
  }
  // Spot-check a few critical packages
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const critical = [
    "@nestjs/core",
    "@rekog/mcp-nest",
    "@modelcontextprotocol/sdk",
    "reflect-metadata",
  ];
  const missing = critical.filter((d) => !existsSync(join(nmPath, d)));
  if (missing.length === 0) {
    ok("Dependencies", "node_modules/ populated");
  } else {
    fail(
      "Dependencies incomplete",
      `Missing: ${missing.join(", ")}. Run \`npm install\`.`,
    );
  }
}

// ── Check 4: AnkiConnect reachable ─────────────────────────────────────────
async function checkAnkiConnect() {
  const url =
    process.env.ANKI_CONNECT_URL || "http://localhost:8765";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "version", version: 6 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const body = await res.json();
      ok("AnkiConnect", `reachable at ${url} (API v${body.result})`);
    } else {
      fail(
        "AnkiConnect",
        `HTTP ${res.status} — ensure Anki desktop is running with AnkiConnect add-on (code 2055492159).`,
      );
    }
  } catch (err) {
    const reason =
      err.name === "AbortError" ? "timed out (3s)" : err.message;
    fail(
      "AnkiConnect unreachable",
      `${reason}. Start the Anki desktop app and install the AnkiConnect add-on (code 2055492159).`,
    );
  }
}

// ── Check 5: MCP server responds to initialize ─────────────────────────────
function checkMcpHandshake() {
  return new Promise((resolve) => {
    const entry = join(projectRoot, "dist", "main-stdio.js");
    if (!existsSync(entry)) {
      resolve(); // already reported in checkDist
      return;
    }

    const proc = spawn(process.execPath, [entry], {
      cwd: projectRoot,
      env: {
        ...process.env,
        LOG_LEVEL: "error",
        ANKI_CONNECT_URL: process.env.ANKI_CONNECT_URL || "http://localhost:8765",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => (stdout += c.toString()));
    proc.stderr.on("data", (c) => (stderr += c.toString()));

    const init = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "health-check", version: "1.0.0" },
      },
    }) + "\n";

    // Give NestJS 3s to bootstrap, then send initialize
    const t1 = setTimeout(() => {
      try { proc.stdin.write(init); } catch { /* stdin closed */ }
    }, 3000);

    // After 5s total, evaluate and kill
    const t2 = setTimeout(() => {
      clearTimeout(t1);
      try {
        proc.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
        );
        proc.stdin.write(
          JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n",
        );
      } catch { /* stdin closed */ }
    }, 5000);

    const t3 = setTimeout(() => {
      clearTimeout(t1);
      clearTimeout(t2);
      proc.kill("SIGTERM");

      if (stdout.includes('"protocolVersion"')) {
        const toolCount = (stdout.match(/"name"/g) || []).length;
        ok("MCP handshake", `server responded, ${toolCount} tools registered`);
      } else if (stdout) {
        fail("MCP handshake", `Unexpected output: ${stdout.slice(0, 200)}`);
      } else {
        fail(
          "MCP handshake",
          `No response on stdout. Server stderr: ${stderr.slice(0, 300) || "(empty)"}`,
        );
      }
      resolve();
    }, 6500);

    proc.on("exit", () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (stdout.includes('"protocolVersion"')) {
        ok("MCP handshake", "server responded correctly");
      }
      resolve();
    });
  });
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${CYAN}═══ Anki MCP Server — Health Check ═══${RESET}\n`);
  checkNodeVersion();
  checkDist();
  checkNodeModules();
  await checkAnkiConnect();
  await checkMcpHandshake();

  console.log(`\n${CYAN}═══ Summary ═══${RESET}`);
  console.log(`${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET}\n`);

  if (failed > 0) {
    console.log(`${YELLOW}Fix the issues above, then re-run: node scripts/health-check.mjs${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}All checks passed — the server is ready to use.${RESET}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`${RED}Health check crashed: ${err.message}${RESET}`);
  process.exit(1);
});
