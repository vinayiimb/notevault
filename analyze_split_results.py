#!/usr/bin/env python3
"""Analyze the results of PDF splitting and categorize errors."""
import json
import os
from collections import defaultdict, Counter

METADATA_FILE = "/Users/sayam/Projects/notevault/metadata.jsonl"
OUTPUT_DIR = "/Users/sayam/Desktop/Kalindi-QP-Archive/OrganizedQPs"

def main():
    # Load metadata
    papers = {}
    with open(METADATA_FILE) as f:
        for line in f:
            if line.strip():
                paper = json.loads(line)
                key = f"{paper.get('subject')}_{paper.get('course')}_{paper.get('semester')}_{paper.get('year_tab')}"
                papers[key] = paper

    # Count successful extractions
    successful = 0
    subject_counts = Counter()
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for f in files:
            if f.endswith('.pdf'):
                successful += 1
                subject = os.path.basename(root)
                subject_counts[subject] += 1

    # Analyze by year
    year_breakdown = defaultdict(int)
    for root, dirs, files in os.walk(OUTPUT_DIR):
        for f in files:
            if f.endswith('.pdf'):
                # Extract year from filename (last part before .pdf)
                parts = f.rsplit('_', 1)
                if len(parts) == 2:
                    year = parts[1].replace('.pdf', '')
                    year_breakdown[year] += 1

    total_papers = len(papers)
    success_rate = (successful / total_papers * 100) if total_papers > 0 else 0

    print("\n" + "="*100)
    print("PDF SPLITTING RESULTS SUMMARY")
    print("="*100)
    print(f"\n📊 OVERALL STATISTICS")
    print(f"  Total papers in metadata: {total_papers:,}")
    print(f"  Successfully extracted: {successful:,}")
    print(f"  Success rate: {success_rate:.1f}%")
    print(f"  Failed extractions: {total_papers - successful:,}")

    print(f"\n📁 ORGANIZATION")
    print(f"  Unique subjects created: {len(subject_counts):,}")
    print(f"  Top 20 subjects by paper count:")
    for subject, count in subject_counts.most_common(20):
        print(f"    • {subject}: {count} papers")

    print(f"\n📅 BREAKDOWN BY YEAR")
    for year in sorted(year_breakdown.keys()):
        print(f"  {year}: {year_breakdown[year]} papers")

    print(f"\n✅ OUTPUT LOCATION")
    print(f"  {OUTPUT_DIR}")
    print(f"  Ready for upload to Google Drive")
    print("="*100 + "\n")

if __name__ == "__main__":
    main()
