import json
import re

MASTER_JSON = "data/upsc-pyq/upsc_questions_master.json"

def clean_text(text):
    # 1. Remove year in parens like (2025), (2024), [2020]
    cleaned = re.sub(r"\s*\(\s*20\d\d\s*\)\s*", "\n", text)
    cleaned = re.sub(r"\s*\[\s*20\d\d\s*\]\s*", "\n", cleaned)
    
    # 2. Fix hyphenated broken line breaks
    cleaned = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1-\2", cleaned)
    
    # 3. Join lone numbering lines like '\n1.\n' or '\nI.\n' or '\n(1)\n'
    cleaned = re.sub(r"(?:^|\n)\s*(\d+|[I|V|X]+)\.\s*\n\s*", r"\n\1. ", cleaned)
    cleaned = re.sub(r"(?:^|\n)\s*(\([a-d]\)|\([1-9]\))\s*\n\s*", r"\n\1 ", cleaned)
    
    # 4. Join line-broken statements inside pairs like 'Aurang:\nIn-charge...'
    cleaned = re.sub(r"(\d+\.\s*[^:\n]+:)\s*\n\s*", r"\1 ", cleaned)
    
    # 5. Clean extra spaces/newlines
    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]
    return "\n".join(lines)

def detect_table_structure(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) < 4:
        return None

    # Check for table headers (e.g. Archaeological Site, State, Description or Movement/Organisation, Leader)
    # Check if lines contain 1., 2., 3., 4.
    num_indices = [idx for idx, l in enumerate(lines) if re.match(r"^\d+\.\s*", l)]
    if len(num_indices) >= 2 and num_indices[0] >= 2:
        # Potential table! Lines before num_indices[0] could be lead prompt and column headers
        header_candidates = lines[1:num_indices[0]]
        # If header candidates look like column names
        if 1 <= len(header_candidates) <= 4:
            # Parse rows
            rows = []
            for i in range(len(num_indices)):
                start_i = num_indices[i]
                end_i = num_indices[i+1] if i + 1 < len(num_indices) else len(lines)
                # Filter out closing question prompt at the end
                row_lines = lines[start_i:end_i]
                
                # Check if last lines contain closing prompt
                clean_row_lines = []
                for rl in row_lines:
                    if any(k in rl.lower() for k in ["which of", "how many", "select the", "in which of"]):
                        break
                    clean_row_lines.append(rl)

                if clean_row_lines:
                    first_l = clean_row_lines[0]
                    m_num = re.match(r"^(\d+)\.\s*(.*)", first_l)
                    row_num = m_num.group(1) if m_num else str(i+1)
                    first_cell = m_num.group(2) if m_num else first_l
                    
                    other_cells = clean_row_lines[1:]
                    all_cells = [first_cell] + other_cells
                    rows.append({
                        "num": row_num,
                        "cells": all_cells
                    })

            if rows:
                return {
                    "headers": ["No."] + header_candidates,
                    "rows": rows
                }
    return None

def process_questions():
    with open(MASTER_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)

    for q in questions:
        raw = q["original_question"]
        cleaned = clean_text(raw)
        q["formatted_question"] = cleaned

        # Detect table
        table_info = detect_table_structure(raw)
        if table_info:
            q["table_data"] = table_info
            if q["question_type"] == "MCQ":
                q["question_type"] = "Match the Following / Pairs"

    with open(MASTER_JSON, "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)

    print(f"Processed and structured all {len(questions)} questions successfully!")

if __name__ == "__main__":
    process_questions()
