"""
run.py — Entry point for the Question Generation Engine.

Supports two modes:
  1. Direct (edit params below, run: python run.py)
  2. CLI args (called by Next.js API: python run.py --topic=... --grade_band=... --level=... --count=...)

All logging goes to stderr; only the JSON result goes to stdout.
"""

import argparse
import json
import sys
from pathlib import Path

# Make sibling modules importable
sys.path.insert(0, str(Path(__file__).parent))

from engine import generate_questions

# ── Default params (used when no CLI args supplied) ───────────────────────────
DEFAULTS = dict(topic="cell_structure", grade_band=2, level=2, count=5, seed=None)


def main():
    parser = argparse.ArgumentParser(description="KMAP Question Engine")
    parser.add_argument("--topic",      default=DEFAULTS["topic"])
    parser.add_argument("--grade_band", type=int, default=DEFAULTS["grade_band"])
    parser.add_argument("--level",      type=int, default=DEFAULTS["level"])
    parser.add_argument("--count",      type=int, default=DEFAULTS["count"])
    parser.add_argument("--seed",       type=int, default=DEFAULTS["seed"])
    args = parser.parse_args()

    result = generate_questions(
        topic=args.topic,
        grade_band=args.grade_band,
        level=args.level,
        count=args.count,
        seed=args.seed,
    )

    # Output ONLY JSON to stdout — logs already go to stderr via Python logging
    print(json.dumps(result.to_dict(), ensure_ascii=False))


if __name__ == "__main__":
    main()
