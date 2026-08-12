import urllib.request
import re
import json
import csv
import os
import sys
import openpyxl
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_FOLDER_ID = "1Q-cmslNO62V830ez_8QPJ_zTQD94C2d1"

OUTPUT_CSV_DESKTOP = "/Users/sayam/Desktop/du-subjectwise-pyq-vault.csv"
OUTPUT_XLSX_DESKTOP = "/Users/sayam/Desktop/du-subjectwise-pyq-vault.xlsx"
OUTPUT_CSV_ROOT = "du-subjectwise-pyq-vault.csv"
OUTPUT_XLSX_ROOT = "du-subjectwise-pyq-vault.xlsx"
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
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
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
        except Exception:
            pass
    return []

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

def determine_course(upc_num, split_rec, off_rec, subj_name):
    if split_rec and split_rec.get("course"):
        return split_rec["course"]
    
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
    print(f"🚀 Crawling Google Drive Root: {ROOT_FOLDER_ID}", flush=True)
    root_items = fetch_folder_items(ROOT_FOLDER_ID)
    
    to_visit = [(it["id"], it["name"], [it["name"]]) for it in root_items if it["isFolder"]]
    all_pdf_files = []
    
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

    # Reference maps
    off_map_path = "src/data/archive-official-map.json"
    upc_to_off = {}
    if os.path.exists(off_map_path):
        with open(off_map_path, "r", encoding="utf-8") as f:
            for e in json.load(f):
                u = e.get("upc")
                if u and u not in upc_to_off:
                    upc_to_off[u] = e

    upc_to_split = {}
    split_index_path = "src/data/du-bcom-exam-vault.json"
    if os.path.exists(split_index_path):
        with open(split_index_path, "r", encoding="utf-8") as f:
            for r in json.load(f):
                m_u = re.search(r"UPC:\s*([0-9a-zA-Z_]+)", r.get("note", ""))
                if m_u:
                    upc_clean = re.sub(r"[^0-9]", "", m_u.group(1))
                    if upc_clean:
                        upc_to_split[upc_clean] = r

    catalog_rows = []
    seen_file_ids = set()

    for pdf_item, path_list in all_pdf_files:
        file_id = pdf_item["id"]
        if file_id in seen_file_ids:
            continue
        seen_file_ids.add(file_id)

        filename = pdf_item["name"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"
        
        top_year_folder = path_list[0].rstrip(".") if path_list else "2024-2025"
        subj_folder_name = path_list[-2] if len(path_list) > 1 else ""

        m_upc = re.search(r"UPC-([0-9a-zA-Z_]+?)(?:__|\.pdf|$)", filename, re.I)
        raw_upc = m_upc.group(1) if m_upc else ""
        clean_upc = re.sub(r"[^0-9]", "", raw_upc)

        m_qp = re.search(r"QP-([0-9a-zA-Z_]+?)(?:__|\.pdf|$)", filename, re.I)
        qp_no = m_qp.group(1) if m_qp else ""

        # Extract semester numbers
        m_sem = re.search(r"Sem-([0-9IVXivx_]+?)(?:__|\.pdf|$)", filename, re.I)
        sem_raw = m_sem.group(1).strip("_") if m_sem else ""
        sem_tokens = [t.upper() for t in re.split(r"[_\-/]+", sem_raw) if t]
        sem_nums = [ROMAN_TO_NUM.get(t, int(t) if t.isdigit() else None) for t in sem_tokens]
        sem_nums = [n for n in sem_nums if n is not None]

        # Standard Ramanujan semesterGroup format: "I,III,V" or "II,IV,VI"
        if sem_nums:
            primary_sem = sem_nums[0]
            sem_str = str(primary_sem)
            if primary_sem % 2 == 1:
                sem_group = "I,III,V" if primary_sem <= 5 else "I,III,V,VII"
            else:
                sem_group = "II,IV,VI" if primary_sem <= 6 else "II,IV,VI,VIII"
        else:
            sem_str = ""
            sem_group = "I,III,V"

        # Subject name
        if subj_folder_name:
            subject_name = subj_folder_name.strip()
        else:
            name_part = filename.split("__")[0]
            subject_name = name_part.replace("_", " ").title()

        split_rec = upc_to_split.get(clean_upc)
        off_rec = upc_to_off.get(clean_upc)

        # Course name
        course = determine_course(clean_upc, split_rec, off_rec, subject_name)

        # Year Range format e.g. "2023-2024" or "2024-2025"
        if top_year_folder == "2023":
            year_range = "2023-2024"
        elif top_year_folder == "2025":
            year_range = "2024-2025"
        elif "-" in top_year_folder:
            year_range = top_year_folder
        elif len(top_year_folder) == 4 and top_year_folder.isdigit():
            y_int = int(top_year_folder)
            year_range = f"{y_int}-{y_int+1}"
        else:
            year_range = "2024-2025"

        # Note field
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

    # Sort
    catalog_rows.sort(key=lambda r: (r["course"], int(r["semester"]) if r["semester"].isdigit() else 99, r["subject"], r["yearrange"]))

    fieldnames = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"]
    
    # 1. Desktop CSV
    with open(OUTPUT_CSV_DESKTOP, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    print(f"✅ Desktop CSV: {OUTPUT_CSV_DESKTOP}")

    # 2. Desktop XLSX
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Catalog"
    ws.append(fieldnames)
    for r in catalog_rows:
        ws.append([r[col] for col in fieldnames])
    wb.save(OUTPUT_XLSX_DESKTOP)
    print(f"✅ Desktop XLSX: {OUTPUT_XLSX_DESKTOP}")

    # 3. Root CSV & XLSX
    with open(OUTPUT_CSV_ROOT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    wb.save(OUTPUT_XLSX_ROOT)
    print(f"✅ Root CSV & XLSX: {OUTPUT_CSV_ROOT}")

    # 4. src/data CSV & JSON
    with open(OUTPUT_CSV_SRC, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in catalog_rows:
            writer.writerow(r)
    with open(OUTPUT_JSON_SRC, "w", encoding="utf-8") as f:
        json.dump(catalog_rows, f, indent=2)
    print(f"✅ Data JSON & CSV: {OUTPUT_JSON_SRC}")

if __name__ == "__main__":
    main()
