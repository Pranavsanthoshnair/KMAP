"""
run_allocator.py — CLI entry point for the Resource Allocation Engine.

Called by the Next.js API route (app/api/quiz/submit/route.ts) via:

    python run_allocator.py --mode mastery  --input /tmp/results.json
    python run_allocator.py --mode allocate --input /tmp/alloc.json

Using a JSON *file* instead of a command-line argument avoids all
Windows shell-quoting issues with embedded quotes and special characters.

All logging goes to stderr; only the JSON result goes to stdout.
"""

import argparse
import json
import sys
from pathlib import Path

# Make sibling modules importable
sys.path.insert(0, str(Path(__file__).parent))

from allocator import (
    allocate_resources,
    classify_subtopics,
    compute_mastery,
)


def mode_mastery(payload: dict) -> dict:
    """
    Input payload shape:
    {
        "results": [{"subtopic": "cell_structure", "correct": true}, ...]
    }

    Output:
    {
        "mastery":    {"cell_structure": 0.667},
        "classified": {"cell_structure": "medium"}
    }
    """
    results = payload.get("results", [])
    mastery = compute_mastery(results)
    classified = classify_subtopics(mastery)
    return {"mastery": mastery, "classified": classified}


def mode_allocate(payload: dict) -> list:
    """
    Input payload shape:
    {
        "mastery":        {"cell_structure": 0.667},
        "resources":      [{...Supabase resource rows...}],
        "subject":        "science",
        "grade":          2,
        "skill_level":    2,
        "n":              10,
        "recent_ids":     ["r001", "r002"],
        "low_data_mode":  false
    }

    Output:  ["r003", "r005", ...]  — ordered list of resource IDs
    """
    return allocate_resources(
        mastery=payload["mastery"],
        all_resources=payload.get("resources", []),
        subject=payload["subject"],
        grade=payload["grade"],
        skill_level=payload.get("skill_level", 2),
        n=payload.get("n", 10),
        recent_ids=payload.get("recent_ids", []),
        low_data_mode=payload.get("low_data_mode", False),
    )


def main():
    parser = argparse.ArgumentParser(description="KMAP Resource Allocator")
    parser.add_argument(
        "--mode",
        required=True,
        choices=["mastery", "allocate"],
        help="mastery — compute mastery from quiz results; allocate — pick resource IDs",
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to a JSON file containing the input payload",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    with open(input_path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)

    if args.mode == "mastery":
        result = mode_mastery(payload)
    else:
        result = mode_allocate(payload)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
