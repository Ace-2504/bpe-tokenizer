"use client";

import { Fragment, memo } from "react";

import type { DetailedToken } from "@/lib/bpe";
import { ARROW, DOT, RETURN, hexBytes, literal } from "@/lib/display";

/** Beyond this the DOM cost stops being worth it; the stats still cover everything. */
const MAX_RENDERED = 3000;

/**
 * Renders one token's text. Whitespace is left as-is by default (so the block
 * layout matches the input) and swapped for glyphs when `showWhitespace` is on.
 * The real newline is always emitted so lines still break.
 */
function tokenContent(text: string, showWhitespace: boolean) {
  if (!showWhitespace) return text;
  const parts: React.ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (plain) {
      parts.push(plain);
      plain = "";
    }
  };
  for (const ch of text) {
    if (ch === " " || ch === "\t" || ch === "\n") {
      flush();
      const glyph = ch === " " ? DOT : ch === "\t" ? ARROW : RETURN;
      parts.push(
        <span className="ws" key={parts.length}>
          {glyph}
          {ch === "\n" ? "\n" : ""}
        </span>
      );
    } else {
      plain += ch;
    }
  }
  flush();
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

interface Props {
  tokens: DetailedToken[];
  showWhitespace: boolean;
}

/** The coloured token-block view. */
const TokenView = memo(function TokenView({ tokens, showWhitespace }: Props) {
  const shown = tokens.slice(0, MAX_RENDERED);
  return (
    <>
      <div className="panel-inset output" aria-label="Tokenized text">
        {shown.length === 0 ? (
          <span className="empty">Nothing to tokenize yet.</span>
        ) : (
          shown.map((t, i) => (
            <span
              key={i}
              className={t.lossy ? "tok lossy" : "tok"}
              title={
                `id ${t.id}  ${literal(t.text)}  [${hexBytes(t.bytes)}]` +
                (t.lossy ? "  — this token is part of a character, not a whole one" : "")
              }
            >
              {tokenContent(t.text, showWhitespace)}
            </span>
          ))
        )}
      </div>
      {tokens.length > MAX_RENDERED && (
        <p className="note">
          Showing the first {MAX_RENDERED.toLocaleString("en-US")} tokens of{" "}
          {tokens.length.toLocaleString("en-US")}. The counts above cover the whole input.
        </p>
      )}
    </>
  );
});

export default TokenView;
