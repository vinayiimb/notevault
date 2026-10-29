"""
Clean paper / subject names for the datesheet.

DU's sheets are typed in ALL CAPS with plenty of typos ("BUSSINESS", "AUTIDING",
"ACQUISIONS") and, on the NEP sheets, Hindi whose short-i matra sits before its
consonant ("िहंदी" for "हिंदी"). Order of preference for a paper's name:

  1. the name our own catalogues give that paper code (master syllabus, then the
     /papers catalogues) — these are curated and correctly spelt;
  2. otherwise DU's text, tidied: Hindi matra order fixed, ALL CAPS turned into
     title case, and misspelt words corrected against the vocabulary of (1) plus
     the system dictionary.

`CORRECTIONS` records every word-level fix so a run can be reviewed.
"""
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher, get_close_matches
from pathlib import Path

from kruti import KNOWN_TITLES

DATA = Path(__file__).resolve().parents[2] / "public" / "data"
SMALL = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with", "via", "vs"}
ROMAN = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"}
CONS = "कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह"
CORRECTIONS: Counter = Counter()
LAST = None


def _load():
    names = defaultdict(Counter)
    for p in json.loads((DATA / "master-syllabus-data.json").read_text()):
        if p.get("upc") and p.get("subjectName"):
            names[p["upc"].strip()][p["subjectName"].strip()] += 5
    for f in ("papers-catalog.json", "papers-noncore-catalog.json"):
        for p in json.loads((DATA / f).read_text()):
            if p.get("upc") and p.get("subject"):
                names[p["upc"].strip()][p["subject"].strip()] += 1
    by_code = {c: cnt.most_common(1)[0][0] for c, cnt in names.items()}
    vocab = Counter(w.lower() for n in by_code.values() for w in re.findall(r"[A-Za-z]{3,}", n))
    words = set()
    dict_file = Path("/usr/share/dict/words")
    if dict_file.exists():
        words = {w.strip().lower() for w in dict_file.read_text().splitlines()}
    # acronyms: capitalised tokens in mixed-case catalogue names that aren't English words
    acronyms = {w for n in by_code.values() if re.search(r"[a-z]", n)
                for w in re.findall(r"\b[A-Z]{2,6}s?\b", n) if w.lower() not in words and w not in ROMAN}
    acronyms |= {"BBA", "FIA", "BMS", "BMMMC", "IT", "ICT", "GST", "NGO", "CSR", "MSME", "MSMEs", "VLSI", "DNA",
                 "HRM", "MMI", "MMRB", "OMSP", "SME", "AI", "IPR", "GIS", "MIS", "EVS", "ERP", "NCC", "NSS", "UK", "USA"}
    return by_code, vocab, acronyms, words


BY_CODE, VOCAB, ACRONYMS, DICT = _load()
# correction targets: real dictionary words, or catalogue words common enough not to be typos themselves
DOMAIN = sorted(w for w, n in VOCAB.items() if w in DICT or n >= 4)


def _known(low: str) -> bool:
    forms = {low, low[:-1] if low.endswith("s") else low, low[:-2] if low.endswith("es") else low,
             low[:-3] + "y" if low.endswith("ies") else low}
    return any(f in VOCAB or f in DICT for f in forms)


# a capitalised token that is just an English word ("SKILLS") is not an acronym
ACRONYMS = {a for a in ACRONYMS if not any(f in DICT for f in {a.lower(), a.lower()[:-1]})} | {"IT", "AI", "UK", "USA"}
ACRONYMS -= {"AUR", "APP", "COM"}
ACRONYMS |= {"SOL", "NCWEB"}                      # Hindi "aur" and word fragments, not acronyms


def fix_hindi_order(s: str) -> str:
    """NEP sheets' text layer puts every short-i matra *before* its consonant cluster
    (visual order: "िहंदी", "सिमितयां"); move each one after its cluster. Only for NEP
    text: the CBCS Hindi (converted from Kruti Dev) is already in logical order."""
    out = list(s)
    i = 0
    while i < len(out):
        if out[i] == "ि":
            k = i + 2 if out[i + 1:i + 2] == ["ं"] else i + 1      # "सिंहता": the anusvara belongs to स
            if k < len(out) and out[k] in CONS:
                j = k + 1
                while j + 1 < len(out) and out[j] == "्" and out[j + 1] in CONS:
                    j += 2
                out[i:j] = out[i + 1:j] + ["ि"]
                i = j
                continue
        i += 1
    return "".join(out)


def _spell(word: str) -> str:
    low = word.lower()
    if len(low) < 6 or not low.isalpha() or _known(low):          # short words are often transliterations
        return word
    hit = [h for h in get_close_matches(low, DOMAIN, n=3, cutoff=0.86)
           if h[0] == low[0] and abs(len(h) - len(low)) <= 2 and not (h.startswith(low) or low.startswith(h))]
    if not hit:
        return word
    CORRECTIONS[(word, hit[0])] += 1
    return hit[0]


def _case(word: str, first: bool) -> str:
    core = word.strip("()[],.:;'\"")
    if not core:
        return word
    up = core.upper()
    if len(core) == 1:                                   # "Assamese A", "Paper B"
        new = up if (up != "A" or first or word is LAST) else "a"
    elif re.fullmatch(r"[A-Za-z]{2,}-\d+", core):                 # "RABINDRASAHITYA-1"
        new = core[:1].upper() + core[1:].lower()
    elif up in ROMAN or core in ACRONYMS or up in ACRONYMS or any(ch.isdigit() for ch in core) or "." in core:
        new = up if (up in ROMAN or up in ACRONYMS or core in ACRONYMS) else core
    else:
        low = _spell(core).lower()
        new = low if (low in SMALL and not first) else "-".join(p[:1].upper() + p[1:] for p in low.split("-"))
    return word.replace(core, new, 1)


# DU typos the general corrector can't safely reach (split words, short or rare words),
# found by listing every word in the output that is in neither the dictionary nor our
# catalogues. Everything else on that list is a correct transliteration (Puthipath,
# Jansanchar, ...) or a real term (Geropsychology, Mridangam) and is left alone.
TYPOS = [
    (r"\bAdvertisi Ng\b", "Advertising"), (r"\bFram Ework\b", "Framework"), (r"\bP Roperty\b", "Property"),
    (r"\bBiofertilizes\b", "Biofertilizers"), (r"\bCrysphere\b", "Cryosphere"), (r"\bDebetes\b", "Debates"),
    (r"\bDissicult\b", "Difficult"), (r"\bHisotry\b", "History"), (r"\bHundistani\b", "Hindustani"),
    (r"\bLietarture\b", "Literature"), (r"\bMadical\b", "Medical"), (r"\bMartydom\b", "Martyrdom"),
    (r"\bMultilinguism\b", "Multilingualism"), (r"\bPeotry\b", "Poetry"), (r"\bToursim\b", "Tourism"),
    (r"\bWisdon\b", "Wisdom"), (r"\bRenewal Energy\b", "Renewable Energy"), (r"Pãkitstãni", "Pãkistãni"),
    (r"VAIDIKA SVARA VIJÃ±Ä\(cid:0\)NA", "Vaidika Svara Vijñāna"),
    (r"\bMsmes\b", "MSMEs"), (r"\bPyton\b", "Python"), (r"\bAtheletics\b", "Athletics"),
    (r"\bPerformane\b", "Performance"), (r"\bTravelough\b", "Travelogue"), (r"\bSlving\b", "Solving"),
    (r"\bSahity 0\b", "Sahitya O"), (r"\[Rasthana Bheda", "Prasthana Bheda"),
]


def _mixed_caps(word: str) -> str:
    low = word.lower()
    if low in SMALL:
        return low
    if word in ACRONYMS or word in ROMAN or len(word) < 4 or (len(word) < 5 and not _known(low)):
        return word                                     # "SPSS", "PLC" stay; "HARVESTING" doesn't
    return word.capitalize()


def _fix_typos(text: str) -> str:
    for pattern, repl in TYPOS:
        text = re.sub(pattern, repl, text, flags=re.I)
    return text


def tidy(text: str) -> str:
    text = re.sub(r"[\x00-\x1f]", "", text)                 # stray NULs in DU's Hindi text layer
    text = _fix_typos(re.sub(r"\s+", " ", text).strip())
    if re.search(r"[A-Z]{3}", text) and not re.search(r"[a-z]", text):        # ALL CAPS
        words = text.split(" ")
        global LAST
        LAST = words[-1]
        text = " ".join(_case(w, i == 0 or words[i - 1].endswith((":", "-", "("))) for i, w in enumerate(words))
    else:
        text = re.sub(r"[A-Za-z]{5,}", lambda m: _keep_case(m.group(0), _spell(m.group(0))), text)
        text = re.sub(r"\b[A-Z]{2,}\b", lambda m: _mixed_caps(m.group(0)), text)   # "SKILLS in", "Framework OF"
        text = text[:1].upper() + text[1:]
        if re.match(r"[A-Z][a-z]", text):              # "Business organisation and management"
            text = re.sub(r"(?<=\s)([a-z])([a-z]{3,})\b",
                          lambda m: m.group(0) if m.group(0) in SMALL else m.group(1).upper() + m.group(2), text)
    text = re.sub(r"\(\s+", "(", text)
    text = re.sub(r"\s+([),])", r"\1", text)
    return _fix_typos(text)


def _keep_case(orig: str, fixed: str) -> str:
    if fixed.lower() == orig.lower():
        return orig
    return fixed.capitalize() if orig[:1].isupper() else fixed



# NEP sheets' Hindi text layer drops conjunct glyphs and scrambles word order ("'अेय' सदानंद
# हीरानंद वाायन" for "सच्चिदानंद हीरानंद वात्स्यायन 'अज्ञेय'"), which no rule can repair. Every
# NEP Hindi title, read off the rendered pages (2026-10-29), keyed by paper code.
NEP_HINDI = dict(line.split("|", 1) for line in """
2053100020|सच्चिदानंद हीरानंद वात्स्यायन 'अज्ञेय'
2055092001|हिंदी गद्य विकास के विविध चरण 'क'
2055092002|हिंदी गद्य विकास के विविध चरण 'ख'
2055092003|हिंदी गद्य विकास के विविध चरण 'ग'
2053200016|सूर्यकांत त्रिपाठी 'निराला'
2053200010|सूर्यकांत त्रिपाठी 'निराला'
2135000022|संस्कृत भाषा एवं काव्य (Advanced)
2135000023|संस्कृत भाषा एवं काव्य (Intermediate)
2135000024|संस्कृत भाषा एवं काव्य (Introductory)
2135000019|संस्कृत भाषा एवं साहित्य (Advanced)
2135000020|संस्कृत भाषा एवं साहित्य (Intermediate)
2135000021|संस्कृत भाषा एवं साहित्य (Introductory)
2052103502|आधुनिक हिन्दी कविता (छायावादोत्तर)
2054000036|हिंदी साहित्य का इतिहास (भाग 1)
2052202302|जनपदीय साहित्य (लोकनाट्य विशेष)
2051002003|हिंदी भाषा और तकनीकी (हिंदी ग)
2051002001|व्यवहारिक हिंदी (हिन्दी क)
2051001003|सोशल मीडिया और ब्लॉग लेखन - ग
2055201001|हिंदी भाषा और साहित्य - क
2055201002|हिंदी भाषा और साहित्य - ख
2055201003|हिंदी भाषा और साहित्य - ग
2051001002|हिन्दी औपचारिक लेखन - ख
2051002005|Hindi E (अनिवार्य हिन्दी पाठ्यक्रम - 2)
2126000001|अनुवाद कला
205167130002|अनुवाद कौशल
2054000033|आख्यानपरक हिंदी साहित्य
2054000006|कंप्यूटर और हिंदी
2053152003|कंप्यूटर टेक्नीकी एप्लीकेशन एवं मीडिया
2053100015|कबीरदास
2052101101|हिन्दी कविता: आदिकाल एवं निर्गुण भक्तिकाव्य
2053102002|राष्ट्रीय सांस्कृतिक काव्य-धारा
2053200012|कृष्णा सोबती
2053150008|खोजी पत्रकारिता
2055002001|हिंदी गद्य: उद्भव और विकास 'क'
2055002002|हिंदी गद्य: उद्भव और विकास 'ख'
2055002003|हिंदी गद्य: उद्भव और विकास 'ग'
2053150014|ग्लोबल मीडिया एवं भारत (ख)
2053200009|घनानंद
2052153501|जनमाध्यम के सिद्धांत
2051002002|जनसंचार और रचनात्मक लेखन (हिन्दी ख)
2052151101|जनसंचार माध्यम
2053100018|जयशंकर प्रसाद
2053100016|तुलसीदास
2054001203|पटकथा और संवाद लेखन
2053200003|हिंदी की प्रमुख संस्थाएँ एवं पत्र-पत्रिकाएँ
2053152002|पर्यावरण पत्रकारिता
2054000009|प्रवासी हिन्दी साहित्य
2052103501|पाश्चात्य काव्यशास्त्र
2054001004|फोटो पत्रकारिता
2053100017|भारतेंदु हरिश्चंद्र
2053100007|भारतीय और पाश्चात्य रंगमंच
6967000022|भारतीय भक्ति परम्परा और मानव मूल्य (for Regular & SOL)
2052151103|भारतीय समाज और संचार
2052102301|भारतीय साहित्य
2054001204|भाषा और समाज
2051001001|हिन्दी भाषा: सम्प्रेषण और संचार - क
2053100019|महादेवी वर्मा
2052152301|माध्यम कानून और आचार संहिता
2054000010|मीडिया और मानवाधिकार (क)
2053150016|मीडिया तकनीक (घ)
2054002002|मीडिया प्रोडक्शन
2053200008|मीरा
2053200011|रघुवीर सहाय
2053102003|रचनात्मक लेखन
2054002001|राजनीतिक, दार्शनिक विचारक एवं मीडिया
2052203502|राजभाषा और राष्ट्रभाषा के रूप में हिंदी
2052204701|राम काव्य परंपरा
2052152303|रेडियो
2053150009|लोक संस्कृति और समाज (ग)
2054000007|रंगमंच और लोक-साहित्य
2053102001|हिंदी की मौखिक और लोक-साहित्य परम्परा
2054000008|लोकप्रिय हिंदी साहित्य
2053150015|वीडियो निर्माण (ग)
2053200001|विभाजन विभीषिका और हिंदी साहित्य
2052153503|विज्ञापन
2054000011|वेब पत्रकारिता (ख)
2053200002|व्यावसायिक संप्रेषण और हिंदी भाषा
2053100014|शोध-प्रविधि
2055002005|संचार क्रांति और ग्लोबल मीडिया
2052152302|संपादन
2054001005|संस्कृति, साहित्य और मीडिया
2053150013|समसामयिक विश्व एवं भारत (क)
2052154701|समाचार समितियां
2052102303|सामान्य भाषा विज्ञान
6967000023|साहित्य संस्कृति और सिनेमा
205167130001|सृजनात्मक लेखन और अभिव्यक्ति कौशल
6967000024|सृजनात्मक लेखन के आयाम
2126000002|सृजनात्मक लेखन
2053200013|हरिशंकर परसाई
2052153502|हाशिए का समाज और हिन्दी मीडिया
2052103503|हिंदी आलोचना
2052104701|हिंदी एवं अन्य भारतीय भाषाएँ
2052202301|हिंदी कथा साहित्य
2052101103|हिंदी कहानी
2054001001|हिंदी का वैश्विक परिदृश्य
2052102302|हिंदी नाटक एवं एकांकी
2054001205|हिंदी भाषा और लिपि का इतिहास
2054002004|हिंदी भाषा और विज्ञापन
2052201101|हिंदी भाषा और साहित्य का इतिहास
2055091001|हिंदी भाषा और साहित्य का उद्भव और विकास - क
2055091002|हिंदी भाषा और साहित्य का उद्भव और विकास - ख
2055091003|हिंदी भाषा और साहित्य का उद्भव और विकास - ग
2052203501|हिंदी भाषा का व्यावहारिक व्याकरण
2054001002|हिंदी में व्यावहारिक अनुवाद
2053100009|हिंदी यात्रा साहित्य
2054000035|हिंदी साहित्य और सोशल मीडिया
2052101102|हिंदी साहित्य का इतिहास (आदिकाल एवं मध्यकाल)
2054000034|हिंदी साहित्य का सिनेमा में रूपान्तरण
2053150007|हिंदी सिनेमा (क)
2053100008|हिंदी सिनेमा: व्यावसायिक संदर्भ
2052201102|हिंदी सिनेमा और उसका अध्ययन
2052151102|हिंदी पत्रकारिता का इतिहास
2053152001|क्षेत्रीय पत्रकारिता
2051002006|हिंदी भाषा और तकनीकी (हिंदी ग)
2053200015|घनानंद
6967001022|भारतीय भक्ति परम्परा और मानव मूल्य (for Regular & SOL)
2053200018|कृष्णा सोबती
""".strip().splitlines())

def _unknown(text: str) -> int:
    """Words the system dictionary doesn't know (the catalogue vocabulary is not used here:
    it contains the catalogue's own slips, like "Lincar")."""
    def ok(w):
        low = w.lower()
        return any(f in DICT for f in {low, low[:-1], low[:-2], low[:-3] + "y"}) or w.upper() in ACRONYMS
    return sum(1 for w in re.findall(r"[A-Za-z]{4,}", text) if not ok(w))


def paper_name(code: str, printed: str, visual_hindi: bool = False) -> str:
    """Our catalogue's name for the code when it is clearly the same paper and no worse
    than DU's (some catalogue names are truncated — "Constitutional" — or carry OCR
    slips — "Lincar Algcbra"); otherwise DU's printed name, tidied."""
    if visual_hindi and re.search(r"[\u0900-\u097F]", printed):
        if code in NEP_HINDI:
            return NEP_HINDI[code]
        printed = fix_hindi_order(printed)
    mine = tidy(printed)
    known = BY_CODE.get(code)
    if not known or mine in KNOWN_TITLES:          # CBCS Hindi already proofread against the PDF
        return mine
    theirs = re.sub(r"^(?:DSE|DSC|GE|SEC)-?\d*\s*[:-]\s*", "", known)              # "DSE-6: ...", "DSE-Endocrinology"
    theirs = re.sub(r"\s*\((?:DSE|DSC|GE|SEC|AEC|VAC|SBC|LOCF|CBCS|IN\w*\d\w*|for Regular\s*&\s*SOL)\)?\s*$", "", theirs, flags=re.I)
    theirs = tidy(theirs)
    dev = re.compile(r"[\u0900-\u097F]")
    if dev.search(mine) and not dev.search(theirs):                    # keep Hindi in Devanagari
        return mine
    norm = lambda t: re.sub(r"[^a-z0-9\u0900-\u097F]", "", t.lower())
    same = SequenceMatcher(None, norm(mine), norm(theirs)).ratio() >= (0.6 if dev.search(mine) else 0.75)
    if same and 0.85 <= len(norm(theirs)) / max(1, len(norm(mine))) <= 1.15 and _unknown(theirs) <= _unknown(mine):
        return theirs
    return mine
