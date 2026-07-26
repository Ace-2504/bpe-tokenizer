import ThemePicker from "@/components/ThemePicker";
import Tokenizer from "@/components/Tokenizer";
import { MAX_MERGES } from "@/lib/bpe";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <nav className="topnav">
          <a href="#tokenize">tokenize</a>
          <a href="#merges">merges</a>
          <a href="#vocabulary">vocabulary</a>
          <a href="#how-it-works">how it works</a>
        </nav>
        <div className="topbar-right">
          <a
            className="ghost-link"
            href="https://github.com/Ace-2504"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <ThemePicker />
        </div>
      </header>

      <section className="hero">
        <div className="hero-badge">
          <span className="live-dot" aria-hidden="true" />
          <span className="tag">Built from scratch by Harman Sandhu</span>
        </div>
        <h1 className="hero-title">
          BPE<span className="hero-accent">-TOKENIZER</span>
        </h1>
        <p className="hero-sub">
          A byte-level byte-pair encoder built from scratch in Python — {MAX_MERGES} merges,
          a 512-token vocabulary — trained on 10&nbsp;MB of English text and replayed here in
          your browser. Type anything and watch it become tokens.
        </p>
      </section>

      <Tokenizer />

      <section className="panel card section" id="how-it-works">
        <span className="tag">How it works</span>
        <h2 style={{ margin: "6px 0 16px", fontSize: 15, fontWeight: 500 }}>
          Four steps, and not one of them needs a neural network
        </h2>
        <div className="steps">
          <div className="step">
            <h3>Split</h3>
            <p>
              A regex cuts the text into chunks first, so a merge can never straddle a word
              boundary. This is the GPT-4 split pattern: it keeps <code>&apos;s</code>,
              short runs of digits, and a word&apos;s leading space together.
            </p>
          </div>
          <div className="step">
            <h3>Encode to bytes</h3>
            <p>
              Each chunk becomes UTF-8 bytes, so the starting vocabulary is just the 256
              possible byte values. Nothing is ever out of vocabulary — worst case, a
              character costs one token per byte.
            </p>
          </div>
          <div className="step">
            <h3>Merge, greedily</h3>
            <p>
              Training counted adjacent pairs and merged the most frequent one into a new
              token, {MAX_MERGES} times over. Encoding replays those merges in the order
              they were learned.
            </p>
          </div>
          <div className="step">
            <h3>Decode</h3>
            <p>
              Every token maps back to its exact bytes, so decoding is just concatenation.
              That is why the round trip is lossless even for text the tokenizer has never
              seen.
            </p>
          </div>
        </div>
      </section>

      <footer className="site-foot">
        <div className="grad-divider" aria-hidden="true" />
        <p>Built by Harman Sandhu. Learned from Andrej Karpathy youtube tutorial.</p>
        <p className="fine">
          Trained in Python; the encoder is ported to TypeScript and runs entirely in your
          browser — no text leaves this page.
        </p>
      </footer>
    </main>
  );
}
