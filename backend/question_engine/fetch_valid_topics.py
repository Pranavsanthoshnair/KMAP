"""
fetch_valid_topics.py — Export valid (subject, grade, subtopic) from Supabase resources table.

Run after DB migrations or when resources change. Writes valid_topics.json used by
engine.py so question generation only uses topics that have at least one resource.

Usage:
  cd backend/question_engine && python fetch_valid_topics.py

Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (env or .env in backend or project root).
"""

import json
import os
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    create_client = None


def load_env():
    for env_path in [
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parents[1] / ".env",
        Path(__file__).resolve().parents[2] / ".env",
    ]:
        if env_path.exists():
            with open(env_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
            break


def main():
    load_env()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env)")
        raise SystemExit(1)
    if create_client is None:
        print("ERROR: Install supabase: pip install supabase")
        raise SystemExit(1)

    client = create_client(url, key)
    out = client.table("resources").select("subject, grade, subtopic").execute()
    rows = out.data or []

    # Build {"math": {"grade1": ["arithmetic", "shapes"], "grade2": [...]}, ...}
    by_subject: dict = {}
    for row in rows:
        subj = (row.get("subject") or "").strip().lower()
        grade = row.get("grade")
        subtopic = (row.get("subtopic") or "").strip().lower()
        if not subj or grade is None or not subtopic:
            continue
        grade_key = f"grade{int(grade)}"
        if subj not in by_subject:
            by_subject[subj] = {}
        if grade_key not in by_subject[subj]:
            by_subject[subj][grade_key] = []
        if subtopic not in by_subject[subj][grade_key]:
            by_subject[subj][grade_key].append(subtopic)

    for subj in by_subject:
        for grade_key in by_subject[subj]:
            by_subject[subj][grade_key].sort()

    out_path = Path(__file__).resolve().parent / "valid_topics.json"
    out_path.write_text(json.dumps(by_subject, indent=2), encoding="utf-8")
    total = sum(len(by_subject[s][g]) for s in by_subject for g in by_subject[s])
    print(f"Wrote {out_path} ({len(rows)} rows -> {total} subject/grade/subtopic entries)")


if __name__ == "__main__":
    main()
