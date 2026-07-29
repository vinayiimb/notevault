import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Inter, JetBrains_Mono, Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Selectable as a heading-font option in the Note Designer's typography
// controls (src/lib/note-theme.ts) alongside Winkle/Inter/Fraunces.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// MADE Gentle (the display face used by the reference design) is a paid,
// non-Google-Fonts typeface — Fraunces is the closest free stand-in (same
// bold, rounded, friendly serif character). Swap this out if a MADE Gentle
// license is ever purchased.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Commercial license confirmed paid directly with the author — safe to use
// as the default published note body/heading font (src/lib/note-theme.ts's
// DEFAULT_THEME). Personal-use-only otherwise; see the original license
// file under ~/Downloads/winkle if this ever needs re-verifying.
const winkle = localFont({
  src: "../fonts/winkle-regular.ttf",
  variable: "--font-winkle",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NoteVault — Notes, PYQs & Answer Keys",
  description:
    "Browse notes, previous year question papers, and answer keys by class, program, semester, and subject.",
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("notevault-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${mono.variable} ${winkle.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Script id="notevault-theme" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </body>
    </html>
  );
}
