/**
 * Converts the trained tokenizer artifacts into a JSON file the web app can import.
 *
 * Source of truth is ../vocab.bpe (one "p0 p1" merge per line, in training order).
 * The vocab strings are *derived* from the merges exactly as BPETokenizer.load()
 * does in Python, so there is nothing to keep in sync. ../readable.vocab is used
 * only as a check that the derivation agrees with what Python wrote.
 *
 *   node scripts/build-vocab.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..", "..");
const mergesPath = resolve(projectRoot, "vocab.bpe");
const readablePath = resolve(projectRoot, "readable.vocab");
const outPath = resolve(here, "..", "lib", "merges.json");

const merges = readFileSync(mergesPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .map((line, i) => {
    const parts = line.trim().split(/\s+/).map(Number);
    if (parts.length !== 2 || parts.some(Number.isNaN)) {
      throw new Error(`vocab.bpe line ${i + 1}: expected "p0 p1", got ${JSON.stringify(line)}`);
    }
    return parts;
  });

// Rebuild the byte-string for every token id, mirroring Python's load().
const vocab = [];
for (let i = 0; i < 256; i++) vocab.push(Uint8Array.of(i));
merges.forEach(([p0, p1]) => {
  const a = vocab[p0];
  const b = vocab[p1];
  if (!a || !b) throw new Error(`merge (${p0}, ${p1}) references an id that does not exist yet`);
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  vocab.push(joined);
});

// Cross-check against readable.vocab, which Python produced with `f"{idx}: {text!r}"`.
if (existsSync(readablePath)) {
  // ignoreBOM keeps a leading U+FEFF instead of stripping it, matching Python.
  const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
  const lines = readFileSync(readablePath, "utf8").split(/\r?\n/).filter((l) => l !== "");
  if (lines.length !== vocab.length) {
    throw new Error(`readable.vocab has ${lines.length} entries, derived vocab has ${vocab.length}`);
  }
  let checked = 0;
  for (const line of lines) {
    const m = /^(\d+): (.*)$/.exec(line);
    if (!m) continue;
    const idx = Number(m[1]);
    // Only compare entries whose repr is unambiguous (plain single-quoted, no escapes).
    const repr = /^'([^'\\]*)'$/.exec(m[2]);
    if (!repr) continue;
    const derived = decoder.decode(vocab[idx]);
    if (derived !== repr[1]) {
      throw new Error(`token ${idx}: derived ${JSON.stringify(derived)} != readable.vocab ${JSON.stringify(repr[1])}`);
    }
    checked++;
  }
  console.log(`cross-checked ${checked}/${vocab.length} tokens against readable.vocab`);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify({ numMerges: merges.length, vocabSize: vocab.length, merges }) + "\n"
);
console.log(`wrote ${outPath}: ${merges.length} merges, vocab size ${vocab.length}`);
