"""
CBCS-LOCF datesheet PDF parser (North Campus + SOL files that have a text layer).

Every sheet is a ruled table: a header row ("Subject | Sem. | Unique Paper Code |
Description", plus "Time" or "Date of Examination" on the SOL sheets) and one row
per paper. Rows and cells come from pdfplumber's table geometry, so text that sits
on a different line from its code cell (vertically centred cells) still lands in the
right row. What is printed once per run carries down: Subject / Sem. on the first row
of a run; the date heading (a text line above the table, a merged row, or the first
cell of the row) and the Time cell for the rest of the block.

Hindi names set in the Kruti Dev font are converted with kruti.to_unicode.
"""
import re
from datetime import date

import pdfplumber

from kruti import fix_hindi, to_unicode

MONTH_RE = r"(Nov(?:ember)?|Dec(?:ember)?|Jan(?:uary)?|Feb(?:ruary)?)"
MONTHS = {"NOV": 11, "DEC": 12, "JAN": 1, "FEB": 2}
ROMAN = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6", "VII": "7", "VIII": "8"}

CODE_RE = re.compile(r"^\d{8}$")
CODES_RE = re.compile(r"^\d{8}(?:\s*[/,&]\s*\d{8})*$")
TIME_RE = re.compile(r"(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]")
DATE_A = re.compile(rf"(?<!\d)(\d{{1,2}})(?!\d)\s*(?:st|nd|rd|th)?\s*,?\s*{MONTH_RE}\.?,?\s*(\d{{4}})?", re.I)   # 04th December, 2026
DATE_B = re.compile(rf"{MONTH_RE}\.?\s+(\d{{1,2}})(?!\d),?\s*(\d{{4}})?", re.I)                          # December 08, 2026
DAY_RE = re.compile(r"\(?\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b\)?", re.I)
ORDINALS = {"st", "nd", "rd", "th"}
MARKS = set("ंँः")
# a code-less row is only a type heading if it reads like one; anything else is a wrapped cell
TYPE_RE = re.compile(r"SKILL|ABILITY|AECC|GENERIC|\bCORE\b|DISCIPLINE|ELECTIVE|LANGUAGE|LIEU OF|VALUE ADD|\(SEC\)|\bG\.E\.|\bDSE\b", re.I)

CATEGORY_MAP = [
    (re.compile(r"SKILL ENHANCEMENT|\bSEC\b"), "SEC"),
    (re.compile(r"ABILITY ENHANCEMENT|AECC|LANGUAGES? COURSES"), "AEC"),
    (re.compile(r"GENERIC ELECTIVE"), "GE"),
    (re.compile(r"DISCIPLINE SPECIFIC ELECTIVE|\bDSE\b|ELECTIVE DISCIPLINE"), "DSE"),
    (re.compile(r"VALUE ADD"), "VAC"),
    (re.compile(r"\bCORE\b|DISCIPLINE (?:SPECIFIC )?COURSE|DISCIPLINE-|LIEU OF"), "DSC"),
]


def category_of(label: str) -> str:
    up = label.upper()
    for pattern, code in CATEGORY_MAP:
        if pattern.search(up):
            return code
    return "OTHER"


def fmt_time(m: re.Match) -> str:
    return f"{int(m.group(1)):02d}:{m.group(2)} {m.group(3).upper()}M"


def read_date(text: str, at_start: bool = False):
    """(date, remainder-of-text) for the first date written in `text`, else None.
    `at_start` only accepts a date that opens the text (a heading line)."""
    m = DATE_A.search(text)
    if m:
        day, mon, year = int(m.group(1)), m.group(2), m.group(3)
    else:
        m = DATE_B.search(text)
        if not m:
            return None
        mon, day, year = m.group(1), int(m.group(2)), m.group(3)
    if at_start and len(text[:m.start()].split()) > 4:      # a heading opens with the date, or with a short type
        return None
    mon_n = MONTHS[mon[:3].upper()]
    y = 2027 if mon_n <= 6 else 2026     # the printed year is ignored: one sheet says "5 December, 2025"
    rest = text[:m.start()] + " " + text[m.end():]
    rest = DAY_RE.sub(" ", rest)
    rest = re.sub(r"\(?\s*\d{1,2}:\d{2}[^)]*\)?", " ", rest)          # "(2:30 pm to 5:30 pm)"
    rest = re.sub(r"C\s*ontd[.…]*|…+", " ", rest, flags=re.I)
    rest = re.sub(r"\s+", " ", rest).strip(" *,.-")
    rest = re.sub(r"^\)\s*", "", rest).replace("½", "1/2")            # stray ")" from a "(Friday)" the day regex half-ate
    return date(y, mon_n, day), rest


def kruti_words(page):
    """Kruti Dev runs as words. pdfplumber sorts characters by position, which scrambles
    the zero-width matra glyphs, so they are rebuilt from the characters in stream order
    and split only at real spaces."""
    words, run = [], []

    def flush():
        if run:
            words.append({
                "text": to_unicode("".join(c["text"] for c in run)),
                "x0": min(c["x0"] for c in run), "x1": max(c["x1"] for c in run),
                "top": min(c["top"] for c in run), "bottom": max(c["bottom"] for c in run),
                "fontname": run[0]["fontname"],
            })
            run.clear()

    for ch in page.chars:
        if "Kruti" in ch["fontname"] and ch["text"].strip():
            if run and abs(ch["top"] - run[-1]["top"]) > 4:        # a new line
                flush()
            run.append(ch)
        else:
            flush()
    flush()
    return words


def page_words(page):
    plain = page.filter(lambda o: o.get("object_type") != "char" or "Kruti" not in o["fontname"])
    out = plain.extract_words(extra_attrs=["fontname"], keep_blank_chars=False) + kruti_words(page)
    # drop the superscript ordinal in "04th December" so the date reads as one line
    out.sort(key=lambda w: (round(w["top"]), w["x0"]))
    keep = []
    for w in out:
        if w["text"] in ORDINALS and keep and re.fullmatch(r"\d{1,2}", keep[-1]["text"]) \
                and abs(w["top"] - keep[-1]["top"]) < 8:
            continue
        if keep and w["text"][:1] in MARKS and abs(w["top"] - keep[-1]["top"]) < 4 and w["x0"] - keep[-1]["x1"] < 12:
            keep[-1] = {**keep[-1], "text": keep[-1]["text"] + w["text"], "x1": w["x1"]}    # "एव" + "ं"
            continue
        keep.append(w)
    return keep


def group_lines(words, tol=3.0):
    lines = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1]["top"] - w["top"]) <= tol:
            lines[-1]["words"].append(w)
        else:
            lines.append({"top": w["top"], "words": [w]})
    for ln in lines:
        ln["words"].sort(key=lambda w: w["x0"])
        ln["text"] = " ".join(w["text"] for w in ln["words"])
    return lines


def cell_text(words, bbox):
    if bbox is None:
        return ""
    x0, top, x1, bottom = bbox
    ws = [w for w in words
          if x0 <= (w["x0"] + w["x1"]) / 2 < x1 and top <= (w["top"] + w["bottom"]) / 2 < bottom]
    return " ".join(ln["text"] for ln in group_lines(ws)).strip()


def expand_row(words, row):
    """Cell texts for a table row; a row that DU drew without inner rules (several
    papers collapsed into one tall row) is split on its code words instead."""
    bbs = row.cells
    texts = [cell_text(words, c) for c in bbs]
    code_idx = next((i for i, c in enumerate(texts)
                     if len(re.findall(r"\b\d{8}\b", c)) >= 2 and not re.search(r"\d{8}\s*/\s*\d{8}", c)), None)
    if code_idx is None:
        return [texts]
    cb = bbs[code_idx]
    cws = sorted((w for w in words if CODE_RE.fullmatch(w["text"])
                  and cb[0] <= (w["x0"] + w["x1"]) / 2 < cb[2] and cb[1] <= w["top"] < cb[3]),
                 key=lambda w: w["top"])
    out = []
    for i, cw in enumerate(cws):
        top = cw["top"] - 2
        bot = cws[i + 1]["top"] - 2 if i + 1 < len(cws) else row.bbox[3]
        cells = []
        for j, bb in enumerate(bbs):
            if bb is None:
                cells.append("")
            elif j > code_idx + 1:                      # merged Date / Time cell: text only on the first paper
                cells.append(texts[j] if i == 0 else "")
            else:
                cells.append(cell_text(words, (bb[0], top, bb[2], bot)))
        out.append(cells)
    return out


def tidy_subject(s: str) -> str:
    s = s.replace("–", "-")
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)                  # "AnalyticalChemistry"
    return re.sub(r"\bevam\b", "Evam", s)


def parse_pdf(path):
    entries = []
    default_time = None
    block_time = {}                      # date -> "09:30 AM"; a block's Time cell is merged over its rows
    cur_date = None
    cur_type = ""
    subject, sem = "", None
    subject_col = True                   # False when the first column is "DATE/DAY" instead of "Subject"
    last = None                          # (code column index, entries) of the previous paper row, for wrapped cells

    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            words = page_words(page)
            lines = group_lines(words)
            foot = next((ln["top"] for ln in lines if ln["text"].startswith("Printed on")), page.height)

            if default_time is None:
                for ln in lines:
                    if "COMMENCEMENT" in ln["text"].upper() and TIME_RE.search(ln["text"]):
                        default_time = fmt_time(TIME_RE.search(ln["text"]))
                        break

            tables = page.find_tables()
            boxes = [t.bbox for t in tables]
            items = []
            for t in tables:
                for row in t.rows:
                    for k, cells in enumerate(expand_row(words, row)):
                        items.append((row.bbox[1] + k * 1e-3, "row", cells))
            # a heading's date and its type are set in different sizes, a few points apart
            for ln in group_lines(words, tol=7):
                if ln["top"] < foot and not any(b[1] - 1 <= ln["top"] <= b[3] + 1 for b in boxes):
                    items.append((ln["top"], "line", ln["text"]))
            items.sort(key=lambda it: it[0])

            for _, kind, val in items:
                if kind == "line":
                    got = read_date(val, at_start=True)
                    if got:
                        cur_date, cur_type = got[0], got[1] or cur_type
                        m = TIME_RE.search(val)
                        if m:
                            block_time[cur_date] = fmt_time(m)
                    continue

                cells = val
                texts = [c for c in cells if c]
                if not texts:
                    continue
                code_idx = next((i for i, c in enumerate(cells) if CODES_RE.fullmatch(c.strip())), None)

                if code_idx is None:
                    up = " ".join(texts).upper()
                    if "UNIQUE" in up and "SEM" in up:                      # header row
                        subject_col = "SUBJECT" in cells[0].upper() or "DEPARTMENT" in cells[0].upper()
                        m = next((TIME_RE.search(c) for c in cells if TIME_RE.search(c)), None)
                        if m and cur_date:                                  # SOL: repeated header carries the Time
                            block_time[cur_date] = fmt_time(m)
                        continue
                    got = None
                    for c in texts:
                        got = read_date(c)
                        if got:
                            cur_date = got[0]
                            m = TIME_RE.search(c)
                            if m:
                                block_time[cur_date] = fmt_time(m)
                            break
                    if got:                                                  # a date heading row: the rest is its type
                        others = [c for c in texts if not read_date(c)]
                        label = " ".join(others).strip() or got[1]
                        if label:
                            cur_type = label
                    elif TYPE_RE.search(up):                                 # a type heading with no date
                        cur_type = " ".join(texts).strip()
                    elif last:                                               # a wrapped cell of the previous paper row
                        for i, c in enumerate(cells):
                            if not c:
                                continue
                            for e in last[1]:
                                if i < last[0] and subject_col:
                                    e["subject"] = f"{e['subject']} {c}".strip()
                                elif i > last[0]:
                                    e["description"] = f"{e['description']} {c}".strip()
                            if i < last[0] and subject_col:
                                subject = f"{subject} {c}".strip()
                    continue

                # (a few tables have two overlapping cells over the code, so skip cells that repeat it)
                desc_idx = next((i for i in range(code_idx + 1, len(cells))
                                 if cells[i] and not CODES_RE.fullmatch(cells[i].strip())), None)
                if desc_idx is None:
                    continue
                desc = cells[desc_idx]
                meta = ([cells[0]] if code_idx > 0 else []) + cells[desc_idx + 1:]
                for c in meta:
                    got = read_date(c) if c else None
                    if got:
                        cur_date = got[0]
                        if got[1] and not subject_col:
                            cur_type = got[1]
                    m = TIME_RE.search(c) if c else None
                    if m and cur_date:
                        block_time[cur_date] = fmt_time(m)

                subj_parts = []
                for c in cells[:code_idx]:
                    parts = [t.upper().strip(",&/") for t in c.split()]
                    if parts and all(t in ROMAN or not t for t in parts):    # a semester cell ("III", "I, III")
                        sem = ROMAN[next(t for t in parts if t)]
                    elif c and not read_date(c):
                        subj_parts.append(c)
                if subject_col and subj_parts:
                    subject = " ".join(subj_parts)
                if cur_date is None:
                    continue

                label = cur_type
                suffix = re.search(r"\(\s*(Core|SEC|DSE|GE|AEC|VAC)\s*\)", desc, re.I)
                if suffix:                                                  # "(Core)" printed after the paper name
                    label = suffix.group(1)
                    desc = (desc[:suffix.start()] + " " + desc[suffix.end():]).strip()
                made = []
                for code in re.findall(r"\d{8}", cells[code_idx]):
                    made.append({
                        "date": cur_date.isoformat(),
                        "day": cur_date.strftime("%A"),
                        "startTime": block_time.get(cur_date) or default_time or "",
                        "subject": fix_hindi(tidy_subject(subject)) if subject_col else "",
                        "semester": sem,
                        "paperCode": code,
                        "description": fix_hindi(re.sub(r"\s+", " ", desc)),
                        "typeLabel": label,
                        "category": category_of(label),
                    })
                entries.extend(made)
                last = (code_idx, made)
    seen, unique = set(), []                  # a few papers are printed twice on the same day
    for e in entries:
        key = (e["date"], e["paperCode"], e["subject"], e["semester"], e["description"])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique


if __name__ == "__main__":
    import json
    import sys
    rows = parse_pdf(sys.argv[1])
    print(json.dumps(rows[:int(sys.argv[2]) if len(sys.argv) > 2 else 10], ensure_ascii=False, indent=1))
    print(len(rows), "rows")
