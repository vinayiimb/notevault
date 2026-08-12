import urllib.request
import re
import json
import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_FOLDER_ID = "1qwmYfCLwtGiUfOITBbbbTr-FrCPaYECw"

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

def explore_tree():
    print(f"Starting discovery of root {ROOT_FOLDER_ID}", flush=True)
    root_items = fetch_folder_items(ROOT_FOLDER_ID)
    print(f"Root items ({len(root_items)}):", [x['name'] for x in root_items], flush=True)
    
    # We will do BFS with ThreadPoolExecutor
    to_visit = [(item['id'], item['name'], [item['name']]) for item in root_items if item['isFolder']]
    all_files = [(item, [item['name']]) for item in root_items if not item['isFolder']]
    all_folders = [(item, [item['name']]) for item in root_items if item['isFolder']]
    
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
                    it_path = path + [it['name']]
                    if it['isFolder']:
                        all_folders.append((it, it_path))
                        next_visit.append((it['id'], it['name'], it_path))
                    else:
                        all_files.append((it, it_path))
        print(f"Discovered {len(all_folders)} folders and {len(all_files)} files total so far (next batch: {len(next_visit)} folders)...", flush=True)
        to_visit = next_visit

    print(f"\nFinal Totals: {len(all_folders)} folders, {len(all_files)} files.", flush=True)
    
    # Check breakdown of files
    pdf_files = [f for f in all_files if f[0]['name'].lower().endswith('.pdf')]
    json_files = [f for f in all_files if f[0]['name'].lower().endswith('.json')]
    xlsx_files = [f for f in all_files if f[0]['name'].lower().endswith('.xlsx') or f[0]['name'].lower().endswith('.csv')]
    other_files = [f for f in all_files if not f[0]['name'].lower().endswith(('.pdf', '.json', '.xlsx', '.csv'))]
    
    print(f"PDF count: {len(pdf_files)}", flush=True)
    print(f"JSON count: {len(json_files)}", flush=True)
    print(f"XLSX/CSV count: {len(xlsx_files)}", flush=True)
    print(f"Other count: {len(other_files)}", flush=True)
    
    print("\nSample JSON/XLSX files:", flush=True)
    for f in json_files + xlsx_files:
        print("  /", "/".join(f[1]), f"(ID: {f[0]['id']})", flush=True)

    print("\nSample 15 PDF paths:", flush=True)
    for f in pdf_files[:15]:
        print("  /", "/".join(f[1]), f"(ID: {f[0]['id']})", flush=True)

if __name__ == "__main__":
    explore_tree()
