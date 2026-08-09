// Pure, prop-driven — no data fetching, no server-only imports. Safe to
// import from a Client Component. Kept in its own file (not just its own
// export) deliberately: a Client Component importing anything from a
// module also pulls in that module's other top-level imports when Next
// analyzes the server/client boundary, even ones the imported export
// doesn't itself use — see currency-icon.tsx's note.
export function CurrencyIconDisplay({ url, className }: { url: string | null; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`inline-block object-contain ${className ?? "size-8"}`}
      />
    );
  }
  return <span className={className}>🍊</span>;
}
