#!/usr/bin/env python3
"""
Download the main NEP datesheet PDFs (NEP/, minus the SOL sheets) linked from DU's datesheet
page, ready for extract.py.

    python3 scripts/datesheet/download.py [out folder]   (default ~/Downloads/DU_Datesheet_FINAL)

DU's hrefs use backslashes; every file must be a complete PDF (starts %PDF, ends %%EOF).
"""
import html
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

PAGE = "https://misc.exam.du.ac.in/datesheetnd26/"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Downloads" / "DU_Datesheet_FINAL"


def fetch(url: str) -> bytes:
    last = None
    for attempt in range(3):                       # DU's server drops large transfers now and then
        try:
            data = urllib.request.urlopen(url, timeout=120).read()
            if data[:4] != b"%PDF" or b"%%EOF" not in data[-2048:]:
                raise ValueError("incomplete PDF")
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            last = e
        except Exception as e:                     # noqa: BLE001 — truncated reads, timeouts
            last = e
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(last)


def url_for(rel: str) -> str:
    return PAGE + "assets/" + urllib.parse.quote(rel)


def main():
    page = urllib.request.urlopen(PAGE, timeout=60).read().decode("utf8")
    rels = list(dict.fromkeys(
        html.unescape(h).replace("\\", "/").split("assets/", 1)[1]
        for h in re.findall(r'href="([^"]*\.pdf)"', page, re.I)
    ))
    rels = [r for r in rels if r.startswith("NEP/") and "-SOL" not in r]
    print(f"{len(rels)} PDFs linked from {PAGE}")
    failed = []
    for i, rel in enumerate(rels, 1):
        try:
            data = fetch(url_for(rel))
        except (urllib.error.HTTPError, RuntimeError) as e:
            print(f"{i:2d} FAIL {rel}: {e}")
            failed.append(rel)
            continue
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"{i:2d} ok {len(data) // 1024:6d} KB  {rel}")
    print(f"\nsaved under {OUT}; {len(failed)} failed: {failed}")


if __name__ == "__main__":
    main()
