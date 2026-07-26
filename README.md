# BPE-512 — a byte-pair tokenizer built from scratch

A byte-level byte-pair encoding tokenizer written from scratch in Python, trained on
10 MB of English text: **256 merges, a 512-token vocabulary**. Built while following
Andrej Karpathy's tokenizer tutorial.

**Live demo → [bpe-tokenizer-harman.vercel.app](https://bpe-tokenizer-harman.vercel.app)**

## What's here

| Path | |
| --- | --- |
| `tokenizer.py` | The tokenizer: GPT-4 style regex pre-tokenization, `train` / `encode` / `decode`, save/load |
| `vocab.bpe` | The trained merges, in learning order — the source of truth |
| `readable.vocab` | Every token id with its decoded text, for eyeballing |
| `embed.py` | Feeds token ids through an `nn.Embedding` (untrained) to show what comes next |
| `file_splitter.py` | Splits the training corpus into parts small enough to work with |
| `web/` | The interactive visualiser — see [web/README.md](web/README.md) |

Training data is not committed. `train()` takes any text file.

## How it works

1. **Split.** A regex cuts text into chunks so a merge can never straddle a word
   boundary, keeping `'s`, short digit runs, and a word's leading space together.
2. **Encode to bytes.** Chunks become UTF-8 bytes, so the base vocabulary is the 256
   byte values and nothing is ever out of vocabulary.
3. **Merge, greedily.** Training repeatedly counts adjacent pairs and merges the most
   frequent into a new token. Encoding replays those merges in learned order.
4. **Decode.** Each token maps to exact bytes, so decoding is concatenation — the round
   trip is lossless even on text the tokenizer never saw.

On English it reaches ~2.05 bytes/token. On scripts it never trained on it does worse
than raw bytes, which the demo makes visible.

## The web demo

`web/` is a Next.js app that runs the tokenizer **client-side** — `vocab.bpe` is 2.2 KB,
so `encode`/`decode` are ported to TypeScript and no server is needed. Python stays the
source of truth, and `npm run parity` proves the port matches it exactly (currently
15,003 assertions over 225,626 tokens, zero mismatches).

Because merges are ordered, the first *N* lines of `vocab.bpe` form a valid tokenizer
with a `256 + N` vocabulary — which is what the demo's merge slider exploits to show
compression appearing one merge at a time.

## Credits

Built by Harman Sandhu. Learned from Andrej Karpathy's YouTube tutorial.
