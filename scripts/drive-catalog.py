"""Rebuild public/data/papers-catalog.json (the /papers dataset) from the
"DU PYQ Papers (Drive Upload)" Google Drive folder.

The folder is a copy of the SSD library (/Volumes/SSD/DU_Papers_Library),
so every Drive file is matched by its path to a row of
DU_Papers_All_Papers.csv to get its UPC, paper name, type, semester and exam.
Papers sharing a UPC get one subject name (the official syllabus name when the
UPC is in DU_Syllabus_UG.csv), so /papers lists every paper with that code
under a single subject.

  python3 scripts/drive-catalog.py crawl   # list the Drive folder -> manifest
  python3 scripts/drive-catalog.py build   # manifest + CSV -> papers-catalog.json

Papers matched to the official syllabus ("1 - Verified ..." folder) go to
papers-catalog.json (/papers); everything else ("2 - More Papers (Not in
Syllabus)": older CBCS / unmatched) goes to papers-noncore-catalog.json
(/papers/noncore).

Re-run both after more files are uploaded to the folder.
"""
import collections, csv, html, json, re, sys, time, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

DRIVE_FOLDER = "1Oy0aMRCEBM75uwDow3Dv1Bdrg7mNaEzM"
LIBRARY = Path("/Volumes/SSD/DU_Papers_Library")
ROOT = Path(__file__).resolve().parent.parent
MANIFEST = LIBRARY / "drive_manifest.json"
OUT = ROOT / "public" / "data" / "papers-catalog.json"
OUT_NONCORE = ROOT / "public" / "data" / "papers-noncore-catalog.json"

ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8}

# embeddedfolderview lists a public ("anyone with the link") folder without
# auth: one <a href=".../folders/<id>|.../file/d/<id>"> + title per entry.
ENTRY = re.compile(
    r'<a href="https://drive\.google\.com/(drive/folders|file/d)/([\w-]+)[^"]*"[^>]*>.*?'
    r'flip-entry-title">([^<]*)<',
    re.S,
)


def nfc(s):
    return unicodedata.normalize("NFC", s).strip()


def fetch(folder_id):
    url = f"https://drive.google.com/embeddedfolderview?id={folder_id}"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # rate limits / timeouts: back off and retry
            err = e
            time.sleep(2**attempt)
    raise RuntimeError(f"{folder_id}: {err}")


def crawl():
    files, folders, frontier = [], 0, [(DRIVE_FOLDER, "")]
    with ThreadPoolExecutor(8) as pool:
        while frontier:
            pages = list(pool.map(lambda f: (f[1], fetch(f[0])), frontier))
            frontier = []
            for prefix, page in pages:
                for kind, fid, title in ENTRY.findall(page):
                    path = prefix + nfc(html.unescape(title))
                    if kind == "drive/folders":
                        frontier.append((fid, path + "/"))
                        folders += 1
                    elif path.lower().endswith(".pdf"):
                        files.append({"path": path, "id": fid})
            print(f"folders={folders} files={len(files)} next={len(frontier)}", flush=True)
    MANIFEST.write_text(json.dumps(files, ensure_ascii=False, indent=0))
    print(f"wrote {MANIFEST} ({len(files)} files)")


def read_csv(name):
    with open(LIBRARY / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def semester_of(path):
    m = re.search(r"/Semester ([IVX]+)/", path, re.I)
    return str(ROMAN[m.group(1).upper()]) if m and m.group(1).upper() in ROMAN else None


def build():
    manifest = json.loads(MANIFEST.read_text())
    # The SSD is case-insensitive, so Drive can show a folder as "Semester Ii".
    rows = {nfc(r["Library file"]).lower(): r for r in read_csv("DU_Papers_All_Papers.csv")}
    official = {}
    for r in read_csv("DU_Syllabus_UG.csv"):
        if r["UPC"].strip() and r["Name of the Course"].strip():
            official.setdefault(r["UPC"].strip(), r["Name of the Course"].strip())

    names_by_upc = collections.defaultdict(collections.Counter)
    for r in rows.values():
        if r["UPC"] and r["Name of the Paper"]:
            names_by_upc[r["UPC"]][r["Name of the Paper"].strip()] += 1

    def subject_name(upc, name):
        if upc in official:
            return official[upc]
        if upc in names_by_upc:
            return names_by_upc[upc].most_common(1)[0][0]
        return name or "Untitled paper"

    catalog, unmatched = [], []
    for f in manifest:
        r = rows.get(f["path"].lower())
        if not r:
            unmatched.append(f["path"])
            continue
        upc = r["UPC"].strip()
        tag = r["Tag"].strip()
        exam = r["Exam"].strip() or "Year not known"
        sem = semester_of(f["path"])
        catalog.append({
            "id": f"drive-{f['id']}",
            "yearRange": exam,
            "semesterGroup": f"Semester {sem}" if sem else "Semester not specified",
            "course": r["Course folder"].strip(),
            "subject": subject_name(upc, r["Name of the Paper"].strip()),
            "semester": sem,
            "pdfUrl": f"https://drive.google.com/file/d/{f['id']}/view",
            "note": " | ".join(x for x in [f"UPC {upc}" if upc else "", tag] if x) or None,
            "source": "drive",
            "fileName": f["path"].rsplit("/", 1)[-1],
            "upc": upc or None,
            "paperType": tag or None,
            "verified": f["path"].startswith("1 - Verified"),
            "college": None,
        })

    catalog.sort(key=lambda p: (p["course"], int(p["semester"] or 99), p["subject"], p["yearRange"]))
    for out, verified in [(OUT, True), (OUT_NONCORE, False)]:
        part = [p for p in catalog if p["verified"] == verified]
        out.write_text(json.dumps(part, ensure_ascii=False))
        print(f"wrote {out.name}: {len(part)} papers, {len({p['course'] for p in part})} courses")
    print(f"{len(unmatched)} Drive files not in the index")
    for p in unmatched[:20]:
        print("  unmatched:", p)


if __name__ == "__main__":
    {"crawl": crawl, "build": build}[sys.argv[1] if len(sys.argv) > 1 else "build"]()
