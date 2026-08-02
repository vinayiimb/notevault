type MetadataField = { label: string; value: string | number | null | undefined };

// Plain metadata panel for a PYQ paper — university/course/semester/subject
// are always known (from the Program/Term/Subject relations); paper code,
// session, duration, and maximum marks come from the Resource fields added
// in the Phase F schema migration and are optional (most historical papers
// won't have all of them filled in).
export function PYQMetadata({
  university = "Delhi University",
  course,
  semester,
  subject,
  paperCode,
  year,
  session,
  maximumMarks,
  duration,
}: {
  university?: string;
  course: string;
  semester?: number | null;
  subject: string;
  paperCode?: string | null;
  year?: number | null;
  session?: string | null;
  maximumMarks?: number | null;
  duration?: string | null;
}) {
  const fields: MetadataField[] = [
    { label: "University", value: university },
    { label: "Course", value: course },
    { label: "Semester", value: semester ? `Semester ${semester}` : null },
    { label: "Subject", value: subject },
    { label: "Paper code", value: paperCode },
    { label: "Year", value: year },
    { label: "Session", value: session },
    { label: "Maximum marks", value: maximumMarks },
    { label: "Duration", value: duration },
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3 sm:p-5">
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="text-xs font-medium tracking-wide text-muted uppercase">{f.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
