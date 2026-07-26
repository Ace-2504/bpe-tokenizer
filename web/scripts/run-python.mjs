/**
 * Runs a Python script with the project's interpreter.
 *
 * Prefers the repo venv (which has the `regex` package the tokenizer needs) and
 * falls back to whatever python is on PATH. Exists so package.json scripts stay
 * free of shell-specific path quoting.
 *
 *   node scripts/run-python.mjs test/parity/dump_python.py
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const projectRoot = resolve(webRoot, "..");

const candidates = [
  resolve(projectRoot, ".venv", "Scripts", "python.exe"),
  resolve(projectRoot, ".venv", "bin", "python"),
];
const python = candidates.find((p) => existsSync(p)) ?? "python";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/run-python.mjs <script.py> [args...]");
  process.exit(2);
}

const result = spawnSync(python, args, { cwd: webRoot, stdio: "inherit" });
if (result.error) {
  console.error(`failed to run ${python}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
