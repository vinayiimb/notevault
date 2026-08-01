# Kalindi College Question Paper Archive — Full Extraction Summary

**Source:** https://www.kalindicollege.in/previous-year-qpapers/ (all programs, all years)

## ✅ FINAL TOTALS

| Metric | Count |
|---|---|
| **Source PDFs found on the page** | 386 links (382 unique URLs) |
| **Source PDFs downloaded** | 382 / 382 (100%) |
| **Source PDFs processed** | 253 / 382 |
| **Source PDFs skipped (by your instruction)** | 129 (2016-17, 2017-18, 2018-19, 2019-20 scanned files) |
| **Individual question papers cataloged** | **3,841** |
| **Total pages downloaded/scanned** | ~6.9 GB across 382 files |

## Breakdown by extraction method

| Method | Papers | Notes |
|---|---|---|
| Text-layer (born-digital PDFs) | 305 | Recent PDFs with real embedded text — high accuracy |
| OCR (first try) | 2,851 | Scanned PDFs, header found on first page checked |
| OCR (corrected) | 685 | Scanned PDFs, needed a nearby-page correction search |
| **Total** | **3,841** | |

## Breakdown by year

| Year | Papers |
|---|---|
| 2016-17 | 8 *(partial — only born-digital subset; scanned files skipped per your instruction)* |
| 2017-18 | 4 *(partial, same reason)* |
| 2018-19 | 0 *(skipped — scanned only)* |
| 2019-20 | 33 *(partial)* |
| 2020-21 | 251 |
| 2021-22 | 418 |
| 2022-23 | 717 |
| 2023-24 | 793 |
| 2024-25 | 901 |
| 2025-26 | 716 |

## Data quality (be aware before relying on this for automation)

- **Missing subject name:** 419 / 3,841 (10.9%)
- **Missing paper code:** 915 / 3,841 (23.8%)
- **Missing marks:** 408 / 3,841 (10.6%)
- OCR text has noise, especially in the **semester** field (Roman numerals I/II/III often misread as "il", "Ill", garbage strings) — needs a cleanup/normalization pass before trusting it blindly.
- Subject/course/paper-code fields are generally legible but may have OCR typos (e.g. "Financial Accounting" vs "Finaneial Accounting").

## Output files

- `metadata.jsonl` (project root) — one JSON object per paper: `source_file`, `source_url`, `year_tab`, `semester_group_tab`, `program_label`, `page_start`, `page_end`, `subject`, `course`, `semester`, `paper_code`, `marks`, `duration`, `extraction_method`
- Original downloaded PDFs remain in scratchpad (not committed to the repo) — each entry's `source_url` points back to the live file on kalindicollege.in if you need to re-fetch or split it later.

## What was NOT done

- Physical splitting of each source PDF into individual per-subject PDF files (like the original 2-file exercise) — with 3,841 papers this would mean thousands of output files. Metadata catalog was prioritized first; splitting can be done as a follow-up against `metadata.jsonl` using `page_start`/`page_end`.
- 129 pre-2020 scanned PDFs — skipped per your explicit instruction ("no need for 2016-2017 do from 2020").
- Semester field normalization/cleanup.
