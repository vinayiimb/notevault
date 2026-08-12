#!/usr/bin/env python3
"""
Convert a "Full Archive Map" CSV (Official Programme / Semester / Subject /
UPC / Question Paper Link / Question Paper Session / ...) into the column
shape NoteVault's Bulk Upload / import:full-archive-csv flow expects
(course, subject, yearRange, semesterGroup, semester, fileUrl, fileName,
note). Read-only: writes a new CSV next to the output path, touches no
database.

Usage:
    python3 convert_mapped_csv_to_bulk_upload.py <input.csv> <output.csv>
"""
import csv
import re
import sys


def derive_year_range(session: str, year: str) -> str:
    session_u = (session or "").upper()
    try:
        y = int(year)
    except (TypeError, ValueError):
        return session or year or ""
    if "NOV" in session_u or "DEC" in session_u:
        return f"{y}-{y + 1}"
    if "MAY" in session_u or "JUNE" in session_u:
        return f"{y - 1}-{y}"
    return str(y)


def main():
    if len(sys.argv) != 3:
        print("Usage: convert_mapped_csv_to_bulk_upload.py <input.csv> <output.csv>")
        sys.exit(1)
    src, dest = sys.argv[1], sys.argv[2]

    with open(src, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))

    # Row 0 is a title, row 1 a description, row 2 the real header — matches
    # the "Full Archive Map" export format inspected by hand before writing this.
    header = rows[2]
    data = rows[3:]
    idx = {name: header.index(name) for name in header}

    def get(row, name):
        i = idx.get(name)
        if i is None or i >= len(row):
            return ""
        return row[i].strip()

    out_rows = []
    skipped_no_link = 0
    for row in data:
        file_url = get(row, "Question Paper Link")
        if not file_url:
            skipped_no_link += 1
            continue

        course = get(row, "Official Programme")
        subject = get(row, "Subject / Paper Name")
        semester_raw = get(row, "Semester")
        session = get(row, "Question Paper Session")
        year = get(row, "Question Paper Year")
        upc = get(row, "UPC") or get(row, "Recovered UPC")
        paper_type = get(row, "Paper Type")
        course_number = get(row, "Course Number")
        set_ = get(row, "Question Paper Set")
        marks = get(row, "Question Paper Marks")

        year_range = derive_year_range(session, year)
        semester_group = f"Semester {semester_raw}" if semester_raw else "Semester Unknown"

        note_parts = [
            p
            for p in [
                f"UPC {upc}" if upc else None,
                paper_type or None,
                course_number or None,
                session or None,
                set_ or None,
                f"{marks} marks" if marks else None,
            ]
            if p
        ]
        note = " | ".join(note_parts)

        out_rows.append(
            {
                "course": course,
                "subject": subject,
                "yearRange": year_range,
                "semesterGroup": semester_group,
                "semester": semester_raw,
                "fileUrl": file_url,
                "fileName": "",
                "note": note,
            }
        )

    fieldnames = ["course", "subject", "yearRange", "semesterGroup", "semester", "fileUrl", "fileName", "note"]
    with open(dest, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"Read {len(data)} source rows.")
    print(f"Skipped {skipped_no_link} rows with no Question Paper Link.")
    print(f"Wrote {len(out_rows)} rows to {dest}")


if __name__ == "__main__":
    main()
