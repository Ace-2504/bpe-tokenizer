"""Dumps ground-truth output from the Python tokenizer for the parity test.

Python is the specification: this writes what tokenizer.py actually produces, and
check.ts asserts the TypeScript port reproduces it byte for byte.

    ../.venv/Scripts/python.exe test/parity/dump_python.py

Writes test/parity/expected.json.
"""

import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

import regex as re  # noqa: E402

from tokenizer import BPETokenizer, pattern  # noqa: E402

MERGES_PATH = os.path.join(PROJECT_ROOT, "vocab.bpe")
DATASET_PATH = os.path.join(PROJECT_ROOT, "part_1_english_dataset_40mb.txt")


def load_truncated(num_merges):
    """A tokenizer using only the first `num_merges` lines of vocab.bpe."""
    tok = BPETokenizer()
    with open(MERGES_PATH, "r", encoding="utf-8") as f:
        lines = [ln for ln in f if ln.strip()][:num_merges]
    for i, line in enumerate(lines):
        p0, p1 = map(int, line.split())
        idx = 256 + i
        tok.merges[(p0, p1)] = idx
        tok.vocab[idx] = tok.vocab[p0] + tok.vocab[p1]
    return tok


def build_cases():
    cases = []

    # --- Hand-picked edge cases -------------------------------------------
    cases += [
        "",
        " ",
        "hello world",
        "Hello, World!",
        "hello world ",
        " hello",
        "  hello",
        "a",
        "A",
    ]

    # Contractions, including the mixed case that (?i:...) is there for.
    for base in ["s", "d", "m", "t", "ll", "ve", "re"]:
        for variant in [base, base.upper(), base.capitalize()]:
            cases.append("don'" + variant)
            cases.append("I'" + variant + " go")
    cases += ["it's", "IT'S", "It'S", "y'all", "'s", "'S alone", "can''t", "o'clock"]

    # Numbers: the {1,3} grouping.
    cases += ["1", "12", "123", "1234", "12345", "1234567890",
              "3.14159", "1,000,000", "v2 and 42 and 007",
              "٣٤٥", "一二三", "½ ¾", "2²"]

    # Punctuation / symbol runs and newline handling.
    cases += ["!!!", "...", " ...", "?!", "?!\n\n", "-->", "a--b",
              "(){}[]<>", "@#$%^&*", "a, b, c", "e.g. i.e.", "***bold***"]

    # Whitespace: the alternatives most likely to diverge between the languages.
    cases += [
        "\n", "\n\n", "\n\n\n", "\r\n", "\r\n\r\n", "\r",
        "a\n", "a\n\n", "a \n", "a  \n", "a \n ", "a\nb",
        "a \n b", "trailing   ", "trailing\t", "\ttab", "a\tb\tc",
        "  leading and trailing  ", "line1\nline2\nline3",
        "a\vb", "a\fb", "\v", "\f",
        # Python's \s includes these; JavaScript's does not.
        "a\x1cb", "a\x1db", "a\x1eb", "a\x1fb", "a\x85b",
        "\x1c", "\x85", "a\x85", "a\x1c ",
        # Unicode spaces.
        "a\xa0b", "a b", "a b", "a b", "a b",
        "a b", "a b", "a b", "a　b",
        "　", "\xa0", "a\xa0", "a ",
        # JavaScript's \s includes U+FEFF; Python's does not.
        "a﻿b", "﻿", "﻿hello", "a﻿",
        # Other format characters.
        "a​b", "a‍b", "a\xadb",
    ]

    # Unicode letters, marks and emoji (multi-byte, and characters that BPE can
    # split down the middle).
    cases += [
        "café", "naïve", "Zürich", "señor", "ﬁ ligature",
        "Ελληνικά", "Привет мир", "日本語のテキスト", "한국어", "العربية",
        "हिन्दी में", "ไทย", "עברית",
        "emoji 🙂", "🙂", "🙂🙃", "👍🏽", "👨‍👩‍👧‍👦", "🇮🇳",
        "é combining", "́", "mixed café 日本 🙂 end",
        "\U0001d4ce math script", "\U000e0041 tag char",
    ]

    # Code-ish text.
    cases += [
        "def f(x): return x**2",
        "const a = [1, 2, 3].map((x) => x * 2);",
        "SELECT * FROM t WHERE id = 1;",
        "if (a && b) { c(); }",
        "#include <stdio.h>\nint main(){return 0;}",
        "  indented\n    more\n\treal tab",
        "https://example.com/path?q=1&r=2",
        "harman2504sandhu@gmail.com",
        '{"key": "value", "n": 42}',
        "<div class=\"x\">text</div>",
    ]

    # Repetition (drives the merge behaviour hard).
    cases += ["the the the the", "aaaaaaaaaa", "ababababab",
              "hello" * 20, " the" * 30, "ing ing ing", "th" * 50]

    # --- Bulk random slices of the real training data --------------------
    if os.path.exists(DATASET_PATH):
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            blob = f.read(3_000_000)
        rng = random.Random(20250726)
        for _ in range(1500):
            n = rng.randint(1, 600)
            start = rng.randint(0, max(0, len(blob) - n - 1))
            cases.append(blob[start : start + n])

    # Drop duplicates but keep order, so a failure is easy to locate.
    seen = set()
    unique = []
    for c in cases:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def main():
    cases = build_cases()
    merge_counts = [0, 1, 20, 100, 255, 256]
    out = {"pattern": pattern.pattern, "mergeCounts": merge_counts, "cases": []}

    tokenizers = {n: load_truncated(n) for n in merge_counts}
    full = tokenizers[256]

    for text in cases:
        entry = {
            "text": text,
            "chunks": re.findall(pattern, text),
            "byteLength": len(text.encode("utf-8")),
            "ids": {str(n): tokenizers[n].encode(text) for n in merge_counts},
            "decoded": full.decode(full.encode(text)),
        }
        out["cases"].append(entry)

    path = os.path.join(HERE, "expected.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=True)

    total = sum(len(c["ids"]["256"]) for c in out["cases"])
    print(f"wrote {path}: {len(cases)} cases, {total} tokens at full vocab")


if __name__ == "__main__":
    main()
