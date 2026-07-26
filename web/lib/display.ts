/** Helpers for showing token text — which is often whitespace — legibly. */

export const DOT = "·";
export const ARROW = "→";
export const RETURN = "↵";

/** Formats an integer with thousands separators, for the mono stat readouts. */
export function num(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * A single-line, always-visible rendering of a token, for table cells and
 * tooltips. Whitespace becomes a glyph so a token like " the" is not just an
 * apparent indent, and a bare newline token is not an empty cell.
 */
export function literal(text: string): string {
  return text
    .replace(/\n/g, RETURN)
    .replace(/\r/g, "\\r")
    .replace(/\t/g, ARROW)
    .replace(/ /g, DOT);
}

/** Describes a token's bytes as hex, e.g. "e2 80 99". */
export function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
}
