#!/usr/bin/env python3
"""
Split source PDFs into individual subject PDFs - Version 2 with better error handling.
Output: OrganizedQPs/<Subject>/<SubjectName_Course_Semester_Year>.pdf
"""
import json
import os
import re
import subprocess
import shutil
from pathlib import Path

METADATA_FILE = "/Users/sayam/Projects/notevault/metadata.jsonl"
PDF_SOURCE_DIR = "/Users/sayam/Desktop/Kalindi-QP-Archive"
OUTPUT_DIR = "/Users/sayam/Desktop/Kalindi-QP-Archive/OrganizedQPs"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def sanitize_filename(s):
    """Aggressively sanitize filename for filesystem compatibility."""
    if not s:
        return "Unknown"
    # Replace all problematic characters with underscores
    s = re.sub(r'[/\\:*?"<>|&;()\[\]{}!@#$%^~`\'\"+=]', '_', s)
    # Replace multiple spaces/whitespace with single underscore
    s = re.sub(r'[\s\t\n]+', '_', s)
    # Collapse multiple underscores
    s = re.sub(r'_+', '_', s)
    # Remove leading/trailing underscores
    s = s.strip('_')
    # Ensure not empty
    return s[:100] if s else "Unknown"

def extract_pages(source_pdf, page_start, page_end, output_pdf):
    """Extract pages from source PDF using pdfseparate + pdfunite."""
    try:
        # Ensure output directory exists and is writable
        output_dir = os.path.dirname(output_pdf)
        os.makedirs(output_dir, exist_ok=True)

        temp_dir = f"/tmp/qp_extract_{os.getpid()}_{hash(output_pdf) % 10000}"
        os.makedirs(temp_dir, exist_ok=True)

        # Extract all pages in range to temp files
        temp_pattern = os.path.join(temp_dir, "page-%d.pdf")
        cmd = ["pdfseparate", f"-f", str(page_start), f"-l", str(page_end), source_pdf, temp_pattern]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            # Silently skip PDF extraction errors (illegal page ranges, etc)
            return False

        # Get extracted pages
        extracted = sorted([os.path.join(temp_dir, f) for f in os.listdir(temp_dir)
                           if f.startswith("page-") and f.endswith(".pdf")])
        if not extracted:
            return False

        # Merge into single output PDF
        cmd = ["pdfunite"] + extracted + [output_pdf]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

        return result.returncode == 0

    except Exception:
        return False

def main():
    papers_extracted = 0
    papers_failed = 0

    print(f"Reading metadata from {METADATA_FILE}...")
    with open(METADATA_FILE) as f:
        papers = [json.loads(line) for line in f if line.strip()]

    print(f"Processing {len(papers)} papers...\n")

    for i, paper in enumerate(papers, 1):
        # Extract metadata
        source_file = paper.get("source_file")
        subject = sanitize_filename(paper.get("subject") or "Unknown")
        course = sanitize_filename(paper.get("course") or "Unknown")
        semester = sanitize_filename(paper.get("semester") or "Unknown")
        year = paper.get("year_tab") or "Unknown"
        page_start = paper.get("page_start")
        page_end = paper.get("page_end")

        # Build filename with sanitization
        filename = f"{subject}_{course}_{semester}_{year}.pdf"
        filename = sanitize_filename(filename)  # Extra sanitization for filename

        # Create subject subfolder (also sanitized)
        subject_dir = os.path.join(OUTPUT_DIR, subject)
        os.makedirs(subject_dir, exist_ok=True)
        output_pdf = os.path.join(subject_dir, filename)

        # Find source PDF (with cleaned filename support)
        source_pdf = None
        if source_file:
            import glob
            cleaned_filename = re.sub(r'^[a-f0-9]{8}__', '', source_file)
            search_pattern = os.path.join(PDF_SOURCE_DIR, str(year), "**", cleaned_filename)
            matches = glob.glob(search_pattern, recursive=True)
            if matches:
                source_pdf = matches[0]
            else:
                search_pattern = os.path.join(PDF_SOURCE_DIR, str(year), "**", source_file)
                matches = glob.glob(search_pattern, recursive=True)
                if matches:
                    source_pdf = matches[0]

        if not source_pdf or not os.path.exists(source_pdf):
            papers_failed += 1
            if i % 500 == 0:
                print(f"[{i}/{len(papers)}] Progress: {papers_extracted} extracted, {papers_failed} failed")
            continue

        # Extract pages
        if extract_pages(source_pdf, page_start, page_end, output_pdf):
            papers_extracted += 1
            if i % 500 == 0:
                print(f"[{i}/{len(papers)}] Progress: {papers_extracted} extracted, {papers_failed} failed")
        else:
            papers_failed += 1
            if i % 500 == 0:
                print(f"[{i}/{len(papers)}] Progress: {papers_extracted} extracted, {papers_failed} failed")

    # Final summary
    print(f"\n{'='*100}")
    print(f"✓ EXTRACTION COMPLETE")
    print(f"  Successfully extracted: {papers_extracted}/{len(papers)} papers ({papers_extracted/len(papers)*100:.1f}%)")
    print(f"  Failed: {papers_failed}/{len(papers)} papers")
    print(f"  Output directory: {OUTPUT_DIR}")
    print(f"{'='*100}\n")

if __name__ == "__main__":
    main()
