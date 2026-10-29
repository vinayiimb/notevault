"""
Reader for south_cbcs.txt, the hand-transcribed South Campus CBCS datesheets
(DU published them as scanned images). See that file's header for the format.
"""
import re
from datetime import date
from pathlib import Path

from extract_cbcs import category_of

TXT = Path(__file__).with_name("south_cbcs.txt")
ROMAN = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6"}
TYPES = {
    "SEC": "Skill Enhancement Course (SEC)",
    "DSE": "Discipline Specific Elective",
    "GE": "Generic Elective",
    "LANG": "Languages Courses",
    "LIEU": "In lieu of language courses",
    "-": "",
}


def parse_south(path=TXT):
    """{slug: {"label", "pdf", "entries": [...]}} in file order."""
    out = {}
    cur = None
    block = None
    for n, raw in enumerate(Path(path).read_text(encoding="utf8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            if line.startswith("="):
                slug, label, pdf, time = [p.strip() for p in line[1:].split("|")]
                cur = out[slug] = {"label": label, "pdf": pdf, "time": time, "entries": []}
            elif line.startswith("@"):
                m = re.match(r"@\s+(\d{4})-(\d\d)-(\d\d)\s+([IVX]+)\s+(\S+)(?:\s+(\d\d:\d\d [AP]M))?$", line)
                d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                label = TYPES.get(m.group(5), m.group(5))
                block = {"date": d, "sem": ROMAN[m.group(4)], "label": label, "time": m.group(6) or cur["time"]}
            else:
                parts = [p.strip() for p in line.split("|")]
                code, desc = parts[0], parts[1]
                assert re.fullmatch(r"\d{8}", code), code
                streams = [s.strip() for s in parts[2].split(",")] if len(parts) > 2 else [""]
                for stream in streams:
                    cur["entries"].append({
                        "date": block["date"].isoformat(),
                        "day": block["date"].strftime("%A"),
                        "startTime": block["time"],
                        "subject": stream,
                        "semester": block["sem"],
                        "paperCode": code,
                        "description": desc,
                        "typeLabel": block["label"],
                        "category": category_of(block["label"]),
                    })
        except Exception as e:
            raise ValueError(f"{TXT.name}:{n}: {raw!r}: {e}") from e
    return out


if __name__ == "__main__":
    for slug, p in parse_south().items():
        print(f"{slug:34s} {len(p['entries']):4d} rows  <- {p['pdf']}")
