import urllib.request
import re
import json
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_FOLDER_ID = "1Q-cmslNO62V830ez_8QPJ_zTQD94C2d1"
OUTPUT_CSV_DESKTOP = "/Users/sayam/Desktop/du-subjectwise-pyq-vault.csv"
OUTPUT_CSV_ROOT = "du-subjectwise-pyq-vault.csv"
OUTPUT_CSV_SRC = "src/data/du-subjectwise-pyq-vault.csv"
OUTPUT_JSON_SRC = "src/data/du-subjectwise-pyq-vault.json"

ROMAN_TO_NUM = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8
}

def fetch_folder_items(folder_id, retries=3):
    url = f"https://drive.google.com/drive/folders/{folder_id}?usp=sharing"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
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
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed to fetch folder {folder_id}: {e}", file=sys.stderr, flush=True)
            time.sleep(1)
    return []

def download_drive_file(file_id, retries=2):
    url = f"https://drive.google.com/uc?id={file_id}&export=download"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception:
            time.sleep(0.5)
    return None

def parse_semester_from_string(text):
    if not text:
        return None
    # match single semester
    m = re.search(r"\bsem(?:ester)?\s*[-:_]*\s*([0-8ivx]+)\b", str(text), re.IGNORECASE)
    if m:
        token = m.group(1).upper()
        if token in ROMAN_TO_NUM:
            return ROMAN_TO_NUM[token]
    m2 = re.search(r"\b(VIII|VII|VI|IV|V|III|II|I|[1-8])\b", str(text), re.IGNORECASE)
    if m2:
        token = m2.group(1).upper()
        if token in ROMAN_TO_NUM:
            return ROMAN_TO_NUM[token]
    return None

def determine_course(upc_num, split_rec, off_rec, subj_name):
    if split_rec and split_rec.get("programme_family"):
        fam = split_rec["programme_family"]
        if fam == "Common Programme Group":
            return "B.Com. / B.A. (Common)"
        return fam
    
    if off_rec and off_rec.get("officialProgramme"):
        prog = off_rec["officialProgramme"]
        if "Commerce" in prog or "B.Com. (Hons" in prog:
            return "B.Com. (Hons.)"
        elif "B.Com" in prog:
            return "B.Com. Programme"
        elif "Ability" in prog or "Generic" in prog:
            return "B.Com. / B.A. (Common)"
        elif "B.A. (Prog" in prog:
            return "B.A. Programme"

    # UPC based mapping
    upc_str = str(upc_num)
    if upc_str.startswith("241208") or upc_str.startswith("241308") or upc_str.startswith("22411"):
        return "B.Com. (Hons.)"
    elif upc_str.startswith("241209") or upc_str.startswith("241309") or upc_str.startswith("52411") or upc_str.startswith("52417"):
        return "B.Com. Programme"
    elif upc_str.startswith("241225") or upc_str.startswith("241325") or upc_str.startswith("241220"):
        return "B.A. Programme"
    elif upc_str.startswith("241600") or upc_str.startswith("22415") or upc_str.startswith("12275"):
        return "B.Com. / B.A. (Common)"
    elif upc_str.startswith("292400"):
        return "B.A. (V.S.) Small & Medium Enterprise"
    elif upc_str.startswith("62413") or upc_str.startswith("62415"):
        return "B.Com. Programme"
    elif upc_str.startswith("52051"):
        return "B.Com. / B.A. (Common)"
    return "B.Com. Programme"

def main():
    print(f"🚀 Starting crawl of Google Drive Root: {ROOT_FOLDER_ID}", flush=True)
    root_items = fetch_folder_items(ROOT_FOLDER_ID)
    
    # 1. Breadth-first crawl of all folders and PDFs
    to_visit = [(it["id"], it["name"], [it["name"]]) for it in root_items if it["isFolder"]]
    all_pdf_files = [] # list of (item, path_list)
    
    while to_visit:
        next_visit = []
        with ThreadPoolExecutor(max_workers=16) as executor:
            future_to_info = {
                executor.submit(fetch_folder_items, f_id): (f_name, path)
                for (f_id, f_name, path) in to_visit
            }
            for future in as_completed(future_to_info):
                f_name, path = future_to_info[future]
                items = future.result()
                for it in items:
                    it_path = path + [it["name"]]
                    if it["isFolder"]:
                        next_visit.append((it["id"], it["name"], it_path))
                    elif it["name"].lower().endswith(".pdf"):
                        all_pdf_files.append((it, it_path))
        to_visit = next_visit

    print(f"Discovered {len(all_pdf_files)} PDF files in Google Drive.", flush=True)

    # Load official reference metadata
    off_map_path = "src/data/archive-official-map.json"
    upc_to_off = {}
    if os.path.exists(off_map_path):
        with open(off_map_path, "r", encoding="utf-8") as f:
            off_data = json.load(f)
            for e in off_data:
                u = e.get("upc")
                if u and u not in upc_to_off:
                    upc_to_off[u] = e

    # Load split_index metadata
    upc_to_split = {}
    split_index_path = "src/data/du-bcom-exam-vault.json"
    if os.path.exists(split_index_path):
        with open(split_index_path, "r", encoding="utf-8") as f:
            bcom_rows = json.load(f)
            for r in bcom_rows:
                m_u = re.search(r"UPC:\s*([0-9a-zA-Z_]+)", r.get("note", ""))
                if m_u:
                    upc_clean = re.sub(r"[^0-9]", "", m_u.group(1))
                    if upc_clean:
                        upc_to_split[upc_clean] = r

    # Process all PDFs
    catalog_rows = []
    seen_file_ids = set()

    for pdf_item, path_list in all_pdf_files:
        file_id = pdf_item["id"]
        if file_id in seen_file_ids:
            continue
        seen_file_ids.add(file_id)

        filename = pdf_item["name"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"
        
        # Path segments e.g. ["2025", "Corporate Governance", "file.pdf"]
        top_year_folder = path_list[0].rstrip(".") if path_list else "2024-2025"
        subj_folder_name = path_list[-2] if len(path_list) > 1 else ""

        # Extract UPC and QP from filename
        m_upc = re.search(r"UPC-([0-9a-zA-Z_]+?)(?:__|\.pdf|$)", filename, re.I)
        raw_upc = m_upc.group(1) if m_upc else ""
        clean_upc = re.sub(r"[^0-9]", "", raw_upc)

        m_qp = re.search(r"QP-([0-9a-zA-Z_]+?)(?:__|\.pdf|$)", filename, re.I)
        qp_no = m_qp.group(1) if m_qp else ""

        # Extract semester from filename e.g. "Sem-VI", "Sem-II_IV_VI", "Sem-I_III_V", "Sem-VII"
        m_sem = re.search(r"Sem-([0-9IVXivx_]+?)(?:__|\.pdf|$)", filename, re.I)
        sem_raw = m_sem.group(1).strip("_") if m_sem else ""
        
        # Parse tokens
        sem_tokens = [t.upper() for t in re.split(r"[_\-/]+", sem_raw) if t]
        sem_nums = [ROMAN_TO_NUM.get(t, int(t) if t.isdigit() else None) for t in sem_tokens]
        sem_nums = [n for n in sem_nums if n is not None]

        if len(sem_nums) == 1:
            sem_str = str(sem_nums[0])
            sem_group = f"Semester {sem_nums[0]}"
        elif len(sem_nums) > 1:
            sem_str = str(sem_nums[0])
            sem_group = "Semester " + ", ".join(str(n) for n in sem_nums)
        else:
            sem_str = ""
            sem_group = "Full Archive"

        # Subject name
        if subj_folder_name:
            subject_name = subj_folder_name.strip()
        else:
            # clean from filename
            name_part = filename.split("__")[0]
            subject_name = name_part.replace("_", " ").title()

        # Lookup references
        split_rec = upc_to_split.get(clean_upc)
        off_rec = upc_to_off.get(clean_upc)

        # Course determination
        course = determine_course(clean_upc, split_rec, off_rec, subject_name)

        # Year Range
        if top_year_folder == "2023":
            year_range = "2023-2024"
        elif top_year_folder == "2025":
            year_range = "2024-2025"
        else:
            year_range = top_year_folder

        # Note compilation
        note_parts = []
        if raw_upc:
            note_parts.append(f"UPC: {raw_upc}")
        if qp_no and qp_no != "NA":
            note_parts.append(f"QP: {qp_no}")
        if off_rec and off_rec.get("paperType"):
            note_parts.append(f"Type: {off_rec['paperType']}")
        elif "OC" in raw_upc:
            note_parts.append("Scheme: Old Course (OC)")
        
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

    # Sort rows by course, semester, subject, year
    catalog_rows.sort(key=lambda r: (r["course"], int(r["semester"]) if r["semester"].isdigit() else 99, r["subject"], r["yearrange"]))

    # Write files
    os.makedirs(os.path.dirname(OUTPUT_CSV_SRC), exist_ok=True)
    fieldnames = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"]
    
    # 1. Desktop CSV
    with open(OUTPUT_CSV_DESKTOP, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Successfully wrote {len(catalog_rows)} rows to Desktop CSV: {OUTPUT_CSV_DESKTOP}", flush=True)

    # 2. Root CSV
    with open(OUTPUT_CSV_ROOT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Successfully wrote {len(catalog_rows)} rows to Root CSV: {OUTPUT_CSV_ROOT}", flush=True)

    # 3. src/data CSV
    with open(OUTPUT_CSV_SRC, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Successfully wrote {len(catalog_rows)} rows to Src CSV: {OUTPUT_CSV_SRC}", flush=True)

    # 4. JSON
    with open(OUTPUT_JSON_SRC, "w", encoding="utf-8") as f:
        json.dump(catalog_rows, f, indent=2)
    print(f"✅ Successfully wrote JSON catalog: {OUTPUT_JSON_SRC}", flush=True)

    # Print summary breakdown
    courses = set(r["course"] for r in catalog_rows)
    print(f"\n--- Catalog Summary ({len(catalog_rows)} papers across {len(courses)} course categories) ---", flush=True)
    for c in sorted(courses):
        sub_rows = [r for r in catalog_rows if r["course"] == c]
        sems = sorted(set(r["semestergroup"] for r in sub_rows))
        print(f"\n📚 {c} ({len(sub_rows)} papers):")
        for s in sems:
            sem_count = sum(1 for r in sub_rows if r["semestergroup"] == s)
            print(f"   • {s}: {sem_count} papers")

if __name__ == "__main__":
    main()
