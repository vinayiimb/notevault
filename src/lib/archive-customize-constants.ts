// Packed-value separator for mergeCatalogSubjectsAction's "mergeTarget"
// field — U+241F SYMBOL FOR UNIT SEPARATOR, a real printable character
// that will never appear in a real subject name. In its own plain module
// (not src/lib/actions.ts) because a "use server" file may only export
// async functions — a plain constant there fails the build.
export const MERGE_TARGET_SEP = "␟";
