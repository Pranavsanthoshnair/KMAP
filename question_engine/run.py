"""
run.py — Entry point for the KMAP Question Engine.

Usage:
  python run.py                              # use defaults
  python run.py --topic=arithmetic --grade_band=2 --level=2 --count=6
  python run.py --subject=math --subtopics=arithmetic,fractions --grade_band=3 --level=2 --count=6
  python run.py --topic=cell_structure --reset

All logging → stderr.  Only the JSON result → stdout.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from engine import generate_questions

DEFAULTS = dict(topic="arithmetic", subject="math", grade_band=2, level=2, count=6, seed=None)


def main():
    parser = argparse.ArgumentParser(description="KMAP Question Engine")
    parser.add_argument("--topic",      default=DEFAULTS["topic"],
                        help="Single subtopic slug (e.g. arithmetic)")
    parser.add_argument("--subtopics",  default="",
                        help="Comma-separated subtopics for multi-subtopic quiz (overrides --topic)")
    parser.add_argument("--subject",    default=DEFAULTS["subject"],
                        help="Subject override (math|science|english)")
    parser.add_argument("--grade_band", type=int, default=DEFAULTS["grade_band"])
    parser.add_argument("--level",      type=int, default=DEFAULTS["level"])
    parser.add_argument("--count",      type=int, default=DEFAULTS["count"])
    parser.add_argument("--seed",       type=int, default=DEFAULTS["seed"])
    parser.add_argument("--reset",      action="store_true",
                        help="Clear seen-state for this topic before generating")
    args = parser.parse_args()

    # Resolve subtopics list
    subtopics = [s.strip() for s in args.subtopics.split(",") if s.strip()] or None

    result = generate_questions(
        topic=args.topic,
        grade_band=args.grade_band,
        level=args.level,
        count=args.count,
        seed=args.seed,
        reset_seen=args.reset,
        subject=args.subject or None,
        subtopics=subtopics,
    )

    print(json.dumps(result.to_dict(), ensure_ascii=False))


if __name__ == "__main__":
    main()
