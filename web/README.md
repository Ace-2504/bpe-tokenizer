# BPE Tokenizer — web frontend

An interactive visualiser for the byte-level BPE tokenizer in `../tokenizer.py`.
Layout inspired by [tiktokenizer](https://tiktokenizer.vercel.app/); styling is the
research-lab theme with six switchable colour themes.

## How it runs

The tokenizer runs **entirely in the browser**. `vocab.bpe` is only 256 merges
(2.2 KB), so there is no reason to keep a Python server in the loop:

- **Python trains.** `../tokenizer.py` learns the merges and writes `../vocab.bpe`.
  That file is the source of truth.
- **`scripts/build-vocab.mjs` converts it** to `lib/merges.json`. The vocabulary
  strings are *derived* from the merges the same way `BPETokenizer.load()` derives
  them, so nothing can drift; `../readable.vocab` is used only as a cross-check.
- **`lib/bpe.ts` replays them.** A direct port of `encode` / `decode`, verified
  against Python (see below).

Because merges are learned in order, the first *N* lines of `vocab.bpe` are themselves
a valid tokenizer with a `256 + N` vocabulary. That is what the merge slider exploits
to show compression appearing one merge at a time.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build (fully static)
npm run build:vocab  # regenerate lib/merges.json from ../vocab.bpe
npm run parity       # verify the TypeScript port matches Python exactly
npm run lint
```

Re-run `build:vocab` after any retraining, then `parity`.

## The parity test

`lib/bpe.ts` is only trustworthy if it agrees with Python. `npm run parity` dumps
ground truth from `../tokenizer.py` over ~1,670 inputs — hand-picked edge cases plus
1,500 random slices of the real training data — and asserts the port reproduces the
chunk split, the token ids at 0/1/20/100/255/256 merges, and the decode round trip.
Currently 15,003 assertions over 225,626 tokens, zero mismatches.

It needs the repo venv (for the `regex` package); `scripts/run-python.mjs` finds it.

Three things in the Python pattern have no JavaScript equivalent, and the test exists
mostly to keep them honest:

1. **Possessive quantifiers** (`++`, `?+`, `{1,3}+`) become plain greedy ones. Safe
   here because each is either last in its alternative or is an optional prefix whose
   character class excludes what follows it.
2. **`(?i:…)`** inline-flag groups do not exist, so that alternation is expanded.
3. **`\s` differs between the languages.** `tokenizer.py` matches with the `regex`
   module, whose `\s` is the Unicode `White_Space` property. JavaScript's `\s` also
   includes U+FEFF; Python's own `re` module additionally treats U+001C–U+001F as
   whitespace, while `regex` does not. The class is therefore written out literally in
   `lib/bpe.ts` rather than using `\s`.

One more trap the test caught: `TextDecoder` **strips a leading U+FEFF** unless
constructed with `{ ignoreBOM: true }`, which would silently break the round trip.

## Notes

- `test/parity/expected.json` is generated (~11 MB) and gitignored.
- Themes are CSS-variable swaps under `[data-theme]`. The grid/glow layer sits on a
  `position: fixed` `body::before` — *not* `background-attachment: fixed`, which
  Chromium will not repaint when custom properties change at runtime.
- `<html data-theme>` is rewritten by an inline script before hydration to avoid a
  flash of the default theme, which is why that element carries
  `suppressHydrationWarning`.
