"""
sync_sizes.py — Read file sizes from Supabase Storage and update resources table.

Usage:
    python sync_sizes.py
"""

import os
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    print("Install supabase-py first:  pip install supabase")
    exit(1)

BUCKET = "resources"
FOLDERS = ["science", "math"]


def load_env():
    for p in [Path(__file__).resolve().parents[1] / ".env",
              Path(__file__).resolve().parents[2] / ".env"]:
        if p.exists():
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            break


def main():
    load_env()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        exit(1)

    sb = create_client(url, key)
    updated = 0

    for folder in FOLDERS:
        print(f"\nScanning {folder}/...")
        files = sb.storage.from_(BUCKET).list(folder)

        for f in files:
            name = f.get("name", "")
            if not name.endswith(".pdf"):
                continue

            # metadata.size is in bytes
            meta = f.get("metadata", {})
            size_bytes = meta.get("size", 0)
            size_kb = round(size_bytes / 1024)

            storage_path = f"{folder}/{name}"

            # Update the resources table row that matches this storage_path
            result = sb.table("resources") \
                .update({"size_kb": size_kb}) \
                .eq("storage_path", storage_path) \
                .execute()

            matched = len(result.data) if result.data else 0
            status = "UPDATED" if matched > 0 else "NO MATCH"
            print(f"  {storage_path}  →  {size_kb} KB  [{status}]")
            updated += matched

    print(f"\nDone — updated {updated} rows.")


if __name__ == "__main__":
    main()
