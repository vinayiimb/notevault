"use client";

// Replaces the root layout when it fails, so it can't rely on globals.css —
// styles are inline on purpose.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: 16,
        }}
      >
        <title>Something went wrong | DU PYQ Online</title>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>This page didn&rsquo;t load</h1>
          <p style={{ color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
            It&rsquo;s usually temporary. Try again, or go back to the homepage.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ background: "#3168ff", color: "#fff", border: 0, borderRadius: 12, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 16px", fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
            >
              Homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
