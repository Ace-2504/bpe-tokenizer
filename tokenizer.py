import regex as re
import textwrap

GPT4_SPLIT_PATTERN = r"""'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}++|\p{N}{1,3}+| ?[^\s\p{L}\p{N}]++[\r\n]*+|\s++$|\s*[\r\n]|\s+(?!\S)|\s"""
pattern = re.compile(GPT4_SPLIT_PATTERN)


def get_stats(ids, counts=None):
    counts = {} if counts is None else counts
    for pair in zip(ids, ids[1:]):
        counts[pair] = counts.get(pair, 0) + 1
    return counts


def merge(ids, pair, idx):
    newids = []
    i = 0
    while i < len(ids):
        if i < len(ids) - 1 and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            newids.append(idx)
            i += 2
        else:
            newids.append(ids[i])
            i += 1
    return newids


class BPETokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {idx: bytes([idx]) for idx in range(256)}

    def train(self, text, vocab_size, verbose=False):
        assert vocab_size >= 256
        num_merges = vocab_size - 256
        chunks = re.findall(pattern, text)
        ids = [list(ch.encode("utf-8")) for ch in chunks]
        for i in range(num_merges):
            stats = {}
            for chunk_ids in ids:
                get_stats(chunk_ids, stats)
            if not stats:
                break
            pair = max(stats, key=stats.get)
            idx = 256 + i
            ids = [merge(chunk_ids, pair, idx) for chunk_ids in ids]
            self.merges[pair] = idx
            self.vocab[idx] = self.vocab[pair[0]] + self.vocab[pair[1]]
            if verbose:
                print(f"merge {i+1}/{num_merges}: {pair} -> {idx}")

    def decode(self, ids):
        tokens = b"".join(self.vocab[idx] for idx in ids)
        return tokens.decode("utf-8", errors="replace")

    def encode_chunks(self, text_bytes):
        tokens = list(text_bytes)
        while len(tokens) >= 2:
            stats = get_stats(tokens)
            pair = min(stats, key=lambda p: self.merges.get(p, float("inf")))
            if pair not in self.merges:
                break
            tokens = merge(tokens, pair, self.merges[pair])
        return tokens
    
    def encode(self, text):
        text_chunks = re.findall(pattern, text)
        ids = []
        for ch in text_chunks:
            ids.extend(self.encode_chunks(ch.encode("utf-8")))
        return ids
    
    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            for (p0, p1), idx in self.merges.items():
                f.write(f"{p0} {p1}\n")

    def load(self, path):
        self.merges = {}
        self.vocab = {idx: bytes([idx]) for idx in range(256)}
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                p0, p1 = map(int, line.split())
                idx = 256 + i
                self.merges[(p0, p1)] = idx
                self.vocab[idx] = self.vocab[p0] + self.vocab[p1]
            
    def save_readable(self, path):
        with open(path, "w", encoding="utf-8") as f:
            for idx, token_bytes in self.vocab.items():
                text = token_bytes.decode("utf-8", errors="replace")
                f.write(f"{idx}: {text!r}\n")


if __name__ == "__main__":
    text = open("part_1_english_dataset_40mb.txt", encoding="utf-8").read()
    tok = BPETokenizer()
    # tok.train(text, vocab_size=512, verbose=True)
    # tok.save("vocab.bpe")
    # tok.save_readable("readable.vocab")
    
    tok.load("vocab.bpe")
    sample = "hello world"
    ids = tok.encode(sample)
    print(f"number of tokens used: {len(ids)}")
    print(ids)
    # with open("tokens_used_256_merges.txt", "w", encoding="utf-8") as f:
    #     f.write(textwrap.fill(str(ids), width=100))
    
    # ids = tok.encode(sample)
    # ratio = len(sample.encode("utf-8"))/len(ids)
    # print(f"compression ratio: {ratio:.2f} bytes/tokens")