"""
upload_resources.py — Bulk upload PDFs to Supabase Storage + insert metadata rows.

Expected folder structure:
    resources_pdfs/
    ├── science/
    │   ├── G1_basic_biology_L1.pdf
    │   ├── G1_basic_biology_L2.pdf
    │   ├── G1_basic_biology_L3.pdf
    │   └── ...
    └── math/
        ├── G1_arithmetic_L1.pdf
        └── ...

Naming pattern:  G{grade}_{topic}_L{level}.pdf   (level 1–3)

Usage:
    python upload_resources.py                          # default folder: ./resources_pdfs
    python upload_resources.py --folder /path/to/pdfs   # custom folder
    python upload_resources.py --dry-run                # preview without uploading
"""

import os
import re
import json
import argparse
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("Install supabase-py first:  pip install supabase")
    exit(1)

BUCKET_NAME = "resources"
FILE_PATTERN = re.compile(r"G(\d+)_(.+)_L(\d+)\.pdf", re.IGNORECASE)

TOPIC_TITLES = {
    "basic_biology": "Basic Biology", "animals": "Animals", "plants": "Plants",
    "weather": "Weather", "cell_structure": "Cell Structure",
    "photosynthesis": "Photosynthesis", "states_of_matter": "States of Matter",
    "human_body": "Human Body",
    "arithmetic": "Arithmetic", "counting": "Counting", "shapes": "Shapes",
    "comparison": "Comparison", "fractions": "Fractions",
    "measurement": "Measurement", "time": "Time",
}

LEVEL_LABELS = {
    1: "Fundamentals",
    2: "Building Understanding",
    3: "Mastery",
}


def get_supabase_client():
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        env_path = Path(__file__).resolve().parents[2] / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip())
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        exit(1)
    return create_client(url, key)


def scan_pdfs(folder: str):
    entries = []
    base = Path(folder)
    for subject_dir in sorted(base.iterdir()):
        if not subject_dir.is_dir():
            continue
        subject = subject_dir.name.lower()
        for pdf in sorted(subject_dir.glob("*.pdf")):
            match = FILE_PATTERN.match(pdf.name)
            if not match:
                print(f"  SKIP (bad name): {pdf.name}")
                continue
            grade = int(match.group(1))
            topic = match.group(2).lower()
            level = int(match.group(3))
            if level > 3:
                print(f"  SKIP (level > 3): {pdf.name}")
                continue
            topic_label = TOPIC_TITLES.get(topic, topic.replace("_", " ").title())
            level_label = LEVEL_LABELS.get(level, f"Level {level}")
            title = f"{topic_label} — {level_label} (Grade {grade})"
            resource_id = f"{subject[:3]}_{topic}_G{grade}_L{level}"
            storage_path = f"{subject}/G{grade}_{topic}_L{level}.pdf"
            entries.append({
                "id": resource_id, "subject": subject, "grade": grade,
                "subtopic": topic, "difficulty": level, "type": "pdf",
                "title": title, "storage_path": storage_path,
                "size_kb": round(pdf.stat().st_size / 1024),
                "preview_text": f"{topic_label} study material for Grade {grade}, {level_label}.",
                "local_path": str(pdf),
            })
    return entries


def upload_all(entries, supabase, dry_run=False):
    print(f"\n{'DRY RUN — ' if dry_run else ''}Processing {len(entries)} resources...\n")
    for i, entry in enumerate(entries, 1):
        local_path = entry.pop("local_path")
        print(f"  [{i}/{len(entries)}] {entry['id']}  ({entry['size_kb']} KB)")
        if dry_run:
            continue
        with open(local_path, "rb") as f:
            file_bytes = f.read()
        try:
            supabase.storage.from_(BUCKET_NAME).upload(
                entry["storage_path"], file_bytes,
                {"content-type": "application/pdf", "upsert": "true"},
            )
        except Exception as e:
            if "already exists" in str(e).lower() or "Duplicate" in str(e):
                supabase.storage.from_(BUCKET_NAME).update(
                    entry["storage_path"], file_bytes,
                    {"content-type": "application/pdf"},
                )
            else:
                print(f"    STORAGE ERROR: {e}")
                continue
        try:
            supabase.table("resources").upsert(entry, on_conflict="id").execute()
        except Exception as e:
            print(f"    DB ERROR: {e}")
    print(f"\n{'DRY RUN complete.' if dry_run else 'Upload complete!'}")


def main():
    parser = argparse.ArgumentParser(description="Upload KMAP resource PDFs to Supabase")
    parser.add_argument("--folder", default="./resources_pdfs",
                        help="Root folder with science/ and math/ subdirs")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview without uploading")
    args = parser.parse_args()
    folder = Path(args.folder)
    if not folder.exists():
        print(f"ERROR: Folder not found: {folder.resolve()}")
        print(f"\nCreate this structure:")
        print(f"  {folder}/")
        print(f"  ├── science/  (G1_basic_biology_L1.pdf … L3.pdf)")
        print(f"  └── math/     (G1_arithmetic_L1.pdf … L3.pdf)")
        exit(1)
    entries = scan_pdfs(str(folder))
    if not entries:
        print("No PDFs found matching G{grade}_{topic}_L{level}.pdf")
        exit(1)
    print(f"Found {len(entries)} PDFs:")
    for e in entries:
        print(f"  {e['id']}  →  {e['storage_path']}")
    if args.dry_run:
        upload_all(entries, None, dry_run=True)
    else:
        supabase = get_supabase_client()
        upload_all(entries, supabase)


if __name__ == "__main__":
    main()
