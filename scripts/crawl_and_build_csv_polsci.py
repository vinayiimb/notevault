import urllib.request
import re
import json
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

ROOT_FOLDER_ID = "1dx-3HEQcf0DKu_wHRT_QrqLJcknfxT6m"
OUTPUT_CSV = "src/data/du-polsci-geography-vault.csv"
OUTPUT_JSON = "src/data/du-polsci-geography-vault.json"

ROMAN_TO_NUM = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8
}

PROGRAM_NAME_MAP = {
    "b.a. (hons.) political science": "B.A. (Hons.) Political Science",
    "b.a. (programme) political science": "B.A. (Programme) Political Science",
    "common programme group": "Common Programme Group",
    "geography": "B.A. (Hons.) Geography",
    "other political science courses": "Political Science (General / Concurrent)",
    "ba-hons-political-science": "B.A. (Hons.) Political Science",
    "ba-programme-political-science": "B.A. (Programme) Political Science",
}

def fetch_folder_items(folder_id, retries=3):
    url = f"https://drive.google.com/drive/folders/{folder_id}?usp=sharing"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
                m = re.search(r"window\['_DRIVE_ivd'\]\s*=\s*'([^']*)'", html)
                if not m:
                    return []
                raw = m.group(1).encode().decode("unicode_escape")
                data = json.loads(raw)
                if not data or not data[0]:
                    return []
                items = []
                for item in data[0]:
                    item_id = item[0]
                    item_name = item[2]
                    item_mime = item[3] if len(item) > 3 else ""
                    items.append({
                        "id": item_id,
                        "name": item_name,
                        "mimeType": item_mime,
                        "isFolder": item_mime == "application/vnd.google-apps.folder"
                    })
                return items
        except Exception:
            time.sleep(1)
    return []

def parse_semester_from_string(text):
    if not text:
        return None
    m = re.search(r"\bsem(?:ester)?\s*[-:_]*\s*([0-8ivx]+)\b", text, re.IGNORECASE)
    if m:
        token = m.group(1).upper()
        if token in ROMAN_TO_NUM:
            return ROMAN_TO_NUM[token]
    m2 = re.search(r"\b(VIII|VII|VI|IV|V|III|II|I|[1-8])\b", text, re.IGNORECASE)
    if m2:
        token = m2.group(1).upper()
        if token in ROMAN_TO_NUM:
            return ROMAN_TO_NUM[token]
    return None

def parse_filename_metadata(filename, path_parts):
    base = filename[:-4] if filename.lower().endswith(".pdf") else filename
    
    # 1. Political Science format: 'YYYY - Subject Name - Semester XX - pages ...'
    m_pol = re.match(r"^(\d{4})\s*-\s*(.*?)\s*-\s*Semester\s+([IVX0-9]+)(?:\s*-\s*pages\s+[\d-]+)?$", base, re.I)
    if m_pol:
        year = m_pol.group(1)
        subj = m_pol.group(2).strip()
        sem_raw = m_pol.group(3)
        return {
            "subject": subj,
            "year": year,
            "sem_raw": sem_raw,
            "prog_suffix": None,
            "type": None
        }

    # 2. Geography format: 'NN_Subject_Name_Type_Programme_Pages_XX-YY'
    clean = re.sub(r"^\d+[\s_]+", "", base)
    clean = re.sub(r"[\s_]+(?:Pages?|pages?)[\s_]+[\d-]+$", "", clean, flags=re.I)
    
    paper_num = None
    m_p = re.search(r"[\s_]+Paper[\s_]+(\d+)", clean, re.I)
    if m_p:
        paper_num = m_p.group(1)
        clean = re.sub(r"[\s_]+Paper[\s_]+\d+", "", clean, flags=re.I)
        
    prog_suffix = None
    if re.search(r"[\s_]+BA[\s_]+Hons", clean, re.I):
        prog_suffix = "B.A. (Hons.) Geography"
        clean = re.sub(r"[\s_]+BA[\s_]+Hons", "", clean, flags=re.I)
    elif re.search(r"[\s_]+BA[\s_]+Programme", clean, re.I):
        prog_suffix = "B.A. (Programme) Geography"
        clean = re.sub(r"[\s_]+BA[\s_]+Programme", "", clean, flags=re.I)
    elif re.search(r"[\s_]+BA[\s_]+Geography", clean, re.I):
        clean = re.sub(r"[\s_]+BA[\s_]+Geography", "", clean, flags=re.I)
        
    p_type = None
    m_t = re.search(r"[\s_]+(DSC\d*|DSE\d*|Core|NEP[\s_]+UGCF|UGCF)\b", clean, re.I)
    if m_t:
        p_type = m_t.group(1).replace("_", " ").upper()
        clean = re.sub(r"[\s_]+(DSC\d*|DSE\d*|Core|NEP[\s_]+UGCF|UGCF)\b", "", clean, flags=re.I)

    # Clean up any trailing semester tokens in the subject
    clean = re.sub(r"[\s_]+Semester[\s_]+\d+", "", clean, flags=re.I)
        
    clean_subj = clean.replace("_", " ").replace("-", " ")
    clean_subj = re.sub(r"\s+", " ", clean_subj).strip()
    
    if paper_num:
        clean_subj = f"{clean_subj} (Paper {paper_num})"
        
    return {
        "subject": clean_subj,
        "year": None,
        "sem_raw": None,
        "prog_suffix": prog_suffix,
        "type": p_type
    }

def determine_course(path_parts, meta):
    if meta.get("prog_suffix"):
        return meta["prog_suffix"]
    if path_parts:
        top = path_parts[0].lower().strip()
        if top in PROGRAM_NAME_MAP:
            return PROGRAM_NAME_MAP[top]
        for key, val in PROGRAM_NAME_MAP.items():
            if key in top:
                return val
        return path_parts[0]
    return "B.A. (Hons.) Political Science"

def main():
    print(f"🚀 Starting crawl of Google Drive Root: {ROOT_FOLDER_ID}", flush=True)

    visited_folders = set([ROOT_FOLDER_ID])
    all_files = []
    lock = threading.Lock()

    current_folders = [("root", ROOT_FOLDER_ID, [])]
    level = 0

    while current_folders:
        level += 1
        print(f"Level {level}: processing {len(current_folders)} folders...", flush=True)
        next_folders = []
        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_folder = {
                executor.submit(fetch_folder_items, f[1]): f
                for f in current_folders
            }
            for future in as_completed(future_to_folder):
                parent_name, parent_id, path_parts = future_to_folder[future]
                items = future.result()
                for it in items:
                    if it["isFolder"]:
                        with lock:
                            if it["id"] not in visited_folders:
                                visited_folders.add(it["id"])
                                next_folders.append((it["name"], it["id"], path_parts + [it["name"]]))
                    else:
                        with lock:
                            all_files.append({
                                "path_parts": path_parts,
                                "path": " / ".join(path_parts + [it["name"]]),
                                "name": it["name"],
                                "id": it["id"],
                                "mimeType": it["mimeType"]
                            })
        current_folders = next_folders

    pdfs = [f for f in all_files if f["name"].lower().endswith(".pdf")]
    print(f"Total PDFs found: {len(pdfs)}", flush=True)

    catalog_rows = []
    seen_file_ids = set()

    for pdf in pdfs:
        file_id = pdf["id"]
        if file_id in seen_file_ids:
            continue
        seen_file_ids.add(file_id)

        filename = pdf["name"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"
        path_parts = pdf["path_parts"]

        meta = parse_filename_metadata(filename, path_parts)
        course = determine_course(path_parts, meta)
        subject_name = meta["subject"]

        # Determine year
        year_val = meta.get("year")
        if not year_val:
            for p in reversed(path_parts):
                if re.match(r"^\d{4}$", p):
                    year_val = p
                    break
        if not year_val:
            m_yr = re.search(r"\b(201\d|202\d)\b", filename)
            if m_yr:
                year_val = m_yr.group(1)
            else:
                year_val = "2024-2025"

        year_range = year_val

        # Determine semester
        sem_num = None
        if meta.get("sem_raw"):
            sem_num = parse_semester_from_string(meta["sem_raw"])
        if sem_num is None:
            sem_num = parse_semester_from_string(filename)
        if sem_num is None:
            for p in path_parts:
                s_guess = parse_semester_from_string(p)
                if s_guess is not None:
                    sem_num = s_guess
                    break

        sem_str = str(sem_num) if sem_num is not None else ""
        sem_group = f"Semester {sem_num}" if sem_num is not None else "Full Archive"

        note_parts = []
        if meta.get("type"):
            note_parts.append(f"Type: {meta['type']}")
        m_pages = re.search(r"(?:Pages?|pages?)\s*([\d-]+)", filename)
        if m_pages:
            note_parts.append(f"Pages: {m_pages.group(1)}")

        note_str = " | ".join(note_parts) if note_parts else "Google Drive Archive"

        catalog_rows.append({
            "course": course,
            "subject": subject_name,
            "yearrange": year_range,
            "semestergroup": sem_group,
            "semester": sem_str,
            "fileurl": file_url,
            "filename": filename,
            "note": note_str
        })

    catalog_rows.sort(key=lambda r: (r["course"], r["semester"] or "99", r["subject"], r["yearrange"]))

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog_rows, f, indent=2)

    # Copy to root, Desktop, Downloads
    with open("du-polsci-geography-vault.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)

    with open("/Users/sayam/Desktop/du-polsci-geography-vault.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)

    with open("/Users/sayam/Downloads/du-polsci-geography-vault.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)

    print(f"✅ Successfully wrote {len(catalog_rows)} rows to {OUTPUT_CSV}", flush=True)

    courses = set(r["course"] for r in catalog_rows)
    print(f"\n--- Catalog Breakdown ({len(catalog_rows)} papers across {len(courses)} courses) ---", flush=True)
    for c in sorted(courses):
        count = sum(1 for r in catalog_rows if r["course"] == c)
        print(f"  • {c}: {count} papers", flush=True)

if __name__ == "__main__":
    main()
