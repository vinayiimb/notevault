import type { Metadata } from "next";
import Script from "next/script";
import { Comic_Neue, Fraunces, Inter, JetBrains_Mono, Manrope } from "next/font/google";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./notes-content.css";
import { SITE_NAME, SITE_URL, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

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

// Comic Sans MS itself isn't a licensable web font — Comic Neue is the
// open-source Google Fonts stand-in, purpose-built as a modern Comic Sans
// replacement. Selectable as a heading/sub-heading/body font option in the
// Note Designer's typography controls (src/lib/note-theme.ts).
const comicNeue = Comic_Neue({
  variable: "--font-comic",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DU PYQ Online – Delhi University Previous Year Question Papers",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Download Delhi University previous year question papers, notes, syllabus and answer keys by course and semester. Free access with no login required.",
  applicationName: SITE_NAME,
  alternates: {
    canonical: "./",
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — Delhi University Previous Year Question Papers`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("notevault-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
    if (localStorage.getItem("notevault-sidebar-collapsed") !== "false") {
      document.documentElement.classList.add("sidebar-collapsed");
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
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${fraunces.variable} ${mono.variable} ${winkle.variable} ${manrope.variable} ${comicNeue.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()).replace(/</g, "\\u003c"),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd()).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <Script
          id="notevault-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </body>
    </html>
  );
}
