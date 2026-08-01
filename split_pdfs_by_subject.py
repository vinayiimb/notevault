#!/usr/bin/env python3
"""
Split source PDFs into individual subject PDFs using metadata.jsonl page ranges.
Output: OrganizedQPs/<Subject>/<SubjectName_Course_Semester_Year>.pdf
"""
import json
import os
import re
import subprocess
from pathlib import Path

METADATA_FILE = "/Users/sayam/Projects/notevault/metadata.jsonl"
PDF_SOURCE_DIR = "/Users/sayam/Desktop/Kalindi-QP-Archive"
OUTPUT_DIR = "/Users/sayam/Desktop/Kalindi-QP-Archive/OrganizedQPs"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def sanitize_filename(s):
    """Remove/replace invalid filename characters."""
    if not s:
        return "Unknown"
    # Replace all problematic characters
    s = re.sub(r'[/\\:*?"<>|&;]', '_', s)
    s = re.sub(r'[\s\t\n]+', '_', s)
    s = re.sub(r'_+', '_', s)
    s = s.strip('_')  # Remove leading/trailing underscores
    return s[:100] if s else "Unknown"  # Cap at 100 chars

def extract_pages(source_pdf, page_start, page_end, output_pdf):
    """Extract pages from source PDF using pdfseparate + pdfunite."""
    try:
        temp_dir = f"/tmp/qp_extract_{os.getpid()}"
        os.makedirs(temp_dir, exist_ok=True)

        # Extract all pages in range to temp files
        temp_pattern = os.path.join(temp_dir, "page-%d.pdf")
        cmd = ["pdfseparate", f"-f", str(page_start), f"-l", str(page_end), source_pdf, temp_pattern]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            print(f"  ✗ pdfseparate failed: {result.stderr}")
            return False

        # Get extracted pages (pdfseparate names them page-1.pdf, page-2.pdf, etc.)
        extracted = sorted([os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.startswith("page-") and f.endswith(".pdf")])
        if not extracted:
            print(f"  ✗ No pages extracted")
            return False

        # Merge into single output PDF
        cmd = ["pdfunite"] + extracted + [output_pdf]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        if result.returncode == 0:
            return True
        else:
            print(f"  ✗ pdfunite failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    papers_read = 0
    papers_extracted = 0
    errors = []

    print(f"Reading {METADATA_FILE}...")
    with open(METADATA_FILE) as f:
        papers = [json.loads(line) for line in f if line.strip()]

    print(f"Found {len(papers)} papers. Starting extraction...\n")

    for i, paper in enumerate(papers, 1):
        papers_read += 1

        # Extract metadata
        source_file = paper.get("source_file")
        subject = sanitize_filename(paper.get("subject") or "Unknown")
        course = sanitize_filename(paper.get("course") or "Unknown")
        semester = paper.get("semester") or "Unknown"
        year = paper.get("year_tab") or "Unknown"
        page_start = paper.get("page_start")
        page_end = paper.get("page_end")
        source_url = paper.get("source_url", "")

        # Build filename
        filename = f"{subject}_{course}_{semester}_{year}.pdf"

        # Create subject subfolder
        subject_dir = os.path.join(OUTPUT_DIR, subject)
        os.makedirs(subject_dir, exist_ok=True)
        output_pdf = os.path.join(subject_dir, filename)

        # Find source PDF in Desktop archive
        # The archive filenames have been cleaned (hash prefix removed), so search for the basename
        source_pdf = None
        if source_file:
            import glob
            # Strip hash prefix if present (format: 12345678__original.pdf -> original.pdf)
            cleaned_filename = re.sub(r'^[a-f0-9]{8}__', '', source_file)
            # Search in year folder and all subfolders
            search_pattern = os.path.join(PDF_SOURCE_DIR, year, "**", cleaned_filename)
            matches = glob.glob(search_pattern, recursive=True)
            if matches:
                source_pdf = matches[0]
            else:
                # Fallback: try original filename too
                search_pattern = os.path.join(PDF_SOURCE_DIR, year, "**", source_file)
                matches = glob.glob(search_pattern, recursive=True)
                if matches:
                    source_pdf = matches[0]

        if not source_pdf or not os.path.exists(source_pdf):
            errors.append(f"[{i}/{len(papers)}] {filename} - source PDF not found ({source_file})")
            continue

        # Extract pages
        print(f"[{i}/{len(papers)}] {filename[:80]:<80} ", end="", flush=True)
        if extract_pages(source_pdf, page_start, page_end, output_pdf):
            size = os.path.getsize(output_pdf) / 1024
            print(f"✓ ({size:.0f}KB)")
            papers_extracted += 1
        else:
            print(f"✗")
            errors.append(f"Failed to extract: {filename}")

    print(f"\n{'='*100}")
    print(f"✓ Successfully extracted: {papers_extracted}/{papers_read} papers")
    print(f"Output directory: {OUTPUT_DIR}")
    if errors:
        print(f"\n⚠ {len(errors)} errors:")
        for err in errors[:20]:
            print(f"  {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors)-20} more")

if __name__ == "__main__":
    main()
