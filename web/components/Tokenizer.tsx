"use client";

import { useDeferredValue, useMemo, useState } from "react";

import { MAX_MERGES, byteLength, getTokenizer } from "@/lib/bpe";
import { literal, num } from "@/lib/display";
import { SAMPLES } from "@/lib/samples";
import TokenView from "@/components/TokenView";
import VocabExplorer from "@/components/VocabExplorer";

/** Inputs longer than this are rejected outright rather than hanging the tab. */
const MAX_CHARS = 60_000;

type View = "tokens" | "ids";

export default function Tokenizer() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [numMerges, setNumMerges] = useState(MAX_MERGES);
  const [view, setView] = useState<View>("tokens");
  const [showWhitespace, setShowWhitespace] = useState(false);

  // Keeps typing and dragging responsive: the heavy encode runs against the
  // deferred values while React keeps the controls interactive.
  const deferredText = useDeferredValue(text);
  const deferredMerges = useDeferredValue(numMerges);

  const tokenizer = getTokenizer(deferredMerges);
  const fullTokenizer = getTokenizer(MAX_MERGES);

  const result = useMemo(
    () => tokenizer.encodeDetailed(deferredText),
    [tokenizer, deferredText]
  );

  const bytes = useMemo(() => byteLength(deferredText), [deferredText]);
  const chars = useMemo(() => Array.from(deferredText).length, [deferredText]);

  const tokenCount = result.ids.length;
  const ratio = tokenCount > 0 ? bytes / tokenCount : 0;

  // Reference points for the compression comparison.
  const fullCount = useMemo(
    () => fullTokenizer.encode(deferredText).length,
    [fullTokenizer, deferredText]
  );

  const roundTrip = useMemo(
    () => tokenizer.decode(result.ids) === deferredText,
    [tokenizer, result.ids, deferredText]
  );

  const usedIds = useMemo(() => new Set(result.ids), [result.ids]);

  // The merges that fired most often on this input.
  const topMerges = useMemo(() => {
    const counts = new Map<number, number>();
    for (const step of result.trace) {
      counts.set(step.into, (counts.get(step.into) ?? 0) + step.count);
    }
    return Array.from(counts, ([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id - b.id)
      .slice(0, 28);
  }, [result.trace]);

  const activeSample = SAMPLES.find((s) => s.text === text)?.id ?? null;
  const stale = deferredText !== text || deferredMerges !== numMerges;

  return (
    <>
      <div className="workbench" id="tokenize">
        {/* ---------------- Input ---------------- */}
        <section className="panel card">
          <div className="card-head">
            <div>
              <span className="tag">Input</span>
              <h2 style={{ marginTop: 4 }}>Type or paste anything</h2>
            </div>
          </div>

          <div className="samples">
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="btn"
                aria-pressed={activeSample === s.id}
                onClick={() => setText(s.text)}
              >
                {s.label}
              </button>
            ))}
            <button type="button" className="btn" onClick={() => setText("")}>
              Clear
            </button>
          </div>

          <textarea
            className="panel-inset input mono"
            value={text}
            spellCheck={false}
            maxLength={MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            aria-label="Text to tokenize"
            placeholder="Start typing…"
          />

          <div className="input-foot">
            <span>
              <span className="mono">{num(chars)}</span> characters ·{" "}
              <span className="mono">{num(bytes)}</span> UTF-8 bytes
            </span>
            {/* Rendered only while stale, so it is not announced when idle. */}
            <span aria-live="polite">{stale ? "recomputing…" : ""}</span>
          </div>
        </section>

        {/* ---------------- Output ---------------- */}
        <section className="panel card">
          <div className="card-head">
            <div>
              <span className="tag">Output</span>
              <h2 style={{ marginTop: 4 }}>
                {num(tokenizer.vocabSize)}-token vocabulary
                {deferredMerges < MAX_MERGES && (
                  <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>
                    {" "}
                    · {num(deferredMerges)} of {MAX_MERGES} merges
                  </span>
                )}
              </h2>
            </div>
          </div>

          <div className="stats">
            <div className="stat is-primary">
              <span className="value">{num(tokenCount)}</span>
              <span className="tag label">Tokens</span>
            </div>
            <div className="stat">
              <span className="value">{ratio > 0 ? ratio.toFixed(2) : "—"}</span>
              <span className="tag label">Bytes / token</span>
            </div>
            <div className="stat">
              <span className="value">{num(chars)}</span>
              <span className="tag label">Characters</span>
              <span className="sub">unicode codepoints</span>
            </div>
            <div className="stat">
              <span className="value">{num(result.chunks.length)}</span>
              <span className="tag label">Chunks</span>
              <span className="sub">after the split regex</span>
            </div>
          </div>

          <div className="controls">
            <div className="segmented" role="tablist" aria-label="Output view">
              <button
                type="button"
                role="tab"
                aria-selected={view === "tokens"}
                onClick={() => setView("tokens")}
              >
                Tokens
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "ids"}
                onClick={() => setView("ids")}
              >
                Token ids
              </button>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={showWhitespace}
                onChange={(e) => setShowWhitespace(e.target.checked)}
              />
              Show whitespace
            </label>
          </div>

          {view === "tokens" ? (
            <TokenView tokens={result.tokens} showWhitespace={showWhitespace} />
          ) : (
            <div className="panel-inset ids" aria-label="Token ids">
              {result.ids.length === 0 ? (
                <span className="empty">Nothing to tokenize yet.</span>
              ) : (
                result.ids.map((id, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <b>{id}</b>
                  </span>
                ))
              )}
            </div>
          )}

          <div className={roundTrip ? "roundtrip" : "roundtrip bad"}>
            <span className="dot" aria-hidden="true" />
            {roundTrip ? (
              <span>
                Lossless: <code className="mono">decode(encode(text))</code> returns the input
                exactly.
              </span>
            ) : (
              <span>Round trip mismatch — this would be a bug.</span>
            )}
          </div>
        </section>
      </div>

      {/* ---------------- Merge budget ---------------- */}
      <section className="panel card section" id="merges">
        <div className="card-head">
          <div>
            <span className="tag">Merge budget</span>
            <h2 style={{ marginTop: 4 }}>Watch compression appear, one merge at a time</h2>
          </div>
        </div>

        <div className="merge-grid">
          <div>
            <div className="slider-row">
              <input
                type="range"
                min={0}
                max={MAX_MERGES}
                step={1}
                value={numMerges}
                onChange={(e) => setNumMerges(Number(e.target.value))}
                aria-label="Number of merges to apply"
              />
              <span className="merge-readout">
                <span className="n">{num(numMerges)}</span> / {MAX_MERGES} merges
              </span>
            </div>

            {/* The two reference points are dropped when the slider is already
                sitting on them, so no row is ever shown twice. */}
            <div className="compression">
              {deferredMerges !== 0 && (
                <CompRow label="0 merges" tokens={bytes} bytes={bytes} max={bytes} ghost />
              )}
              <CompRow
                label={`${num(deferredMerges)} merge${deferredMerges === 1 ? "" : "s"}`}
                tokens={tokenCount}
                bytes={bytes}
                max={bytes}
                ghost={false}
              />
              {deferredMerges !== MAX_MERGES && (
                <CompRow
                  label={`${MAX_MERGES} merges`}
                  tokens={fullCount}
                  bytes={bytes}
                  max={bytes}
                  ghost
                />
              )}
            </div>

            <p className="note">
              Merges are learned in order, so the first <code>N</code> lines of{" "}
              <code>vocab.bpe</code> are themselves a complete tokenizer with a{" "}
              <code>256 + N</code> token vocabulary. At 0 merges every byte is its own
              token, which is why that bar is the full width.
            </p>
          </div>

          <div>
            <span className="tag">Merges applied to this input</span>
            <div className="trace" style={{ marginTop: 10 }}>
              {topMerges.length === 0 ? (
                <span className="empty">
                  {tokenCount === 0
                    ? "Nothing to tokenize yet."
                    : "No merges fired — every token here is a single byte."}
                </span>
              ) : (
                topMerges.map(({ id, count }) => (
                  <span className="trace-item" key={id}>
                    <b>{literal(new TextDecoder().decode(tokenizer.vocab[id]))}</b>
                    {" ×"}
                    {num(count)}
                  </span>
                ))
              )}
            </div>
            {topMerges.length > 0 && (
              <p className="note">
                Most-applied merges first. Each one replaced a pair of adjacent tokens
                with a single learned token.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- Vocabulary ---------------- */}
      <VocabExplorer tokenizer={tokenizer} usedIds={usedIds} />
    </>
  );
}

/** One row of the compression comparison: a label, a bar, and a token count. */
function CompRow({
  label,
  tokens,
  bytes,
  max,
  ghost,
}: {
  label: string;
  tokens: number;
  bytes: number;
  max: number;
  ghost: boolean;
}) {
  const width = max > 0 ? Math.max(1, (tokens / max) * 100) : 0;
  const ratio = tokens > 0 ? bytes / tokens : 0;
  return (
    <div className={ghost ? "comp-row is-ghost" : "comp-row"}>
      <span className="k">{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="v">
        {num(tokens)} tok
        {ratio > 0 && (
          <span style={{ color: "var(--fg-dim)" }}> · {ratio.toFixed(2)}×</span>
        )}
      </span>
    </div>
  );
}
