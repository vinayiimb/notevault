"""Second-chance matching of "More Papers" (papers whose printed code is not in
the official NEP syllabus) to the syllabus, by course + paper name.

The library build (SSD/DU_Papers_Library/build_library.py) only trusts the
printed paper code. Old CBCS/LOCF codes (8 digits), misread codes and papers
filed under shared folders therefore all ended up outside /papers even when
the course and paper name match a current syllabus subject.

  python3 scripts/rematch-papers.py test    # precision of each level on papers whose code IS known
  python3 scripts/rematch-papers.py build   # writes scripts/rematch.json (read by drive-catalog.py)

Read-only on the SSD library. Matching, strictest level first:
  1 same name after removing DSC-1 / GE / (DSE) / "B.Com (P)" noise
  2 same, with one word misspelt (1-2 letters)
  3 syllabus name sits inside the printed name (extra words before/after)
  4 printed name is a truncated start of the syllabus name
Roman numerals / numbers must always agree (Mechanics I != Mechanics II).
A paper is placed only if exactly one syllabus code qualifies at its level
(semester breaks ties). Everything else stays "earlier syllabus".
"""
import collections, csv, html, json, re, sys, types, unicodedata
from difflib import SequenceMatcher
from pathlib import Path

sys.dont_write_bytecode = True
sys.modules.setdefault("fitz", types.ModuleType("fitz"))  # build_library imports it; we never OCR
LIB = Path("/Volumes/SSD/DU_Papers_Library")
sys.path.insert(0, str(LIB))
import build_library as B  # noqa: E402  (load_official, paper_name)

SEM_VETO = True  # looser levels (3-4) need the semester to agree
OUT = Path(__file__).resolve().parent / "rematch.json"
ROMAN = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}
STOP = {"the", "and", "of", "in", "to", "for", "a", "an", "on", "with", "by", "from"}
OCR_NUM = {"ill": "iii", "lll": "iii", "il": "ii", "ll": "ii", "1": "i", "2": "ii", "3": "iii", "4": "iv",
           "5": "v", "6": "vi", "7": "vii", "8": "viii"}
KEEP_SHORT = {"it", "ai", "hr", "ml", "pc", "ir"}

PROG_NOISE = re.compile(
    r"\b(?:b\.?\s?com|b\.?\s?a|b\.?\s?sc)\.?\s*(?:\(\s*(?:hons?|h|prog|p)\.?\s*\)|hons?\b|prog\b)", re.I)
TAG_NOISE = re.compile(
    r"\b(?:dsc|dse|ge|sec|vac|aec|aecc|dec|oc)\b\s*[-:.]?\s*(?:\d+\b|[ivx]+\b|\(\s*[ivx\d]+\s*\))?", re.I)
CODE_NOISE = re.compile(r"\b[a-z]{2,6}\d{2,4}\b|\b(?:bch|bcp|bcom|bsc|hons|prog)\b", re.I)  # BMATH306, "(BCH 4-3)"
DATE_NOISE = re.compile(r"\([^)]*\d[^)]*\)?|\((?:[^)]*)$")  # "(Nov/Dec 2021)", "(5X3)", unclosed "(BCH"


def tokens(name):
    s = unicodedata.normalize("NFKC", html.unescape(name or "")).lower().replace("&", " and ")
    s = DATE_NOISE.sub(" ", s)
    s = PROG_NOISE.sub(" ", s)
    s = TAG_NOISE.sub(" ", s)
    s = CODE_NOISE.sub(" ", s)
    raw = re.findall(r"[a-z0-9]+", s)
    for i in range(len(raw) - 1):  # OCR split a word: "datab ase", "comp_uter"
        if VOCAB and raw[i] + raw[i + 1] in VOCAB and (raw[i] not in VOCAB or raw[i + 1] not in VOCAB):
            raw[i], raw[i + 1] = raw[i] + raw[i + 1], ""
    out = []
    for t in raw:
        t = OCR_NUM.get(t, t)  # "Physics-Ill" -> iii, "Macroeconomics -1" -> i
        if not t:
            continue
        if t in STOP:
            continue
        if len(t) <= 2 and not t.isdigit() and t not in ROMAN and t not in KEEP_SHORT:
            continue  # OCR junk: "o", "nc", "oe"
        if len(t) > 3 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        t = re.sub(r"is(ation|e|ed|ing)$", r"iz\1", t) if len(t) > 6 else t  # organisation == organization
        t = re.sub(r"our$", "or", t) if len(t) > 5 else t  # behaviour == behavior
        out.append(t)
    return out


def is_num(t):
    return t in ROMAN or t.isdigit()


def lev(a, b, limit):
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


VOCAB = collections.Counter()  # word -> syllabus names using it (a typo like "perspecitve" appears once); filled by Syllabus()


def tok_close(a, b):
    if a == b:
        return True
    if is_num(a) or is_num(b) or min(len(a), len(b)) < 4:
        return False
    if VOCAB[a] >= 2 and VOCAB[b] >= 2:  # two real words ("microeconomic" / "macroeconomic"), not a typo
        return False
    return lev(a, b, 2) <= (1 if min(len(a), len(b)) < 8 else 2)


def level(paper, cand):
    """Lowest level (1-4) at which `paper` tokens match `cand` tokens, else None."""
    if not paper or not cand:
        return None
    if paper == cand:
        return 1
    if sorted(paper) == sorted(cand):  # "Differential Equations Ordinary" == "Ordinary Differential Equations"
        return 2
    if len(paper) == len(cand) and sum(a != b for a, b in zip(paper, cand)) == 1 and all(tok_close(a, b) for a, b in zip(paper, cand)):
        return 2
    # one name holds the other plus up to 3 extra words (prefix, suffix or "(GST)" inside), spelling slips allowed
    short, long_ = (cand, paper) if len(cand) <= len(paper) else (paper, cand)
    if len(short) >= 2 and len(long_) - len(short) <= 3 and \
            {t for t in short if is_num(t)} == {t for t in long_ if is_num(t)} and \
            all(any(tok_close(s, l) for l in long_) for s in short):
        return 3
    n, p = len(cand), len(paper)
    if p >= 2 and len("".join(paper)) >= 12 and p < n and cand[:p - 1] == paper[:p - 1] and cand[p - 1].startswith(paper[p - 1]):
        return 4
    return None


class Syllabus:
    def __init__(self):
        self.off = B.load_official()
        self.norm_prog = {self.nrm(o["programme"]): o["programme"] for o in self.off.values()}
        self.keys = {c: tokens(o["name"]) for c, o in self.off.items()}
        VOCAB.update(t for k in self.keys.values() for t in set(k))
        # names that exist with and without a number ("Mathematical Physics" / "... II")
        self.base = {c: tuple(t for t in k if not is_num(t)) for c, k in self.keys.items()}
        self.by_prog = collections.defaultdict(list)
        for c, o in self.off.items():
            for pg in o.get("progs", ()):
                self.by_prog[pg].append(c)
        # folder -> candidate codes
        self.progs = sorted({o["programme"] for o in self.off.values()})

    @staticmethod
    def nrm(t):
        return " ".join(re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKC", t or "").lower()).split())

    def programme(self, folder):
        return self.norm_prog.get(self.nrm(folder))

    def pool(self, folder):
        """Codes a paper filed under `folder` could belong to; None = no restriction."""
        pg = self.programme(folder)
        if pg:
            return self.by_prog[pg]
        f = folder.lower()
        tag = next((t for t, pat in (("SEC", "skill enh|sec"), ("VAC", "value add|vac"), ("AEC", "ability enh|aec"),
                                     ("GE", "generic|\\bge\\b"), ("DSE", "discipline elective|dse")) if re.search(pat, f)), None)
        if tag:
            return [c for c, o in self.off.items() if tag in o["tags"]]
        pat = None
        if re.search(r"b\.?\s?a\b.*prog", f):
            pat = r"^b\.?\s?a\.?\s*\(?\s*prog|^b\.?\s?a\.?\(prog|b\.a\. vocational|commerce"
        elif re.search(r"b\.?\s?sc.*prog", f):
            pat = r"^b\.?\s?sc\.?\s*\(?\s*prog|physical science|life science"
        elif re.search(r"hons", f) and "all" in f:
            pat = r"hons|honours"
        if pat:
            return [c for c, o in self.off.items() if re.search(pat, o["programme"], re.I)]
        return None  # "All Courses (mixed)", "Unsorted", ...


def sem_ok(S, c, sem):
    return not sem or sem in [x.split("-")[0] for x in S.off[c]["sems"]] or not S.off[c]["sems"]


def find(S, name, folder, sem, max_level=4, prefer_prog=None, strict=False):
    """-> (code, level) or None; None also when two syllabus subjects fit equally well.
    Levels 1-2 (same name, spelling slips) trust the name; the looser 3-4 also need the semester to agree
    and a clear winner by token overlap, so "Delhi Through the Ages" never swallows
    "Delhi Through the Ages: From Colonial to Contemporary Times"."""
    pt = tokens(name)
    if len("".join(pt)) < 5:
        return None
    pool = S.pool(folder)
    pool = pool if pool is not None else list(S.off)
    best = {}
    for c in pool:
        lv = level(pt, S.keys[c])
        if lv and lv <= max_level:
            best.setdefault(lv, []).append(c)
    for lv in sorted(best):
        cs = best[lv]
        if lv >= 3:
            near = [c for c in cs if SequenceMatcher(None, pt, S.keys[c]).ratio() >= 0.9]
            # semester must agree, unless the names are near-identical (printed semesters are often misread)
            cs = [c for c in cs if sem_ok(S, c, sem)] or near if SEM_VETO else ([c for c in cs if sem_ok(S, c, sem)] or cs)
            if not cs:
                continue
            ratio = {c: SequenceMatcher(None, pt, S.keys[c]).ratio() for c in pool}
            if strict and len(cs) > 1:
                return None
            top = max(cs, key=ratio.get)
            rest = [v for c, v in ratio.items() if c != top and S.keys[c] != S.keys[top]]
            return (top, lv) if not rest or ratio[top] - max(rest) >= 0.12 else None
        if not any(is_num(t) for t in pt) and any(
                S.base[o] == S.base[c] and S.keys[o] != S.keys[c] for c in cs for o in pool):
            return None  # "Mathematical Physics" with I/II/III siblings: the number decides, and it's missing
        if len(cs) > 1 and len({tuple(S.keys[c]) for c in cs}) == 1 and \
                (not strict or len({S.off[c]["programme"] for c in cs}) == 1):  # one subject under several codes
            own = S.programme(folder)
            return next((c for c in cs if sem_ok(S, c, sem)), None) or \
                next((c for c in cs if S.off[c]["programme"] == own), cs[0]), lv
        if len(cs) > 1 and strict:  # no course to go by: only an unambiguous name counts
            return None
        if len(cs) > 1 and prefer_prog:  # same subject under several programmes: trust the code prefix
            cs = [c for c in cs if prefer_prog in S.off[c].get("progs", ())] or cs
        if len(cs) > 1 and sem:  # same subject in several semesters
            cs = [c for c in cs if sem_ok(S, c, sem)] or cs
        return (cs[0], lv) if len(cs) == 1 else None
    return None


def read_rows():
    return list(csv.DictReader(open(LIB / "DU_Papers_All_Papers.csv", encoding="utf-8-sig")))


def printed_names():
    """Original file -> the name printed on the paper (before the syllabus overwrote it)."""
    out = {}
    for line in open(LIB / "_extract_cache.jsonl"):
        try:
            r = json.loads(line)
        except ValueError:
            continue
        out[r["path"]] = (B.paper_name(r.get("paper")), r.get("semester"))
    return out


def test():
    S, rows, printed = Syllabus(), read_rows(), printed_names()
    truth = [r for r in rows if r["Syllabus"] == "official" and printed.get(r["Original file"], (None,))[0]]
    print(f"{len(truth)} papers whose syllabus code is known, matched here by printed name + course only")
    for mx in (1, 2, 3, 4):
        ok = bad = none = 0
        wrong = []
        for r in truth:
            name, _ = printed[r["Original file"]]
            sem = (r["Semester"] or "").split("-")[0]
            m = find(S, name, r["Course folder"], sem, mx)
            if not m:
                none += 1
            elif m[0] == r["UPC"] or S.keys[m[0]] == S.keys.get(r["UPC"]) and S.off[m[0]]["programme"] == S.off[r["UPC"]]["programme"]:
                ok += 1
            else:
                bad += 1
                wrong.append((name, r["Course folder"], S.off[r["UPC"]]["name"], S.off[m[0]]["name"]))
        print(f"  up to level {mx}: right {ok}  wrong {bad}  abstain {none}  precision {ok / max(ok + bad, 1):.4f}")
        for w in wrong[:5 if mx >= 3 else 3]:
            print("     wrong:", w)


def build():
    S, rows = Syllabus(), read_rows()
    hidden = [r for r in rows if r["Library file"].startswith("2 -")]
    result, stat = {}, collections.Counter()
    for r in hidden:
        sem = (r["Semester"] or "").split("-")[0]
        folder_pg = S.programme(r["Course folder"])
        # Old code prefixes are too noisy to name a course (62351… is B.A. Prog, not B.Sc. Hons Maths),
        # so a paper in a shared folder ("All Courses (mixed)", "Common - GE") needs a one-subject name.
        m = find(S, r["Name of the Paper"], r["Course folder"], sem, strict=not folder_pg)
        key = r["Library file"].lower()
        if m:
            c, lv = m
            o = S.off[c]
            sems = [s.split("-")[0] for s in o["sems"]]
            course = folder_pg if folder_pg in o.get("progs", ()) else o["programme"]  # code shared by programmes
            result[key] = {"tier": "nep", "upc": c, "subject": o["name"], "course": course,
                           "semester": sem if sem in sems else (sems[0] if sems else sem),
                           "tag": "/".join(o["tags"]), "how": f"level {lv}" + ("" if folder_pg else " (shared folder)")}
            stat[f"nep level {lv}" + ("" if folder_pg else " (shared folder, unique name)")] += 1
        elif folder_pg:
            result[key] = {"tier": "earlier", "course": folder_pg, "how": "course known"}
            stat["earlier (course known)"] += 1
        else:
            stat["unplaced (no course)"] += 1
    # Same printed code -> same subject: a paper whose own name is garbled ("Financial rkets and
    # Institutions") follows the other papers carrying its old code, if they agree (>= 2, >= 80%).
    by_code = collections.defaultdict(collections.Counter)
    for r in hidden:
        m = result.get(r["Library file"].lower())
        if r["UPC"] and m and m["tier"] == "nep":
            by_code[r["UPC"]][(m["upc"], m["course"], m["semester"])] += 1
    for r in hidden:
        key, votes = r["Library file"].lower(), by_code.get(r["UPC"])
        if (result.get(key) or {}).get("tier") == "nep" or not votes:
            continue
        (c, course, sem), n = votes.most_common(1)[0]
        if n >= 2 and n / sum(votes.values()) >= 0.8:
            o = S.off[c]
            result[key] = {"tier": "nep", "upc": c, "subject": o["name"], "course": course, "semester": sem,
                           "tag": "/".join(o["tags"]), "how": "same printed code as matched papers"}
            stat["nep via same printed code"] += 1
            stat["earlier (course known)" if S.programme(r["Course folder"]) else "unplaced (no course)"] -= 1
    OUT.write_text(json.dumps(result, ensure_ascii=False))
    print(f"wrote {OUT.name}: {len(result)} of {len(hidden)} hidden papers re-classified")
    for k, v in sorted(stat.items()):
        print(f"  {v:6d}  {k}")


if __name__ == "__main__":
    {"test": test, "build": build}[sys.argv[1] if len(sys.argv) > 1 else "test"]()
