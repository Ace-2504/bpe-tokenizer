/**
 * TypeScript port of tokenizer.py (BPETokenizer).
 *
 * Python stays the source of truth: it does the training and writes vocab.bpe.
 * This file only *replays* those merges so the site can tokenize in the browser
 * with no server. Parity with Python is enforced by test/parity (npm run parity).
 */

import mergeData from "./merges.json";

/* ------------------------------------------------------------------ *
 * The split pattern
 *
 * Python (regex module):
 *   '(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}++|\p{N}{1,3}+
 *   | ?[^\s\p{L}\p{N}]++[\r\n]*+|\s++$|\s*[\r\n]|\s+(?!\S)|\s
 *
 * Three things do not exist in JavaScript regex and are translated here:
 *
 * 1. Possessive quantifiers (`?+`, `++`, `{1,3}+`) -> plain greedy.
 *    Safe in every case in this pattern: each possessive quantifier is either
 *    last in its alternative (nothing can force a backtrack), or is the
 *    optional prefix `[^\r\n\p{L}\p{N}]?+` whose class excludes letters, so
 *    giving the character back could never let the following `\p{L}+` match.
 *
 * 2. `(?i:...)` inline-flag group -> the alternation is expanded by hand.
 *
 * 3. `\s` means different things in the two languages, so the class is written
 *    out literally instead of using `\s` (and `\S` becomes its negation).
 *    tokenizer.py matches with the `regex` module, whose `\s` is the Unicode
 *    White_Space property. That differs from JavaScript's `\s` at U+FEFF, which
 *    JavaScript includes and White_Space does not. It also differs from Python's
 *    own `re` module, which additionally treats U+001C-U+001F as whitespace —
 *    to this tokenizer those four are punctuation, not space. Both differences
 *    are covered by the parity test.
 * ------------------------------------------------------------------ */

/** The Unicode White_Space property, i.e. `\s` as the `regex` module sees it. */
const WS = "\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";

export const SPLIT_PATTERN_SOURCE = [
  "'(?:[sSdDmMtT]|[lL][lL]|[vV][eE]|[rR][eE])",
  "[^\\r\\n\\p{L}\\p{N}]?\\p{L}+",
  "\\p{N}{1,3}",
  ` ?[^${WS}\\p{L}\\p{N}]+[\\r\\n]*`,
  `[${WS}]+$`,
  `[${WS}]*[\\r\\n]`,
  `[${WS}]+(?![^${WS}])`,
  `[${WS}]`,
].join("|");

/** Splits text into pre-token chunks, exactly as re.findall(pattern, text) does. */
export function splitChunks(text: string): string[] {
  const re = new RegExp(SPLIT_PATTERN_SOURCE, "gu");
  return Array.from(text.matchAll(re), (m) => m[0]);
}

/* ------------------------------------------------------------------ *
 * Core BPE
 * ------------------------------------------------------------------ */

export type Merge = readonly [number, number];

/** Packs a token pair into one number so it can key a Map. Ids must be < 65536. */
const packPair = (a: number, b: number) => a * 65536 + b;

const encoder = new TextEncoder();
/**
 * Lossy decode == Python's bytes.decode("utf-8", errors="replace").
 *
 * ignoreBOM: true is required for that equivalence: the default (false) makes
 * TextDecoder *strip* a leading U+FEFF, so decode(encode("﻿")) would come
 * back empty where Python returns "﻿".
 */
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });

/** One token in the output, with everything the UI needs to render it. */
export interface DetailedToken {
  /** Token id (0-255 are raw bytes; >=256 are learned merges). */
  id: number;
  /** The token's bytes. */
  bytes: Uint8Array;
  /** Decoded text. May contain U+FFFD when the token cuts a character in half. */
  text: string;
  /** True when `text` is not a faithful rendering of `bytes` (split character). */
  lossy: boolean;
  /** Index of the pre-token chunk this token came from. */
  chunkIndex: number;
}

export interface EncodeResult {
  ids: number[];
  tokens: DetailedToken[];
  chunks: string[];
  /** Merges that actually fired, in order, for the "how it tokenized" trace. */
  trace: { pair: Merge; into: number; count: number }[];
}

export class BPETokenizer {
  /** packed pair -> new token id, in training order. */
  readonly merges: Map<number, number>;
  /** token id -> bytes. */
  readonly vocab: Uint8Array[];
  /** The (p0, p1) each learned token was built from; index 0 == token 256. */
  readonly mergeList: Merge[];

  constructor(merges: readonly Merge[]) {
    this.merges = new Map();
    this.mergeList = merges.map(([a, b]) => [a, b] as Merge);
    this.vocab = [];
    for (let i = 0; i < 256; i++) this.vocab.push(Uint8Array.of(i));
    merges.forEach(([p0, p1], i) => {
      const idx = 256 + i;
      this.merges.set(packPair(p0, p1), idx);
      const a = this.vocab[p0];
      const b = this.vocab[p1];
      const joined = new Uint8Array(a.length + b.length);
      joined.set(a, 0);
      joined.set(b, a.length);
      this.vocab.push(joined);
    });
  }

  get vocabSize(): number {
    return this.vocab.length;
  }

  /** Replaces every occurrence of `pair` with `idx` (tokenizer.py: merge). */
  private static mergeAll(ids: number[], p0: number, p1: number, idx: number): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < ids.length) {
      if (i < ids.length - 1 && ids[i] === p0 && ids[i + 1] === p1) {
        out.push(idx);
        i += 2;
      } else {
        out.push(ids[i]);
        i += 1;
      }
    }
    return out;
  }

  /**
   * tokenizer.py: encode_chunks. Repeatedly applies the lowest-numbered
   * (earliest-learned) merge present, until none apply.
   *
   * `trace` collects the merges that fired, when provided.
   */
  private encodeChunkBytes(bytes: Uint8Array, trace?: EncodeResult["trace"]): number[] {
    let tokens = Array.from(bytes);
    while (tokens.length >= 2) {
      // Candidate pairs in first-seen order, mirroring Python's dict ordering so
      // that `min` breaks ties the same way.
      const seen = new Set<number>();
      let bestPair = -1;
      let bestRank = Infinity;
      for (let i = 0; i + 1 < tokens.length; i++) {
        const key = packPair(tokens[i], tokens[i + 1]);
        if (seen.has(key)) continue;
        seen.add(key);
        const rank = this.merges.get(key);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestPair = key;
        }
      }
      if (bestPair < 0) break; // no pair in merges -> done
      const p0 = Math.floor(bestPair / 65536);
      const p1 = bestPair % 65536;
      const before = tokens.length;
      tokens = BPETokenizer.mergeAll(tokens, p0, p1, bestRank);
      trace?.push({ pair: [p0, p1], into: bestRank, count: before - tokens.length });
    }
    return tokens;
  }

  /** tokenizer.py: encode. */
  encode(text: string): number[] {
    const ids: number[] = [];
    for (const chunk of splitChunks(text)) {
      const chunkIds = this.encodeChunkBytes(encoder.encode(chunk));
      for (const id of chunkIds) ids.push(id);
    }
    return ids;
  }

  /** Same as encode(), but keeps the per-token detail the UI renders. */
  encodeDetailed(text: string): EncodeResult {
    const chunks = splitChunks(text);
    const ids: number[] = [];
    const tokens: DetailedToken[] = [];
    const trace: EncodeResult["trace"] = [];
    chunks.forEach((chunk, chunkIndex) => {
      for (const id of this.encodeChunkBytes(encoder.encode(chunk), trace)) {
        ids.push(id);
        const bytes = this.vocab[id];
        const text = decoder.decode(bytes);
        tokens.push({
          id,
          bytes,
          text,
          lossy: text.includes("�") && !chunk.includes("�"),
          chunkIndex,
        });
      }
    });
    return { ids, tokens, chunks, trace };
  }

  /** tokenizer.py: decode. */
  decode(ids: readonly number[]): string {
    let total = 0;
    for (const id of ids) total += this.vocab[id]?.length ?? 0;
    const buf = new Uint8Array(total);
    let at = 0;
    for (const id of ids) {
      const b = this.vocab[id];
      if (!b) continue;
      buf.set(b, at);
      at += b.length;
    }
    return decoder.decode(buf);
  }

  /** The (p0, p1) a learned token came from, or null for a raw byte. */
  parentsOf(id: number): Merge | null {
    return id >= 256 ? this.mergeList[id - 256] ?? null : null;
  }
}

/* ------------------------------------------------------------------ *
 * The trained tokenizer, plus truncated variants for the merge slider.
 *
 * Because merges are ordered, the first N lines of vocab.bpe are themselves a
 * valid tokenizer with vocab size 256 + N. That is what lets the UI show
 * compression improving as merges accumulate.
 * ------------------------------------------------------------------ */

export const ALL_MERGES: Merge[] = (mergeData.merges as number[][]).map(
  ([a, b]) => [a, b] as Merge
);
export const MAX_MERGES = ALL_MERGES.length;

const cache = new Map<number, BPETokenizer>();

/** Tokenizer using only the first `numMerges` merges (memoized). */
export function getTokenizer(numMerges: number = MAX_MERGES): BPETokenizer {
  const n = Math.max(0, Math.min(MAX_MERGES, Math.floor(numMerges)));
  let tok = cache.get(n);
  if (!tok) {
    tok = new BPETokenizer(ALL_MERGES.slice(0, n));
    cache.set(n, tok);
  }
  return tok;
}

/** UTF-8 byte length of a string. */
export function byteLength(text: string): number {
  return encoder.encode(text).length;
}
