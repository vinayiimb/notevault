import urllib.request
import re
import json
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_FOLDER_ID = "1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi"
OUTPUT_CSV = "src/data/du-master-exam-vault.csv"
OUTPUT_JSON = "src/data/du-master-exam-vault.json"

ROMAN_TO_NUM = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8
}

PROGRAM_NAMES = {
    "ba-hons-economics": "B.A. (Hons.) Economics",
    "ba-hons-history": "B.A. (Hons.) History",
    "ba-multidisciplinary-history": "B.A. Multidisciplinary History",
    "ba-programme-business-economics": "B.A. Programme Business Economics",
    "ba-programme-economics": "B.A. Programme Economics",
    "ba-programme-history": "B.A. Programme History",
    "bsc-hons-zoology": "B.Sc. (Hons.) Zoology",
    "bsc-hons-zoology-and-life-science": "B.Sc. (Hons.) Zoology / B.Sc. Life Science"
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
                print(f"Failed to fetch folder {folder_id}: {e}", file=sys.stderr)
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

def clean_subject_name(raw_name):
    # e.g. "dsc-1__history-of-india-from-the-beginning-to-fourth-century-bce"
    # or "core__development-economics-ii"
    name = raw_name
    if "__" in name:
        name = name.split("__", 1)[1]
    name = name.replace("-", " ").replace("_", " ")
    name = re.sub(r"\s+", " ", name).strip()
    return name.title()

def main():
    print(f"🚀 Starting crawl of Google Drive Root: {ROOT_FOLDER_ID}")
    
    root_items = fetch_folder_items(ROOT_FOLDER_ID)
    program_folders = [item for item in root_items if item["isFolder"]]
    print(f"Found {len(program_folders)} program folders.")

    # 1. Fetch all subject folders in parallel for each program
    # map (prog_name, prog_folder_id) -> list of subject items
    subject_tasks = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_folder_items, prog["id"]): prog
            for prog in program_folders
        }
        for future in as_completed(futures):
            prog = futures[future]
            items = future.result()
            subject_tasks[prog["name"]] = (prog, items)
            print(f"  Program '{prog['name']}': {len(items)} items")

    # 2. For each subject folder, fetch its items (year folders, subject.json, or direct pdfs)
    # We will submit all subject folder fetch tasks
    all_subject_folders = [] # (prog_name, prog_display_name, subj_folder_item)
    for prog_slug, (prog_item, items) in subject_tasks.items():
        prog_display = PROGRAM_NAMES.get(prog_slug, prog_slug.replace("-", " ").title())
        for item in items:
            if item["isFolder"]:
                all_subject_folders.append((prog_slug, prog_display, item))

    print(f"Total subject folders across all programs: {len(all_subject_folders)}")
    print("Fetching contents of all subject folders...")

    subject_folder_results = [] # (prog_slug, prog_display, subj_item, items)
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {
            executor.submit(fetch_folder_items, subj[2]["id"]): subj
            for subj in all_subject_folders
        }
        for future in as_completed(futures):
            subj_info = futures[future]
            items = future.result()
            subject_folder_results.append((subj_info[0], subj_info[1], subj_info[2], items))

    # 3. For each year folder inside subject folders, fetch the leaf PDFs
    leaf_year_folders = [] # (prog_slug, prog_display, subj_item, year_item, subject_json_data)
    subject_json_map = {} # subj_item['id'] -> subject_json_data
    direct_pdfs = [] # (prog_slug, prog_display, subj_item, year_name, pdf_item)

    # First, let's download any subject.json files if available
    subject_json_fetch_tasks = []
    for prog_slug, prog_display, subj_item, items in subject_folder_results:
        s_json_item = next((it for it in items if it["name"] == "subject.json"), None)
        if s_json_item:
            subject_json_fetch_tasks.append((subj_item["id"], s_json_item["id"]))

    print(f"Found {len(subject_json_fetch_tasks)} subject.json files. Downloading in parallel...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {
            executor.submit(download_drive_file, task[1]): task[0]
            for task in subject_json_fetch_tasks
        }
        for future in as_completed(futures):
            subj_id = futures[future]
            content = future.result()
            if content:
                try:
                    subject_json_map[subj_id] = json.loads(content)
                except Exception:
                    pass

    print(f"Successfully loaded {len(subject_json_map)} subject.json records.")

    # Now collect all year folders or direct PDFs
    for prog_slug, prog_display, subj_item, items in subject_folder_results:
        s_data = subject_json_map.get(subj_item["id"])
        for item in items:
            if item["isFolder"]:
                leaf_year_folders.append((prog_slug, prog_display, subj_item, item, s_data))
            elif item["name"].lower().endswith(".pdf"):
                direct_pdfs.append((prog_slug, prog_display, subj_item, "2024-2025", item, s_data))

    print(f"Found {len(leaf_year_folders)} year folders to fetch leaf PDFs from.")
    print(f"Found {len(direct_pdfs)} direct PDFs already.")

    leaf_pdf_results = []
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {
            executor.submit(fetch_folder_items, y[3]["id"]): y
            for y in leaf_year_folders
        }
        for future in as_completed(futures):
            y_info = futures[future]
            items = future.result()
            for it in items:
                if it["name"].lower().endswith(".pdf"):
                    leaf_pdf_results.append((
                        y_info[0], # prog_slug
                        y_info[1], # prog_display
                        y_info[2], # subj_item
                        y_info[3]["name"], # year_name e.g. "2024" or "2025"
                        it, # pdf_item (id, name)
                        y_info[4] # subject_json_data
                    ))

    all_pdf_records = leaf_pdf_results + direct_pdfs
    print(f"Total PDFs found across the entire Drive: {len(all_pdf_records)}")

    # 4. Process each PDF into catalog row format
    catalog_rows = []
    seen_file_ids = set()

    for prog_slug, prog_display, subj_item, year_folder_name, pdf_item, s_data in all_pdf_records:
        file_id = pdf_item["id"]
        if file_id in seen_file_ids:
            continue
        seen_file_ids.add(file_id)

        filename = pdf_item["name"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"

        # Match with paper in subject.json if available
        matched_paper = None
        if s_data and "papers" in s_data:
            for p in s_data["papers"]:
                if p.get("filename") == filename or p.get("filename", "").lower() == filename.lower():
                    matched_paper = p
                    break

        # Extract Course
        course = prog_display
        if s_data and s_data.get("programme"):
            course = s_data["programme"]
        elif matched_paper and matched_paper.get("programme"):
            course = matched_paper["programme"]

        # Extract Subject Name
        subject_name = None
        if matched_paper and matched_paper.get("canonicalArchiveTitle"):
            subject_name = matched_paper["canonicalArchiveTitle"]
        elif matched_paper and matched_paper.get("subject"):
            subject_name = matched_paper["subject"]
        elif s_data and s_data.get("subject"):
            subject_name = s_data["subject"]
        else:
            subject_name = clean_subject_name(subj_item["name"])

        # Extract Year / YearRange
        year_val = None
        if matched_paper and matched_paper.get("year"):
            year_val = str(matched_paper["year"])
        elif re.match(r"^\d{4}$", year_folder_name):
            year_val = year_folder_name
        else:
            m_yr = re.search(r"\b(201\d|202\d)\b", filename)
            if m_yr:
                year_val = m_yr.group(1)
            else:
                year_val = "2024-2025"

        # Format year range nicely (e.g. "2024" or "2023-2024")
        year_range = year_val

        # Extract Semester
        sem_num = None
        if matched_paper and matched_paper.get("semesterOnPaper"):
            sem_num = parse_semester_from_string(str(matched_paper["semesterOnPaper"]))
        if sem_num is None:
            sem_num = parse_semester_from_string(filename)
        if sem_num is None and s_data and s_data.get("semestersSeen"):
            sems = [parse_semester_from_string(str(s)) for s in s_data["semestersSeen"] if parse_semester_from_string(str(s)) is not None]
            if len(sems) == 1:
                sem_num = sems[0]

        sem_str = str(sem_num) if sem_num is not None else ""
        sem_group = f"Semester {sem_num}" if sem_num is not None else "Full Archive"

        # Extract Notes / Metadata
        note_parts = []
        if matched_paper:
            if matched_paper.get("paperUPC"):
                note_parts.append(f"UPC: {matched_paper['paperUPC']}")
            if matched_paper.get("questionPaperNumber"):
                note_parts.append(f"QP: {matched_paper['questionPaperNumber']}")
            if matched_paper.get("paperTypePrinted"):
                note_parts.append(f"Type: {matched_paper['paperTypePrinted']}")
            if matched_paper.get("scheme"):
                note_parts.append(f"Scheme: {matched_paper['scheme']}")
        else:
            # Parse from filename if possible
            m_upc = re.search(r"upc[-_](\d+)", filename, re.I)
            if m_upc:
                note_parts.append(f"UPC: {m_upc.group(1)}")
            m_qp = re.search(r"qp[-_](\d+)", filename, re.I)
            if m_qp:
                note_parts.append(f"QP: {m_qp.group(1)}")

        note_str = " | ".join(note_parts) if note_parts else "Google Drive Master Vault"

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
    catalog_rows.sort(key=lambda r: (r["course"], r["semester"] or "99", r["subject"], r["yearrange"]))

    # Write CSV
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        fieldnames = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)

    print(f"✅ Successfully wrote {len(catalog_rows)} rows to CSV: {OUTPUT_CSV}")

    # Write JSON as well
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog_rows, f, indent=2)
    print(f"✅ Successfully wrote JSON catalog: {OUTPUT_JSON}")

    # Print summary statistics
    courses = set(r["course"] for r in catalog_rows)
    print(f"\n--- Catalog Summary ({len(catalog_rows)} papers across {len(courses)} courses) ---")
    for c in sorted(courses):
        count = sum(1 for r in catalog_rows if r["course"] == c)
        print(f"  • {c}: {count} papers")

if __name__ == "__main__":
    main()
