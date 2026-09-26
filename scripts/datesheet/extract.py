#!/usr/bin/env python3
"""
DU Datesheet PDF extractor.

Parses the 19 official DU "Date-Sheet" PDFs (Dec 2026 exams) into structured
JSON consumed by the NoteVault datesheet feature.

Layout: repeating blocks, each starting with a header line

    DATE OF EXAM: 4TH DECEMBER, 2026 (FRIDAY) | TYPE: DISCIPLINE SPECIFIC CORE-13

followed by a 6-column table (DATE OF EXAM / START TIME / SUBJECT / SEMESTER /
UNIQUE PAPER CODE / DESCRIPTION) whose cells wrap onto 1-3 visual text lines
each, independently, so naive row-grouping-by-y misaligns columns. We instead:

  1. Read column x-boundaries from each block's own header-row words (they
     shift slightly between files/blocks).
  2. Bucket every word under that header into its column by x0.
  3. Anchor rows on the CODE column (exactly one paper code per row, never
     wraps), and for every other column gather words whose `top` falls within
     that row's vertical span (midpoint between this code and the next).
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

SRC_DIR = Path.home() / "Downloads"
OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "data" / "datesheet"
OUT_DIR.mkdir(parents=True, exist_ok=True)

FILES = [
    ("Ability Enhancement Course (AEC) · December 2026.pdf", "aec", "Ability Enhancement Course (AEC)"),
    ("B.A. (Hons) · December 2026.pdf", "ba-hons", "B.A. (Hons)"),
    ("B.A. (Prog) · December 2026.pdf", "ba-prog", "B.A. (Prog)"),
    ("B.A. (Prog)-SOL · December_January 2026–27.pdf", "ba-prog-sol", "B.A. (Prog) - SOL"),
    ("B.A. (Vocational Studies) · December 2026.pdf", "ba-vocational", "B.A. (Vocational Studies)"),
    ("B.Com (Hons) · December 2026.pdf", "bcom-hons", "B.Com (Hons)"),
    ("B.Com (Hons)-SOL · December_January 2026–27.pdf", "bcom-hons-sol", "B.Com (Hons) - SOL"),
    ("B.Com (Prog) · December 2026.pdf", "bcom-prog", "B.Com (Prog)"),
    ("B.Sc. (Hons) · December 2026.pdf", "bsc-hons", "B.Sc. (Hons)"),
    ("B.Sc. (Pass) Home Science · December 2026.pdf", "bsc-home-science", "B.Sc. (Pass) Home Science"),
    ("B.Sc. (Prog) · December 2026.pdf", "bsc-prog", "B.Sc. (Prog)"),
    ("B.Sc. Physical Education, Health Education & Sports · December 2026.pdf", "bsc-pehes", "B.Sc. Physical Education, Health Education & Sports"),
    ("Bachelor of Vocation (B.Voc) Banking, Financial Services & Insurance _Health Care Management_Retail Management and IT_Software Development_Web Designing · December 2026.pdf", "bvoc", "Bachelor of Vocation (B.Voc)"),
    ("DISCIPLINE SPECIFIC ELECTIVE · December 2026.pdf", "dse", "Discipline Specific Elective (DSE)"),
    ("Five Year Integrated Programme in Journalism · December 2026.pdf", "journalism-5yr", "Five Year Integrated Programme in Journalism"),
    ("Generic Elective (GE) · December 2026.pdf", "ge", "Generic Elective (GE)"),
    ("SKILL BASED COURSE FOR PROGRAMME COURSE · December 2026.pdf", "sbc", "Skill Based Course for Programme Course"),
    ("Skill Enhancement (SEC) · December 2026.pdf", "sec", "Skill Enhancement Course (SEC)"),
    ("Value Addition (VAC) · December 2026.pdf", "vac", "Value Addition Course (VAC)"),
]

CATEGORY_MAP = [
    (re.compile(r"DISCIPLINE SPECIFIC CORE"), "DSC"),
    (re.compile(r"DISCIPLINE SPECIFIC ELECTIVE"), "DSE"),
    (re.compile(r"DISCIPLINE SPECIFIC COURSE"), "DSC"),
    (re.compile(r"GENERIC ELECTIVE"), "GE"),
    (re.compile(r"SKILL ENHANCEMENT"), "SEC"),
    (re.compile(r"SKILL BASED"), "SBC"),
    (re.compile(r"VALUE ADD"), "VAC"),
    (re.compile(r"ABILITY ENHANCEMENT"), "AEC"),
    (re.compile(r"QUALIFYING"), "QUALIFYING"),
    (re.compile(r"MINOR"), "MINOR"),
]


MOJIBAKE_FIXES = [
    ("Â€“", "–"),  # mis-decoded en-dash (–)
    ("Â€™", "’"),  # mis-decoded right single quote (’)
    ("Â€œ", "“"),  # mis-decoded left double quote (“)
    ("Â€�", "”"),  # mis-decoded right double quote (”)
]


def clean_text(value: str) -> str:
    for bad, good in MOJIBAKE_FIXES:
        value = value.replace(bad, good)
    return value


def category_from_type(type_label: str) -> str:
    for pattern, code in CATEGORY_MAP:
        if pattern.search(type_label):
            return code
    return "OTHER"


MONTHS = {
    "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
    "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
}

HEADER_LINE_RE = re.compile(
    r"DATE OF EXAM:\s*(?P<d>\d{1,2})[A-Z]{2}\s+(?P<mon>[A-Z]+),?\s*(?P<y>\d{4})\s*\((?P<day>[A-Z]+)\)"
    r".*?TYPE:\s*(?P<type>.+?)\s*$",
    re.IGNORECASE,
)

COL_HEADER_WORDS = {"DATE", "OF", "EXAM", "START", "TIME", "SUBJECT", "SEMESTER",
                     "UNIQUE", "PAPER", "CODE", "DESCRIPTION"}


def cluster_column(words, line_gap=9.0):
    """Merge a column's words (sorted by top) into cell groups.
    A new cell starts when the vertical gap since the last word exceeds line_gap."""
    cells = []
    current = []
    last_top = None
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if last_top is not None and (w["top"] - last_top) > line_gap:
            cells.append(current)
            current = []
        current.append(w)
        last_top = w["top"]
    if current:
        cells.append(current)
    out = []
    for c in cells:
        c_sorted = sorted(c, key=lambda w: (w["top"], w["x0"]))
        text = " ".join(w["text"] for w in c_sorted)
        out.append({"top": c_sorted[0]["top"], "text": text})
    return out


def extract_pdf(path: Path):
    entries = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
            if not words:
                continue

            by_top = {}
            for w in words:
                by_top.setdefault(round(w["top"], 1), []).append(w)

            header_blocks = []  # list of (top, header_dict)
            header_continuation_tops = set()
            sorted_tops = sorted(by_top.items())
            for idx2, (top, ws) in enumerate(sorted_tops):
                line = " ".join(w["text"] for w in sorted(ws, key=lambda w: w["x0"]))
                if line.upper().startswith("DATE OF EXAM:") and "TYPE:" not in line.upper():
                    if idx2 + 1 < len(sorted_tops):
                        next_top, next_ws = sorted_tops[idx2 + 1]
                        line = line + " " + " ".join(w["text"] for w in sorted(next_ws, key=lambda w: w["x0"]))
                        header_continuation_tops.add(round(next_top, 1))
                m = HEADER_LINE_RE.search(line)
                if m:
                    month = MONTHS.get(m.group("mon")[:3].upper(), "01")
                    iso = f"{m.group('y')}-{month}-{m.group('d').zfill(2)}"
                    type_label = m.group("type").strip()
                    header_blocks.append((top, {
                        "date_iso": iso,
                        "day": m.group("day").title(),
                        "type_label": type_label,
                        "category": category_from_type(type_label.upper()),
                    }))

            if not header_blocks:
                continue

            header_line_tops = {round(t, 1) for t, _ in header_blocks} | header_continuation_tops
            col_header_tops = []
            for top, ws in sorted(by_top.items()):
                if round(top, 1) in header_line_tops:
                    continue
                texts = {w["text"].upper().rstrip(":") for w in ws}
                # Column-header rows are short (<=6 words) and every word on
                # them is one of the known header labels — some files wrap
                # this header across several one/two-word lines (e.g. a lone
                # "START" line, a lone "TIME" line), so we can't require 2+
                # matches on a single line; we just require the line to be
                # made up ENTIRELY of header words, which footer/body text
                # never is.
                if texts and texts.issubset(COL_HEADER_WORDS) and len(texts) <= 6:
                    col_header_tops.append((top, ws))

            footer_tops = sorted(
                t for t, ws in by_top.items()
                if any(w["text"].strip().upper() in ("NOTE", "NOTE:", "DELHI,") for w in ws)
                or " ".join(w["text"] for w in ws).strip().startswith("*")
            )

            for idx, (block_top, header) in enumerate(header_blocks):
                if idx + 1 < len(header_blocks):
                    block_bottom = header_blocks[idx + 1][0]
                else:
                    later_footers = [t for t in footer_tops if t > block_top]
                    block_bottom = min(later_footers) if later_footers else float("inf")

                relevant_header_words = [
                    w for t, ws in col_header_tops if block_top < t < block_bottom
                    for w in ws
                ]
                if not relevant_header_words:
                    continue

                col_x = {}
                for w in relevant_header_words:
                    label = w["text"].upper().rstrip(":")
                    if label in ("DATE", "OF", "EXAM"):
                        col_x.setdefault("DATE", w["x0"])
                        col_x["DATE"] = min(col_x["DATE"], w["x0"])
                    elif label in ("START", "TIME"):
                        col_x.setdefault("TIME", w["x0"])
                        col_x["TIME"] = min(col_x["TIME"], w["x0"])
                    elif label == "SUBJECT":
                        col_x["SUBJECT"] = w["x0"]
                    elif label == "SEMESTER":
                        col_x["SEMESTER"] = w["x0"]
                    elif label in ("UNIQUE", "PAPER", "CODE"):
                        col_x.setdefault("CODE", w["x0"])
                        col_x["CODE"] = min(col_x["CODE"], w["x0"])
                    elif label == "DESCRIPTION":
                        col_x["DESCRIPTION"] = w["x0"]

                required = ("DATE", "TIME", "SUBJECT", "SEMESTER", "CODE", "DESCRIPTION")
                if not all(k in col_x for k in required):
                    continue

                bounds = sorted(col_x.items(), key=lambda kv: kv[1])
                ranges = []
                for i, (name, x) in enumerate(bounds):
                    nxt = bounds[i + 1][1] if i + 1 < len(bounds) else float("inf")
                    ranges.append((name, x - 2, nxt - 2))

                header_row_tops = sorted({t for t, ws in col_header_tops if block_top < t < block_bottom})
                data_top = (header_row_tops[-1] + 6) if header_row_tops else block_top + 6

                data_words = [w for w in words if data_top < w["top"] < block_bottom]
                data_words = [w for w in data_words if not re.match(r"^\d+/\d+$", w["text"])]
                header_word_tops = {round(t, 1) for t, _ in header_blocks} | header_continuation_tops
                data_words = [w for w in data_words if round(w["top"], 1) not in header_word_tops]

                columns = {name: [] for name, _, _ in ranges}
                for w in data_words:
                    for name, lo, hi in ranges:
                        if lo <= w["x0"] < hi:
                            columns[name].append(w)
                            break

                code_cells = cluster_column(columns["CODE"], line_gap=6.0)
                code_cells = [c for c in code_cells if re.search(r"\d{6,12}", c["text"])]
                row_count = len(code_cells)
                if row_count == 0:
                    continue

                for i, code_cell in enumerate(code_cells):
                    if i == 0:
                        row_top = data_top
                    else:
                        row_top = (code_cells[i - 1]["top"] + code_cell["top"]) / 2
                    if i + 1 < len(code_cells):
                        row_bottom = (code_cell["top"] + code_cells[i + 1]["top"]) / 2
                    else:
                        row_bottom = block_bottom

                    def col_text(name):
                        ws = [w for w in columns[name] if row_top <= w["top"] < row_bottom]
                        ws_sorted = sorted(ws, key=lambda w: (w["top"], w["x0"]))
                        return " ".join(w["text"] for w in ws_sorted).strip()

                    date_text = col_text("DATE")
                    time_text = col_text("TIME")
                    subject = col_text("SUBJECT")
                    semester = col_text("SEMESTER")
                    code = code_cell["text"]
                    description = col_text("DESCRIPTION")

                    date_digits = re.sub(r"[^\d-]", "", date_text.replace(" ", ""))
                    date_m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", date_digits)
                    row_date_iso = f"{date_m.group(3)}-{date_m.group(2)}-{date_m.group(1)}" if date_m else header["date_iso"]

                    time_m = re.search(r"\d{1,2}:\d{2}\s*[AP]M", time_text.upper().replace(" ", " "))
                    start_time = time_m.group(0) if time_m else time_text.strip()

                    code_m = re.search(r"\d{6,12}", code)
                    paper_code = code_m.group(0) if code_m else code.strip()

                    sem_m = re.search(r"\d{1,2}", semester)
                    sem_val = sem_m.group(0) if sem_m else None

                    if not description or not paper_code:
                        continue

                    entries.append({
                        "date": row_date_iso,
                        "day": header["day"],
                        "startTime": start_time,
                        "subject": clean_text(subject),
                        "semester": sem_val,
                        "paperCode": paper_code,
                        "description": clean_text(description),
                        "typeLabel": clean_text(header["type_label"]),
                        "category": header["category"],
                    })
    return entries


def main():
    manifest = []
    total = 0
    for filename, slug, label in FILES:
        path = SRC_DIR / filename
        if not path.exists():
            print(f"  MISSING: {filename}", file=sys.stderr)
            continue
        entries = extract_pdf(path)
        out_path = OUT_DIR / f"{slug}.json"
        out_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
        print(f"{slug:20s} {len(entries):5d} rows  <- {filename}")
        total += len(entries)
        manifest.append({
            "slug": slug,
            "label": label,
            "sourceFile": filename,
            "entryCount": len(entries),
        })

    (OUT_DIR / "manifest.json").write_text(json.dumps({
        "generatedAt": "2026-09-26",
        "examSession": "December 2026",
        "programmes": manifest,
    }, ensure_ascii=False, indent=2))
    print(f"\nTOTAL entries: {total}")


if __name__ == "__main__":
    main()
