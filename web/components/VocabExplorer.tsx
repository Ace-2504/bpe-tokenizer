"use client";

import { useMemo, useState } from "react";

import type { BPETokenizer } from "@/lib/bpe";
import { hexBytes, literal, num } from "@/lib/display";

interface Props {
  tokenizer: BPETokenizer;
  /** Ids present in the current input, for the "used in your text" filter. */
  usedIds: Set<number>;
}

/** Browsable table of every token in the vocabulary. */
export default function VocabExplorer({ tokenizer, usedIds }: Props) {
  const [query, setQuery] = useState("");
  const [learnedOnly, setLearnedOnly] = useState(true);
  const [usedOnly, setUsedOnly] = useState(false);

  const decoded = useMemo(
    () => tokenizer.vocab.map((bytes) => new TextDecoder().decode(bytes)),
    [tokenizer]
  );

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const out: number[] = [];
    for (let id = 0; id < tokenizer.vocab.length; id++) {
      if (learnedOnly && id < 256) continue;
      if (usedOnly && !usedIds.has(id)) continue;
      if (q) {
        const hit =
          decoded[id].toLowerCase().includes(q) ||
          String(id) === q ||
          literal(decoded[id]).toLowerCase().includes(q);
        if (!hit) continue;
      }
      out.push(id);
    }
    return out;
  }, [query, learnedOnly, usedOnly, usedIds, decoded, tokenizer]);

  return (
    <section className="panel card section" id="vocabulary">
      <div className="card-head">
        <div>
          <span className="tag">Vocabulary</span>
          <h2 style={{ marginTop: 4 }}>
            All {num(tokenizer.vocab.length)} tokens, and the pair each one came from
          </h2>
        </div>
        <span className="tag">{num(rows.length)} shown</span>
      </div>

      <div className="vocab-head">
        <input
          className="field mono"
          type="search"
          placeholder="Search token text or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the vocabulary"
        />
        <label className="check">
          <input
            type="checkbox"
            checked={learnedOnly}
            onChange={(e) => setLearnedOnly(e.target.checked)}
          />
          Learned merges only (hide the 256 raw bytes)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={usedOnly}
            onChange={(e) => setUsedOnly(e.target.checked)}
          />
          Used in your text
        </label>
      </div>

      <div className="panel-inset vocab-scroll">
        <table className="vocab">
          <thead>
            <tr>
              <th style={{ width: 62 }}>Id</th>
              <th>Token</th>
              <th style={{ width: 74 }}>Bytes</th>
              <th style={{ width: "38%" }}>Built from</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <span className="empty">No tokens match that filter.</span>
                </td>
              </tr>
            )}
            {rows.map((id) => {
              const parents = tokenizer.parentsOf(id);
              return (
                <tr key={id}>
                  <td className="num">{id}</td>
                  <td className="tokcell">
                    <span className="lit" title={hexBytes(tokenizer.vocab[id])}>
                      {literal(decoded[id])}
                    </span>
                  </td>
                  <td className="num">{tokenizer.vocab[id].length}</td>
                  <td className="from">
                    {parents ? (
                      <>
                        <span className="lit">{literal(decoded[parents[0]])}</span>
                        {" + "}
                        <span className="lit">{literal(decoded[parents[1]])}</span>
                        <span style={{ color: "var(--fg-dim)" }}>
                          {"  "}
                          ({parents[0]}, {parents[1]})
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "var(--fg-dim)" }}>raw byte 0x{id.toString(16).padStart(2, "0")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
