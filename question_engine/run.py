"""
run.py — Entry point for the Question Generation Engine.

Usage:
    python run.py

Edit the parameters below to change what questions are generated.
Run from within the question_engine/ directory.
"""

import json
import sys
from pathlib import Path

# Make sure sibling modules are importable when run directly
sys.path.insert(0, str(Path(__file__).parent))

from engine import generate_questions

# ── Configure your request here ───────────────────────────────────────────────
TOPIC      = "cell_structure"
GRADE_BAND = 2
LEVEL      = 2
COUNT      = 5
SEED       = None   # Set an integer (e.g. 42) for reproducible output; None = random

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    result = generate_questions(
        topic=TOPIC,
        grade_band=GRADE_BAND,
        level=LEVEL,
        count=COUNT,
        seed=SEED,
    )
    print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
