"""
Kruti Dev 010 -> Unicode Devanagari.

Several CBCS datesheet PDFs set their Hindi paper names in the legacy Kruti Dev
font, so the text layer holds Latin look-alikes ("fganh Hkk\"kk" for "हिंदी भाषा").
`to_unicode` converts one whitespace-free word; `OVERRIDES` pins words the
generic rules get wrong (checked by eye against the rendered PDFs).
"""
import re

# Longest key wins (see _KEYS), so "vkS" is matched before "v" + "kS".
MAP = {
    # independent vowels
    "vkS": "औ", "vks": "ओ", "vk": "आ", "v": "अ", "bZ": "ई", "b": "इ", "m": "उ",
    "Å": "ऊ", ",s": "ऐ", ",": "ए", "_": "ऋ",
    # matras (f = short i, written before the consonant; reordered below)
    "kS": "ौ", "ks": "ो", "k": "ा", "f": "ि", "h": "ी", "q": "ु", "w": "ू",
    "`": "ृ", "s": "े", "S": "ै", "a": "ं", "¡": "ँ", "%": "ः", "~": "्",
    # full consonants
    "d": "क", "[k": "ख", "x": "ग", "?k": "घ", "³": "ङ", "p": "च", "N": "छ",
    "t": "ज", ">": "झ", "¥": "ञ", "V": "ट", "B": "ठ", "M": "ड", "<": "ढ",
    ".k": "ण", "r": "त", "Fk": "थ", "n": "द", "/k": "ध", "u": "न", "i": "प",
    "Q": "फ", "c": "ब", "Hk": "भ", "e": "म", ";": "य", "j": "र", "y": "ल",
    "o": "व", "'k": "श", '"k': "ष", "l": "स", "g": "ह", "{k": "क्ष", "=": "त्र",
    "K": "ज्ञ", "Ø": "क्र", "ª": "ज्र", "ç": "प्र", "æ": "द्र",
    "z": "्र", "èk": "ध", "è": "ध्", "ä": "क्त", "|": "द्य", ":": "रू", "]": ",", "@": "/",
    "¼": "(", "½": ")", ")": "द्ध",
    # half consonants
    "D": "क्", "[": "ख्", "X": "ग्", "?": "घ्", "P": "च्", "T": "ज्", "R": "त्",
    "F": "थ्", "/": "ध्", "U": "न्", "I": "प्", "¶": "फ्", "C": "ब्", "H": "भ्",
    "E": "म्", "¸": "य्", "Y": "ल्", "O": "व्", "'": "श्", '"': "ष्", "L": "स्",
    "{": "क्ष्", ".": "ण्",
    # nukta, danda, hyphen, quotes
    "+": "़", "A": "।", "&": "-", "‘": "‘", "’": "’", "“": "“", "”": "”",
}
REPH = ""          # "Z": r-with-halant written *after* the syllable
_KEYS = sorted(MAP, key=len, reverse=True)
_TOKEN = re.compile("|".join(re.escape(k) for k in _KEYS) + "|Z|.", re.S)

_CONS = "कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह"
_MATRA = "ािीुूृेैोौंँः"
_CLUSTER = re.compile(rf"[{_CONS}]़?(?:्[{_CONS}]़?)*")

OVERRIDES: dict[str, str] = {}


def to_unicode(word: str) -> str:
    if word in OVERRIDES:
        return OVERRIDES[word]
    out = _TOKEN.sub(lambda m: REPH if m.group(0) == "Z" else MAP.get(m.group(0), m.group(0)), word)
    # a half form that ends a word/precedes a matra is really a full consonant's
    # stem; Kruti never needs this, but a trailing halant from "~" is kept as-is.
    # 1) "ि" is typed before the consonant cluster it belongs after.
    out = _move_i_matra(out)
    # 2) reph is typed after the syllable but written before its consonant cluster.
    out = _place_reph(out)
    return out


def _move_i_matra(s: str) -> str:
    i = 0
    while i < len(s):
        if s[i] == "ि":
            m = _CLUSTER.match(s, i + 1)
            if m:
                s = s[:i] + s[i + 1:m.end()] + "ि" + s[m.end():]
                i = m.end()
                continue
        i += 1
    return s


def _cluster_start(s: str, k: int) -> int:
    """Index where the consonant cluster ending just before s[k] begins."""
    i = k
    while i > 0:
        j = i - 1 if s[i - 1] == "़" else i      # nukta belongs to its consonant
        if j == 0 or s[j - 1] not in _CONS:
            break
        i = j - 1
        if i > 0 and s[i - 1] == "्":           # joined to an earlier consonant
            i -= 1
        else:
            break
    return i


def _place_reph(s: str) -> str:
    while REPH in s:
        j = s.index(REPH)
        k = j
        while k > 0 and s[k - 1] in _MATRA:          # Z follows the matras
            k -= 1
        start = _cluster_start(s, k)
        s = s[:start] + "र्" + s[start:j] + s[j + 1:]
    return s


def convert_text(text: str) -> str:
    return " ".join(to_unicode(w) for w in text.split())


# Hindi paper titles as printed, proofread against the rendered PDFs. The B.A. (Prog)
# sheets carry some titles as Unicode with a broken character map ("आधुशनक", "िाशिंत्य"),
# which no converter can repair, so every garbled title is snapped to its printed form.
KNOWN_TITLES = """
अनुवाद : व्यवहार और सिद्धांत
अनुवाद-कौशल
अस्मितामूलक विमर्श और हिंदी साहित्य
आधुनिक भारतीय भाषा संचार
कम्प्यूटर और हिंदी
कम्प्यूटर और हिंदी भाषा
कार्यालयी हिंदी
कोश विज्ञान : शब्दकोश और विश्वकोश
जनपदीय साहित्य
जनमाध्यमों की सैद्धांतिकी
जनसंचार माध्यम
पाश्चात्य काव्यशास्त्र
प्रयोजनमूलक हिंदी
फोटो पत्रकारिता
भारतीय एवं पाश्चात्य रंगमंच सिद्धांत
भारतीय साहित्य की संक्षिप्त रूपरेखा
भाषा शिक्षण
मनोरंजन-उद्योग और हिंदी
माध्यम कानून और आचार संहिता
मीडिया लेखन और समाचार-पत्र निर्माण
मीडिया शोध
मुद्रित माध्यमों की पृष्ठ-सज्जा
रचनात्मक लेखन
रेडियो
रेडियो कार्यक्रम और निर्माण
लोकप्रिय साहित्य
विज्ञापन और हिंदी भाषा
विज्ञापन, बाजार और हिंदी
संपादन
संस्कृति, साहित्य और मीडिया
सोशल मीडिया
हाशिए का समाज, अस्मिता विमर्श और हिन्दी मीडिया
हिंदी कविता (आदिकाल एवं भक्तिकालीन काव्य)
हिंदी कविता (आधुनिक काल छायावाद तक)
हिंदी कहानी
हिंदी का मौखिक साहित्य और उसकी परम्परा
हिंदी की मौखिक और लोकसाहित्य परंपरा
हिंदी के विविध रूप
हिंदी गद्य उद्भव और विकास (हिंदी-क)
हिंदी गद्य उद्भव और विकास (हिंदी-ख)
हिंदी गद्य उद्भव और विकास (हिंदी-ग)
हिंदी नाटक/एकांकी
हिंदी पत्रकारिता एवम् जनसंचार
हिंदी भाषा और उसकी लिपि का इतिहास
हिंदी भाषा और साहित्य का इतिहास
हिंदी भाषा का व्यावहारिक व्याकरण
हिंदी रंगमंच
हिंदी साहित्य का इतिहास (आधुनिक काल)
हिंदी सिनेमा और उसका अध्ययन
हिन्दी पत्रकारिता का इतिहास
हिन्दी भाषा अनुप्रयोग के क्षेत्र
""".split("\n")
KNOWN_TITLES = [t for t in KNOWN_TITLES if t]
_DEV = re.compile(r"[\u0900-\u097F]")
# "आधुशनक भारतीय भाषा : भाषा और िाशिंत्य - ख" -> the three Hindi MIL papers -क / -ख / -ग
_MIL = re.compile(r"^आधुशनक भारतीय भाषा : भाषा और िाशिंत्य\s*-\s*(\S)$")


def fix_hindi(text: str) -> str:
    """Tidy brackets/commas and snap a garbled Devanagari title to its printed form."""
    t = re.sub(r"\(\s+", "(", text)
    t = re.sub(r"\s+([),])", r"\1", t)
    if not _DEV.search(t) or " For the students" in t or t in KNOWN_TITLES:
        return t
    m = _MIL.match(t)
    if m:
        return f"आधुनिक भारतीय भाषा : भाषा और साहित्य - {m.group(1)}"
    from difflib import SequenceMatcher
    best = max(KNOWN_TITLES, key=lambda k: SequenceMatcher(None, t, k).ratio())
    return best if SequenceMatcher(None, t, best).ratio() >= 0.72 else t
