import urllib.request
import re
import json
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_FOLDER_ID = "1qwmYfCLwtGiUfOITBbbbTr-FrCPaYECw"
OUTPUT_CSV_SRC = "src/data/du-bcom-exam-vault.csv"
OUTPUT_CSV_ROOT = "du-bcom-exam-vault.csv"
OUTPUT_JSON_SRC = "src/data/du-bcom-exam-vault.json"

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

def build_catalog():
    print(f"🚀 Starting crawl of Google Drive Root: {ROOT_FOLDER_ID}", flush=True)
    root_items = fetch_folder_items(ROOT_FOLDER_ID)
    
    # 1. Breadth-first crawl of all folders and PDFs
    to_visit = [(it["id"], it["name"], [it["name"]]) for it in root_items if it["isFolder"]]
    all_pdf_files = [] # list of (item, path_list)
    all_json_files = {} # name -> (item_id, path_list)
    
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
                    elif it["name"].lower().endswith(".json"):
                        all_json_files["/".join(it_path)] = it["id"]
        to_visit = next_visit

    print(f"Discovered {len(all_pdf_files)} PDF files in Google Drive.", flush=True)

    # 2. Download index.json / split_index.json
    split_index_records = []
    split_index_id = all_json_files.get("DU_BCom_Subjectwise_Split_2025_2026/split_index.json") or all_json_files.get("pyq/index.json")
    if split_index_id:
        print(f"Downloading index metadata from Drive (ID: {split_index_id})...", flush=True)
        content = download_drive_file(split_index_id)
        if content:
            split_index_records = json.loads(content)
            print(f"Loaded {len(split_index_records)} records from index.json.", flush=True)

    # Map filename or relative path to index record
    index_by_filename = {}
    index_by_upc_qp = {}
    for r in split_index_records:
        fn = r.get("suggested_filename")
        if fn:
            index_by_filename[fn.lower()] = r
        upc = str(r.get("upc", ""))
        qp = str(r.get("qp_no", ""))
        if upc and qp:
            index_by_upc_qp[f"{upc}_{qp}"] = r

    # 3. Load bcom-drive-catalog.ts if available for secondary lookup
    existing_bcom_catalog_map = {}
    bcom_ts_path = "src/data/bcom-drive-catalog.ts"
    if os.path.exists(bcom_ts_path):
        with open(bcom_ts_path, "r", encoding="utf-8") as f:
            bcom_text = f.read()
        if "export const bcomDriveCatalog" in bcom_text:
            try:
                json_part = bcom_text.split("export const bcomDriveCatalog: CatalogPaper[] =")[1].strip().rstrip(";")
                for row in json.loads(json_part):
                    m_id = re.search(r"/d/([^/]+)/view", row.get("pdfUrl", ""))
                    if m_id:
                        existing_bcom_catalog_map[m_id.group(1)] = row
            except Exception as e:
                print(f"Note: Error parsing existing bcom-drive-catalog.ts: {e}", flush=True)

    # 4. Process each PDF into standard catalog format
    catalog_rows = []
    seen_file_ids = set()

    for pdf_item, path_list in all_pdf_files:
        file_id = pdf_item["id"]
        if file_id in seen_file_ids:
            continue
        seen_file_ids.add(file_id)

        filename = pdf_item["name"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"
        top_folder = path_list[0] if path_list else ""

        # Match against split_index
        matched_rec = index_by_filename.get(filename.lower())
        if not matched_rec:
            # Try matching by UPC and QP from filename
            m_u = re.search(r"upc[-_]?(\d+)", filename, re.I)
            m_q = re.search(r"qp[-_]?([0-9a-z]+)", filename, re.I)
            if m_u and m_q:
                key = f"{m_u.group(1)}_{m_q.group(1).upper()}"
                matched_rec = index_by_upc_qp.get(key)

        ts_entry = existing_bcom_catalog_map.get(file_id)

        # 1. Course determination
        course = None
        if matched_rec:
            # e.g. "B.Com. Programme", "B.Com. (Hons.)", "B.A. Programme", "Common Programme Group"
            prog = matched_rec.get("programme_family")
            if prog == "Common Programme Group":
                course = "B.Com. / B.A. (Common)"
            elif prog:
                course = prog
        elif ts_entry and ts_entry.get("course"):
            course = ts_entry["course"]
        elif "01_BCom_Hons" in top_folder or "05_BCom_Hons" in top_folder:
            course = "B.Com. (Hons.)"
        elif "02_BCom_July" in top_folder:
            course = "B.Com. (Hons.)"
        elif "03_BCom_Mixed" in top_folder:
            course = "B.Com. Programme"
        elif "04_Mixed_Programme" in top_folder:
            course = "B.Com. / B.A. Programme"
        else:
            course = "B.Com. (Hons.)"

        # Normalize Course Names for consistency
        if course in ["B.Com.", "B.Com", "B.Com Programme"]:
            course = "B.Com. Programme"
        elif course in ["B.Com (Hons.)", "B.Com (Hons)", "B.Com. (Hons)", "B.Com (P)"]:
            course = "B.Com. (Hons.)"
        elif course in ["B.A. Program", "B.A. Programme"]:
            course = "B.A. Programme"

        # 2. Subject Name determination
        subject_name = None
        if matched_rec and matched_rec.get("canonical_subject"):
            subject_name = matched_rec["canonical_subject"].strip()
        elif ts_entry and ts_entry.get("subject"):
            subject_name = ts_entry["subject"].strip()
        else:
            # Parse from filename e.g. "01_2022_Sem-II_DSC-Core_Corporate_Accounting_UPC-22411201_QP-657.pdf"
            name_clean = filename.replace(".pdf", "")
            # Remove leading number index "01_2022_"
            name_clean = re.sub(r"^\d+_\d+_", "", name_clean)
            # Remove Sem-X
            name_clean = re.sub(r"Sem-[IVX0-9]+_", "", name_clean, flags=re.I)
            # Remove Type prefix
            name_clean = re.sub(r"^(DSC-Core|DSC|GE|DSE|Type_not_stated|AEC-Language|DSC_\d+\.\d+)_", "", name_clean, flags=re.I)
            # Remove UPC and QP
            name_clean = re.sub(r"_UPC-.*$", "", name_clean, flags=re.I)
            name_clean = name_clean.replace("_", " ").replace("-", " ")
            name_clean = re.sub(r"\s+", " ", name_clean).strip()
            subject_name = name_clean.title()

        # 3. Year / YearRange determination
        year_range = None
        if matched_rec and matched_rec.get("collection_year"):
            col_year = str(matched_rec["collection_year"])
            year_range = col_year
        elif ts_entry and ts_entry.get("yearRange"):
            year_range = ts_entry["yearRange"]
        else:
            # Extract from filename
            m_yr = re.search(r"\b(201\d|202\d)\b", filename)
            if m_yr:
                year_range = m_yr.group(1)
            else:
                year_range = "2024-2025"

        # 4. Semester & Semester Group determination
        sem_num = None
        sem_raw = None
        if matched_rec and matched_rec.get("semester"):
            sem_raw = str(matched_rec["semester"])
            sem_num = parse_semester_from_string(sem_raw)
        elif ts_entry and ts_entry.get("semester"):
            sem_num = parse_semester_from_string(str(ts_entry["semester"]))
        if sem_num is None:
            sem_num = parse_semester_from_string(filename)

        if sem_num is not None:
            sem_str = str(sem_num)
            sem_group = f"Semester {sem_num}"
        elif sem_raw and ("/" in sem_raw or "," in sem_raw):
            sem_str = ""
            sem_group = f"Semester {sem_raw}"
        else:
            sem_str = ""
            sem_group = "Full Archive"

        # 5. Note / Details determination
        note_parts = []
        if matched_rec:
            if matched_rec.get("upc"):
                note_parts.append(f"UPC: {matched_rec['upc']}")
            if matched_rec.get("qp_no"):
                note_parts.append(f"QP: {matched_rec['qp_no']}")
            if matched_rec.get("type_group"):
                note_parts.append(f"Type: {matched_rec['type_group']}")
            if matched_rec.get("course_as_printed"):
                note_parts.append(f"Printed: {matched_rec['course_as_printed']}")
            if matched_rec.get("notes"):
                note_parts.append(matched_rec["notes"])
            if matched_rec.get("completeness") and "Incomplete" in matched_rec["completeness"]:
                note_parts.append(matched_rec["completeness"])
        else:
            m_u = re.search(r"upc[-_]?(\d+)", filename, re.I)
            if m_u:
                note_parts.append(f"UPC: {m_u.group(1)}")
            m_q = re.search(r"qp[-_]?([0-9a-z]+)", filename, re.I)
            if m_q:
                note_parts.append(f"QP: {m_q.group(1)}")
            m_t = re.search(r"(DSC-Core|DSC|GE|DSE|AEC-Language)", filename, re.I)
            if m_t:
                note_parts.append(f"Type: {m_t.group(1)}")
            if "INCOMPLETE" in filename.upper():
                note_parts.append("Incomplete paper in source")

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

    # Write output files
    os.makedirs(os.path.dirname(OUTPUT_CSV_SRC), exist_ok=True)
    fieldnames = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"]
    
    # 1. Write src/data CSV
    with open(OUTPUT_CSV_SRC, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Successfully wrote {len(catalog_rows)} rows to CSV: {OUTPUT_CSV_SRC}", flush=True)

    # 2. Write Root CSV
    with open(OUTPUT_CSV_ROOT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Successfully wrote {len(catalog_rows)} rows to Root CSV: {OUTPUT_CSV_ROOT}", flush=True)

    # 3. Write JSON
    with open(OUTPUT_JSON_SRC, "w", encoding="utf-8") as f:
        json.dump(catalog_rows, f, indent=2)
    print(f"✅ Successfully wrote JSON catalog: {OUTPUT_JSON_SRC}", flush=True)

    # Print summary breakdown
    courses = set(r["course"] for r in catalog_rows)
    print(f"\n--- B.Com Catalog Summary ({len(catalog_rows)} papers across {len(courses)} course categories) ---", flush=True)
    for c in sorted(courses):
        sub_rows = [r for r in catalog_rows if r["course"] == c]
        sems = sorted(set(r["semestergroup"] for r in sub_rows))
        print(f"\n📚 {c} ({len(sub_rows)} papers):")
        for s in sems:
            sem_count = sum(1 for r in sub_rows if r["semestergroup"] == s)
            print(f"   • {s}: {sem_count} papers")

if __name__ == "__main__":
    build_catalog()
