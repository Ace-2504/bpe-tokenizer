/**
 * Parity test: the TypeScript port must reproduce Python's output exactly.
 *
 *   npm run parity        (regenerates ground truth, then checks)
 *
 * Compares, for every case in expected.json:
 *   - the pre-token chunk split (re.findall)
 *   - the token ids, at 0 / 1 / 20 / 100 / 255 / 256 merges
 *   - the decode(encode(text)) round trip
 *
 * Any mismatch is a bug in lib/bpe.ts, not in Python.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { byteLength, getTokenizer, splitChunks } from "../../lib/bpe";

interface Expected {
  pattern: string;
  mergeCounts: number[];
  cases: {
    text: string;
    chunks: string[];
    byteLength: number;
    ids: Record<string, number[]>;
    decoded: string;
  }[];
}

const here = dirname(fileURLToPath(import.meta.url));
const expected: Expected = JSON.parse(
  readFileSync(resolve(here, "expected.json"), "utf8")
);

/** Renders a string with control characters visible, for failure messages. */
function show(s: string): string {
  return JSON.stringify(s).replace(/[^ -~]/g, (c) =>
    "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
  );
}

const same = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

let checks = 0;
const failures: string[] = [];
const record = (kind: string, text: string, detail: string) => {
  if (failures.length < 25) failures.push(`  [${kind}] input ${show(text)}\n${detail}`);
};

for (const c of expected.cases) {
  // 1. Pre-token split.
  checks++;
  const chunks = splitChunks(c.text);
  if (!same(chunks, c.chunks)) {
    record(
      "chunks",
      c.text,
      `      python: ${c.chunks.map(show).join(" ")}\n      typescript: ${chunks.map(show).join(" ")}`
    );
  }

  // 2. Byte length.
  checks++;
  if (byteLength(c.text) !== c.byteLength) {
    record("bytes", c.text, `      python ${c.byteLength}, typescript ${byteLength(c.text)}`);
  }

  // 3. Token ids at each merge count.
  for (const n of expected.mergeCounts) {
    checks++;
    const ids = getTokenizer(n).encode(c.text);
    const want = c.ids[String(n)];
    if (!same(ids, want)) {
      const at = ids.findIndex((v, i) => v !== want[i]);
      record(
        `ids n=${n}`,
        c.text,
        `      first difference at index ${at}\n` +
          `      python:     [${want.slice(Math.max(0, at - 2), at + 3).join(", ")}]\n` +
          `      typescript: [${ids.slice(Math.max(0, at - 2), at + 3).join(", ")}]`
      );
    }
  }

  // 4. Round trip.
  checks++;
  const tok = getTokenizer();
  const decoded = tok.decode(tok.encode(c.text));
  if (decoded !== c.decoded) {
    record("decode", c.text, `      python: ${show(c.decoded)}\n      typescript: ${show(decoded)}`);
  }
}

const tokens = expected.cases.reduce((n, c) => n + c.ids["256"].length, 0);
console.log(
  `parity: ${expected.cases.length} cases, ${checks} assertions, ${tokens} tokens compared`
);

if (failures.length) {
  console.error(`\nFAILED (${failures.length}${failures.length === 25 ? "+" : ""} mismatches):\n`);
  console.error(failures.join("\n\n"));
  process.exit(1);
}
console.log("parity: OK — TypeScript output is identical to Python");
