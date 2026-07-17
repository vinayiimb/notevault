// Shared shape for the Program -> Term -> Subject hierarchy, as passed from
// server components into client components that need cascading pickers
// (Restore, Bulk upload).
export type AcademicSubject = { id: string; name: string };
export type AcademicTerm = { id: string; name: string; subjects: AcademicSubject[] };
export type AcademicProgram = { id: string; name: string; level: string; terms: AcademicTerm[] };
