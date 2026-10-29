#!/usr/bin/env python3
"""
DU Datesheet PDF extractor.

Builds public/data/datesheet/ from DU's final undergraduate datesheet PDFs
(https://misc.exam.du.ac.in/datesheetnd26/), in three groups the site offers:

  nep   NEP-UGCF-2022 regular sheets (the default)
  sol   School of Open Learning sheets (NEP and CBCS)
  cbcs  CBCS-LOCF sheets for 2020 & 2021 admissions (North + South Campus)

NEP sheets (this file) are text PDFs; the CBCS ones are parsed by extract_cbcs.py
and the scanned South Campus ones read from south_cbcs.txt (extract_south.py).
Run:  python3 extract.py [folder holding NEP/, "CBCS PDF SIG"/, CBCS_SOUTH/, "SOL SIG CBCS"/]

NEP layout: repeating blocks, each starting with a header line

    DATE OF EXAM: 4TH DECEMBER, 2026 (FRIDAY) | TYPE: DISCIPLINE SPECIFIC CORE-13

followed by a 6-column table (DATE OF EXAM / START TIME / SUBJECT / SEMESTER /
UNIQUE PAPER CODE / DESCRIPTION) whose cells wrap onto 1-3 visual text lines
each, independently, so naive row-grouping-by-y misaligns columns. We instead:

  1. Read column x-boundaries from each block's own header-row words (they
     shift slightly between files/blocks).
  2. Bucket every word under that header into its column by x0.
  3. Anchor rows on the CODE column (one row per code cell, never wrapping;
     two codes joined by "/" fold into one row), and for every other column
     gather words whose `top` falls within that row's vertical span (midpoint
     between this code and the next).
"""
import json
import re
import shutil
import sys
import urllib.parse
from datetime import date
from pathlib import Path

import pdfplumber

from extract_cbcs import parse_pdf as parse_cbcs
from extract_south import parse_south

SRC_ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "DU_Datesheet_FINAL"
OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "data" / "datesheet"
BASE_URL = "https://misc.exam.du.ac.in/datesheetnd26/assets/"

NEP, CBCS = "NEP-UGCF-2022", "CBCS-LOCF"

# (PDF under SRC_ROOT, slug, label, group) — in DU's own order, which is the dropdown order.
# DU's page links the two NEP SOL sheets as "...December_January 2026–27.pdf", which 404s;
# the files on its server are "...December 2026.pdf".
PROGRAMMES = [
    ("NEP/B.A. (Hons) · December 2026.pdf", "ba-hons", "B.A. (Hons)", "nep"),
    ("NEP/B.Sc. (Hons) · December 2026.pdf", "bsc-hons", "B.Sc. (Hons)", "nep"),
    ("NEP/B.A. (Prog) · December 2026.pdf", "ba-prog", "B.A. (Prog)", "nep"),
    ("NEP/B.Sc. (Prog) · December 2026.pdf", "bsc-prog", "B.Sc. (Prog)", "nep"),
    ("NEP/B.Com (Hons) · December 2026.pdf", "bcom-hons", "B.Com (Hons)", "nep"),
    ("NEP/B.Com (Prog) · December 2026.pdf", "bcom-prog", "B.Com (Prog)", "nep"),
    ("NEP/B.A. (Vocational Studies) · December 2026.pdf", "ba-vocational", "B.A. (Vocational Studies)", "nep"),
    ("NEP/Bachelor of Vocation (B.Voc) Banking, Financial Services & Insurance _Healthcare Management_Retail Management and IT_Software Development_Web Designing · December 2026.pdf", "bvoc", "Bachelor of Vocation (B.Voc)", "nep"),
    ("NEP/B.Sc. (Pass) Home Science · December 2026.pdf", "bsc-home-science", "B.Sc. (Pass) Home Science", "nep"),
    ("NEP/B.Sc. Physical Education, Health Education & Sports · December 2026.pdf", "bsc-pehes", "B.Sc. Physical Education, Health Education & Sports", "nep"),
    ("NEP/Five Year Integrated Programme in Journalism · December 2026.pdf", "journalism-5yr", "Five Year Integrated Programme in Journalism", "nep"),
    ("NEP/DISCIPLINE SPECIFIC ELECTIVE · December 2026.pdf", "dse", "Discipline Specific Elective (DSE)", "nep"),
    ("NEP/Generic Elective (GE) · December 2026.pdf", "ge", "Generic Elective (GE)", "nep"),
    ("NEP/Ability Enhancement Course (AEC) · December 2026.pdf", "aec", "Ability Enhancement Course (AEC)", "nep"),
    ("NEP/Skill Enhancement (SEC) · December 2026.pdf", "sec", "Skill Enhancement Course (SEC)", "nep"),
    ("NEP/Value Addition (VAC) · December 2026.pdf", "vac", "Value Addition Course (VAC)", "nep"),
    ("NEP/SKILL BASED COURSE FOR PROGRAMME COURSE · December 2026.pdf", "sbc", "Skill Based Course for Programme Course", "nep"),
    ("NEP/B.A. (Prog)-SOL · December 2026.pdf", "ba-prog-sol", "B.A. (Prog) - SOL (NEP)", "sol"),
    ("NEP/B.Com (Hons)-SOL · December 2026.pdf", "bcom-hons-sol", "B.Com (Hons) - SOL (NEP)", "sol"),
    ("SOL SIG CBCS/BA(H) 22-SEM.V-III-I.pdf", "cbcs-sol-ba-hons", "B.A. (Hons) English & Political Science - SOL (CBCS)", "sol"),
    ("SOL SIG CBCS/BCOM H-22-Sem.V-III-I.pdf", "cbcs-sol-bcom-hons", "B.Com (Hons) - SOL (CBCS)", "sol"),
    ("SOL SIG CBCS/BCOM-22-Sem.I-III-V.pdf", "cbcs-sol-bcom-prog", "B.Com (Prog) - SOL (CBCS)", "sol"),
    ("SOL SIG CBCS/BAP-22-SEM.V-III-I.pdf", "cbcs-sol-ba-prog", "B.A. (Prog) - SOL (CBCS)", "sol"),
    ("CBCS PDF SIG/BA(H) 25-SEM.I,III,V.pdf", "cbcs-ba-hons", "B.A. (Hons)", "cbcs"),
    ("CBCS PDF SIG/BCOM H-25-Sem.I,III,V.pdf", "cbcs-bcom-hons", "B.Com (Hons)", "cbcs"),
    ("CBCS PDF SIG/B.SC.(H) 25-SEM.I,III,V.pdf", "cbcs-bsc-hons", "B.Sc. (Hons)", "cbcs"),
    ("CBCS PDF SIG/BSC(P)-25-Sem.I,III,V.pdf", "cbcs-bsc-prog", "B.Sc. (Prog)", "cbcs"),
    ("CBCS PDF SIG/BCOM-25-Sem.I,III,V.pdf", "cbcs-bcom-prog", "B.Com (Prog)", "cbcs"),
    ("CBCS PDF SIG/BAP-25-SEM.I,III,V.pdf", "cbcs-ba-prog", "B.A. (Prog)", "cbcs"),
    ("CBCS PDF SIG/Date-Sheet Ability Enchacement 25-Sem.I,III,V.pdf", "cbcs-aecc", "Ability Enhancement Compulsory Course (AECC)", "cbcs"),
    ("CBCS PDF SIG/Date-Sheet Generci Elective -25-Sem.I,III.pdf", "cbcs-ge", "Generic Elective (GE)", "cbcs"),
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
                # Every word on a column-header row is one of the known header
                # labels — some files wrap this header across several one/two-word
                # lines (e.g. a lone "START" line, a lone "TIME" line), others
                # print it on one line, so we can't require a count of matches;
                # we just require the line to be made up ENTIRELY of header
                # words, which footer/body text never is.
                if texts and texts.issubset(COL_HEADER_WORDS):
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

                # One table row can list two paper codes on stacked lines, joined
                # by a "/" either trailing the first code ("2036000002 /") or on
                # its own line between them (Regular & SOL). Fold them into a
                # single row so time/subject/semester aren't split between two
                # half-rows; one entry is emitted per code below.
                code_cells = []
                joined = False
                for c in cluster_column(columns["CODE"], line_gap=6.0):
                    if not re.search(r"\d{6,12}", c["text"]):
                        joined = joined or c["text"].strip().endswith("/")
                        continue
                    if code_cells and joined:
                        code_cells[-1]["text"] += " " + c["text"]
                        code_cells[-1]["last"] = c["top"]
                    else:
                        code_cells.append({"top": c["top"], "last": c["top"], "text": c["text"]})
                    joined = c["text"].rstrip().endswith("/")
                row_count = len(code_cells)
                if row_count == 0:
                    continue

                for i, code_cell in enumerate(code_cells):
                    if i == 0:
                        row_top = data_top
                    else:
                        row_top = (code_cells[i - 1]["last"] + code_cell["top"]) / 2
                    if i + 1 < len(code_cells):
                        row_bottom = (code_cell["last"] + code_cells[i + 1]["top"]) / 2
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
                    start_time = re.sub(r"^(\d):", r"0\1:", re.sub(r"\s+", " ", time_m.group(0))) if time_m else time_text.strip()

                    paper_codes = re.findall(r"\d{6,12}", code)

                    sem_m = re.search(r"\d{1,2}", semester)
                    sem_val = sem_m.group(0) if sem_m else None

                    if not description or not paper_codes:
                        continue

                    for paper_code in paper_codes:
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


TIME_OK = re.compile(r"^\d{2}:\d{2} [AP]M$")
DATE_OK = re.compile(r"^(2026-1[12]|2027-0[12])-\d\d$")


def verify(path, entries, code_len):
    """Problems with one sheet's output: a paper code printed in the PDF but not
    extracted, or a row with a malformed date/time/semester."""
    problems = []
    if path is not None:
        with pdfplumber.open(str(path)) as pdf:
            text = "\n".join(pg.extract_text() or "" for pg in pdf.pages)
        printed = set(re.findall(rf"(?<![\d-]){code_len}(?![\d-])", text))
        missing = printed - {e["paperCode"] for e in entries}
        if missing:
            problems.append(f"{len(missing)} printed code(s) not extracted: {sorted(missing)[:5]}")
    for e in entries:
        if not (TIME_OK.match(e["startTime"]) and DATE_OK.match(e["date"]) and e["semester"] and e["description"]):
            problems.append(f"bad row {e['paperCode']}: {e['date']} {e['startTime']!r} sem={e['semester']}")
            break
    return problems


def main():
    for f in OUT_DIR.glob("*.json"):          # only the new data stays: clear the previous run
        f.unlink()
    shutil.rmtree(OUT_DIR / "source-pdfs", ignore_errors=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = []
    total = 0
    failures = {}

    def emit(slug, label, group, rel, entries, path=None):
        nonlocal total
        code_len = r"\d{10,12}" if rel.startswith("NEP/") else r"\d{8}"
        problems = verify(path, entries, code_len)
        if problems:
            failures[slug] = problems
        (OUT_DIR / f"{slug}.json").write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")))
        print(f"{slug:34s} {group:5s} {len(entries):5d} rows  <- {rel}")
        total += len(entries)
        manifest.append({
            "slug": slug,
            "label": label,
            "group": group,
            "scheme": NEP if rel.startswith(("NEP/",)) else CBCS,
            "sourceFile": rel.split("/", 1)[1],
            "sourceUrl": BASE_URL + urllib.parse.quote(rel),
            "entryCount": len(entries),
        })

    missing = []
    for rel, slug, label, group in PROGRAMMES:
        path = SRC_ROOT / rel
        if not path.exists():
            missing.append(rel)
            continue
        emit(slug, label, group, rel, extract_pdf(path) if rel.startswith("NEP/") else parse_cbcs(path), path)
    if missing:
        sys.exit("MISSING PDFs under %s:\n  %s" % (SRC_ROOT, "\n  ".join(missing)))

    for slug, prog in parse_south().items():
        emit(slug, prog["label"] + " · South Campus", "cbcs", "CBCS_SOUTH/" + prog["pdf"], prog["entries"])

    (OUT_DIR / "manifest.json").write_text(json.dumps({
        "generatedAt": date.today().isoformat(),
        "examSession": "December 2026",
        "programmes": manifest,
    }, ensure_ascii=False, indent=2))
    print(f"\nTOTAL entries: {total} in {len(manifest)} programmes")
    if failures:                       # South sheets are scans: their codes were checked by hand + OCR
        for slug, problems in failures.items():
            print(f"CHECK FAILED {slug}: " + "; ".join(problems), file=sys.stderr)
        sys.exit(1)
    print("checks passed: every printed paper code extracted, every row has a valid date/time/semester")


if __name__ == "__main__":
    main()
