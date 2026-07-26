import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { DEFAULT_THEME, STORAGE_KEY } from "@/lib/themes";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BPE Tokenizer — a byte-pair encoder built from scratch",
  description:
    "Interactive visualiser for a byte-level BPE tokenizer trained from scratch on 10 MB of English text. See how text becomes tokens, and how each merge buys compression.",
};

/** Applies the saved theme before first paint, so there is no flash of the default. */
const noFlashScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY
)});if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning is needed for data-theme: the no-flash script above
  // rewrites it before React hydrates, and that divergence is the intended
  // behaviour. It only relaxes checking for this element's own attributes.
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
