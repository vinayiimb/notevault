#!/usr/bin/env python3
"""
Download every datesheet PDF linked from DU's datesheet page, keeping DU's folders
(NEP/, "CBCS PDF SIG"/, CBCS_SOUTH/, "SOL SIG CBCS"/), ready for extract.py.

    python3 scripts/datesheet/download.py [out folder]   (default ~/Downloads/DU_Datesheet_FINAL)

DU's quirks handled here: hrefs use backslashes, and some links 404 while the file sits on
the server under a shorter name (the NEP SOL sheets drop "_January 2026–27"), so a 404 is
retried with that suffix removed. Every file must be a complete PDF (starts %PDF, ends %%EOF).
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
    print(f"{len(rels)} PDFs linked from {PAGE}")
    failed = []
    for i, rel in enumerate(rels, 1):
        candidates = [rel]
        short = re.sub(r" · December_January 2026–27\.pdf$", " · December 2026.pdf", rel)
        if short != rel:
            candidates.append(short)
        for cand in candidates:
            try:
                data = fetch(url_for(cand))
            except urllib.error.HTTPError:
                continue
            except RuntimeError as e:
                print(f"{i:2d} FAIL {cand}: {e}")
                break
            dest = OUT / cand
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            note = "  (DU's link 404s; used " + Path(cand).name + ")" if cand != rel else ""
            print(f"{i:2d} ok {len(data) // 1024:6d} KB  {cand}{note}")
            break
        else:
            print(f"{i:2d} MISSING on DU's server: {rel}")
            failed.append(rel)
    print(f"\nsaved under {OUT}; {len(failed)} not available: {failed}")


if __name__ == "__main__":
    main()
