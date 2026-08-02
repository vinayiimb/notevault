#!/usr/bin/env python3
"""
Split PDF by metadata and organize into Year/Semester/Subject folders.
"""

import json
import os
from pathlib import Path
from pypdf import PdfReader, PdfWriter

# Read metadata
metadata_file = "metadata.jsonl"
output_dir = "organized_qps"

# Create output directory
os.makedirs(output_dir, exist_ok=True)

print(f"📄 Reading metadata from {metadata_file}...")
papers = []
with open(metadata_file, 'r') as f:
    for line in f:
        papers.append(json.loads(line.strip()))

print(f"✓ Found {len(papers)} papers\n")

# Process PDF
pdf_path = "/Users/sayam/Downloads/B.Com-Prog-Copy.pdf"
print(f"📖 Reading PDF: {pdf_path}")
reader = PdfReader(pdf_path)
print(f"✓ PDF has {len(reader.pages)} pages\n")

# Extract and save each paper
for i, paper in enumerate(papers, 1):
    file_output = paper['file_output']
    if not file_output:
        print(f"⊘ Paper {i}: No output path, skipping")
        continue

    # Create folder structure
    full_path = os.path.join(output_dir, file_output)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    # Extract pages
    writer = PdfWriter()
    start_page = paper['page_start'] - 1  # 0-indexed
    end_page = paper['page_end']

    for page_num in range(start_page, end_page):
        if page_num < len(reader.pages):
            writer.add_page(reader.pages[page_num])

    # Write PDF
    with open(full_path, 'wb') as out:
        writer.write(out)

    pages_count = end_page - start_page
    print(f"✅ {i}. {paper['subject']}")
    print(f"   → {full_path}")
    print(f"   📌 {pages_count} pages | {paper['marks']} marks | Sem {paper['semester']}\n")

print(f"\n🎉 Done! All papers organized in: {output_dir}/")
print(f"\nFolder structure:")
os.system(f"find {output_dir} -type f -name '*.pdf' | sort")
