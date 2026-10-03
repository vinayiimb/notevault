/** "/pyq@Bot BCom Sem-1 finance" → { sem: 1, tokens: ["bcom", "finance"] }. */
export function parsePyqQuery(raw: string): { sem: number | null; tokens: string[] } {
  const text = raw.replace(/^\/\w+(@\w+)?/, "").toLowerCase();
  const semRe = /\bsem(?:ester)?\s*-?\s*([1-8])\b/;
  const sem = text.match(semRe)?.[1];
  const tokens = text.replace(semRe, " ").split(/[^a-z0-9]+/).filter(Boolean);
  return { sem: sem ? Number(sem) : null, tokens };
}
