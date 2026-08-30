# SEO Validation — DU PYQ Online

Generated 2026-08-30T07:59:29.931Z from `public/data/du-question-bank-full-mapped.json` + Ramanujan catalog.

## URL counts

| Category | Total nodes | Indexable (sitemap) | Skipped |
| --- | --- | --- | --- |
| Static | 16 | 16 | — |
| Blog | 21 | 21 | — |
| Programmes | 237 | 176 | 61 (non-programme buckets / < 3 subjects) |
| Programme × semester | — | 758 | thin sems (< 3 subjects / < 3 papers) are noindex |
| Subjects | 9597 | 6551 | 2 empty-slug + 1619 no-papers + 1425 under noindex programmes |
| Paper codes | 5471 | 4380 | 1091 (no papers) |
| Individual papers | 23452 | 20689 | 2763 (under noindex programme/subject) |
| **Total sitemap URLs** | | **32,591** | |

## Duplicates (should all be 0)

- programme paths: 0
- programme-semester paths: 0
- subject paths: 0
- paper-code paths: 0
- paper paths: 0

## Sample URLs

### Programmes
- `/papers/applied-psychology`
- `/papers/ba-prog-psychology-as-major`
- `/papers/ba-prog-apparel-design-construction-as-major`
- `/papers/bsc-hons-botany`
- `/papers/bsch-physics`
- `/papers/history`

### Programme × semester
- `/papers/applied-psychology/semester-1`
- `/papers/b-voc/semester-5`
- `/papers/ba-hons-social-work/semester-7`
- `/papers/ba-prog-with-political-science-as-major-discipline/semester-7`
- `/papers/bsc-hons-computer-science/semester-3`
- `/papers/ba-hons-multi-media-and-mass-communication/semester-7`

### Subjects
- `/papers/applied-psychology/abnormal-psychology`
- `/papers/ba-prog-economics-as-minor/introduction-to-causal-inference`
- `/papers/ba-prog-geography-as-major-discipline/political-geography`
- `/papers/bsc-hons-chemistry/radiochemistry-in-energy-medicine-and-environment`
- `/papers/bsch-electronics/signals-and-systems-core`
- `/papers/hindustani-music-vocal-instrumental/historical-and-theoretical-study-of-ragas`

### Paper codes
- `/paper-code/2302201101`
- `/paper-code/2123102007`
- `/paper-code/2202321101`
- `/paper-code/2343010034`
- `/paper-code/2181002001`
- `/paper-code/42357618`

### Individual papers
- `/paper/an-invitation-to-sociology-b-a-program-sociology-nov-dec-2025-2025-2302201101-1778057936`
- `/paper/cultural-transformations-in-early-modern-europe-ii-ba-prog-history-as-major-2025-2312202402-1hg7kbazbkgop0sapzbvheeu7dzgznzi7`
- `/paper/indian-literature-in-arabic-ba-prog-with-arabic-as-major-discipline-nov-dec-2025-2025-2015000016-1776923446`
- `/paper/environmental-biotechnology-management-bsc-hons-botany-nov-dec-2025-2025-2163010013-1776934246`
- `/paper/classical-sanskrit-literature-prose-ba-hons-sanskrit-may-june-2025-2132101201-18tp_llwvachbiht05yx5hhznavtx2r61`
- `/paper/social-media-and-communication-journalism-bah-2025-11017610-1g1bp37qj5pi6nss1rrrgbdsd7rft4prd`

## 10 random subject pages — uniqueness spot check

```json
{
  "path": "/papers/applied-psychology/abnormal-psychology",
  "name": "Abnormal Psychology",
  "programme": "Applied Psychology",
  "semesters": [
    "II"
  ],
  "paperCodes": [],
  "years": [
    "2022-2023"
  ],
  "papers": 1
}
```
```json
{
  "path": "/papers/b-sc-life-science-botany/plant-tissue-culture",
  "name": "Plant Tissue Culture",
  "programme": "B. Sc. Life Science (Botany)",
  "semesters": [
    "VII"
  ],
  "paperCodes": [
    "2163010011"
  ],
  "years": [
    "2026",
    "2025"
  ],
  "papers": 2
}
```
```json
{
  "path": "/papers/ba-prog-punjabi-as-major/gurmat-kaav",
  "name": "Gurmat Kaav",
  "programme": "B.A (Prog.) Punjabi as Major",
  "semesters": [
    "III"
  ],
  "paperCodes": [
    "2122202301"
  ],
  "years": [
    "2025",
    "2024"
  ],
  "papers": 2
}
```
```json
{
  "path": "/papers/ba-p/ba-p-english-language-through-literature",
  "name": "B.A. (P) English Language Through Literature",
  "programme": "B.A. (P)",
  "semesters": [
    "II"
  ],
  "paperCodes": [],
  "years": [
    "2021-2022"
  ],
  "papers": 3
}
```
```json
{
  "path": "/papers/ba-prog-philosophy/modern-western-philosophy",
  "name": "Modern Western Philosophy",
  "programme": "B.A. (Prog) Philosophy",
  "semesters": [
    "V"
  ],
  "paperCodes": [
    "2102203502"
  ],
  "years": [
    "2026",
    "2024"
  ],
  "papers": 3
}
```
```json
{
  "path": "/papers/bsc-hons-chemistry/reactive-intermediates-of-organic-chemistry",
  "name": "Reactive Intermediates of Organic Chemistry",
  "programme": "B.Sc (hons) Chemistry",
  "semesters": [
    "VII"
  ],
  "paperCodes": [
    "2173010040"
  ],
  "years": [
    "2026",
    "2025"
  ],
  "papers": 3
}
```
```json
{
  "path": "/papers/bsc-prog-applied-physical-science-with-analytical-methods-in-chemistry-biochemistry/coordination-chemistry-and-organometallics",
  "name": "Coordination Chemistry and Organometallics",
  "programme": "B.Sc. (Prog.) Applied Physical Science with Analytical Methods in Chemistry & Biochemistry",
  "semesters": [
    "V"
  ],
  "paperCodes": [
    "2172513501"
  ],
  "years": [
    "2024"
  ],
  "papers": 2
}
```
```json
{
  "path": "/papers/ba-hons-german/language-in-context-advanced-reading-and-writing-skills-1",
  "name": "Language in Context: Advanced Reading and Writing Skills (1)",
  "programme": "BA (Hons) German",
  "semesters": [
    "V"
  ],
  "paperCodes": [
    "2042123501"
  ],
  "years": [
    "2025",
    "2024"
  ],
  "papers": 2
}
```
```json
{
  "path": "/papers/economics/intermediate-mathematical-methods-for-economics",
  "name": "Intermediate Mathematical Methods for Economics",
  "programme": "Economics",
  "semesters": [
    "II"
  ],
  "paperCodes": [],
  "years": [
    "2022-2023",
    "2023-2025",
    "2025-2026"
  ],
  "papers": 4
}
```
```json
{
  "path": "/papers/physical-science-courses-pertaining-to-chemistry/nanoscale-materials-and-their-applications",
  "name": "Nanoscale Materials and their Applications",
  "programme": "Physical Science courses pertaining to Chemistry",
  "semesters": [
    "IV"
  ],
  "paperCodes": [
    "2173512002"
  ],
  "years": [
    "2026"
  ],
  "papers": 2
}
```
