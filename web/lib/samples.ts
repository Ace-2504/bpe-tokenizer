/** Preset inputs, chosen to show off different corners of the tokenizer. */
export interface Sample {
  id: string;
  label: string;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "prose",
    label: "English prose",
    text: `The tokenizer was trained on ten megabytes of ordinary English text, so ordinary English is what it compresses best. Common words and word endings became single tokens, because they were the pairs it saw most often.

Notice that a leading space is part of the token: " the" is one token, while "the" at the start of a line is another.`,
  },
  {
    id: "code",
    label: "Code",
    text: `def encode(self, text):
    text_chunks = re.findall(pattern, text)
    ids = []
    for ch in text_chunks:
        ids.extend(self.encode_chunks(ch.encode("utf-8")))
    return ids`,
  },
  {
    id: "unicode",
    label: "Unicode & emoji",
    text: `café · naïve · Zürich
日本語のテキスト
Привет мир
हिन्दी में लिखा
emoji: 🙂 👍🏽 👨‍👩‍👧‍👦 🇮🇳`,
  },
  {
    id: "repetition",
    label: "Repetition",
    text: `the the the the the the the the
ing ing ing ing ing ing ing ing
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
  },
  {
    id: "numbers",
    label: "Numbers & symbols",
    text: `1 12 123 1234 12345 1234567890
3.14159  1,000,000  -273.15  2^32
!!! ??? --> <= >= != === @#$%^&*`,
  },
];
