"""
run.py — CLI entry point for the KMAP Question Engine v3

Usage:
  # Mode A: subtopic-specific (default)
  python run.py --subject=math --topic=fractions --grade_band=3 --level=2 --count=6

  # Mode B: full-subject mixed quiz
  python run.py --subject=math --grade_band=3 --level=2 --count=8 --mode=subject

  # Multi-subtopic (still Mode A, uses first subtopic)
  python run.py --subject=science --subtopics=cell_structure,genetics --grade_band=3 --level=2 --count=6

All logging → stderr.  Only JSON output → stdout.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
sys.path.insert(0, str(Path(__file__).parent))

from engine import generate_questions


def main():
    parser = argparse.ArgumentParser(description="KMAP Hierarchical Question Engine")

    parser.add_argument("--topic",      default="cell_structure",
                        help="Primary subtopic slug (e.g. arithmetic, cell_structure)")
    parser.add_argument("--subtopics",  default="",
                        help="Comma-separated subtopics; first is used as primary for Mode A")
    parser.add_argument("--subject",    default="",
                        help="Subject: math | science | english (inferred from topic if omitted)")
    parser.add_argument("--grade_band", type=int, default=2,
                        help="Grade band 1–5")
    parser.add_argument("--level",      type=int, default=2,
                        help="Skill level 1=beginner 2=intermediate 3=advanced")
    parser.add_argument("--count",      type=int, default=6,
                        help="Number of questions to generate")
    parser.add_argument("--mode",       default="subtopic", choices=["subtopic", "subject"],
                        help="subtopic = Mode A (one subtopic only); subject = Mode B (all subtopics evenly)")
    parser.add_argument("--seed",       type=int, default=None,
                        help="Optional random seed for determinism")
    parser.add_argument("--reset",      action="store_true",
                        help="(Kept for API compat; bank mode is stateless)")

    args = parser.parse_args()

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
        mode=args.mode,
    )

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
