"""
utils.py — Utility functions for the Question Generation Engine.

Handles all file I/O, seen-state management, choice construction,
and helper logic so engine.py and generator.py stay clean.
"""

import json
import logging
import random
from pathlib import Path
from typing import Dict, List, Set

from models import Fact

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[QEngine] %(levelname)s: %(message)s"
)
log = logging.getLogger(__name__)


# ── File paths (resolved relative to this file's location) ────────────────────
_ENGINE_DIR = Path(__file__).parent
FACTS_PATH = _ENGINE_DIR / "facts.json"
SEEN_PATH  = _ENGINE_DIR / "seen.json"


# ── File I/O ──────────────────────────────────────────────────────────────────

def load_facts() -> List[Fact]:
    """
    Load and validate all facts from facts.json.
    Raises FileNotFoundError with a clear message if the file is missing.
    """
    if not FACTS_PATH.exists():
        raise FileNotFoundError(
            f"facts.json not found at '{FACTS_PATH}'. "
            "Please create it before running the engine."
        )

    with FACTS_PATH.open(encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        raise ValueError("facts.json must contain a JSON array of fact objects.")

    facts: List[Fact] = []
    for entry in raw:
        try:
            facts.append(Fact(**entry))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid fact entry {entry.get('id', '?')}: {exc}") from exc

    log.info("Loaded %d facts from facts.json.", len(facts))
    return facts


def load_seen() -> Dict[str, List[int]]:
    """
    Load the seen-state from seen.json.
    If the file does not exist, create it empty and return {}.
    Format: { "fact_id": [form_number, ...], ... }
    """
    if not SEEN_PATH.exists():
        log.info("seen.json not found — creating a fresh one.")
        save_seen({})
        return {}

    with SEEN_PATH.open(encoding="utf-8") as f:
        data = json.load(f)

    log.info("Loaded seen state for %d fact(s).", len(data))
    return data


def save_seen(seen: Dict[str, List[int]]) -> None:
    """
    Persist the current seen-state back to seen.json.
    """
    with SEEN_PATH.open("w", encoding="utf-8") as f:
        json.dump(seen, f, indent=2)
    log.info("seen.json updated (%d fact(s) tracked).", len(seen))


# ── Form/Level helpers ─────────────────────────────────────────────────────────

def allowed_forms(level: int) -> List[int]:
    """
    Return the list of question form numbers permitted for the given level.

    Level 1 → forms 1, 4  (simple recall only)
    Level 2 → forms 1–4
    Level 3 → forms 1–6   (all forms)
    """
    if level == 1:
        return [1, 4]
    elif level == 2:
        return [1, 2, 3, 4]
    else:  # level 3
        return [1, 2, 3, 4, 5, 6]


def unseen_forms(fact_id: str, seen: Dict[str, List[int]], level: int) -> List[int]:
    """
    Return forms that are both allowed for `level` AND not yet used for `fact_id`.
    """
    used: Set[int] = set(seen.get(fact_id, []))
    return [f for f in allowed_forms(level) if f not in used]


# ── Choice construction ────────────────────────────────────────────────────────

def pick_wrong_terms(pool: List[str], count: int = 3) -> List[str]:
    """
    Pick `count` unique wrong-choice terms from the pool.
    Raises ValueError if the pool is too small.
    """
    if len(pool) < count:
        raise ValueError(
            f"Need at least {count} wrong options, but pool only has {len(pool)}: {pool}"
        )
    return random.sample(pool, count)


def shuffle_choices(answer: str, wrong_choices: List[str]) -> List[str]:
    """
    Combine the correct answer with wrong choices, shuffle, and return.
    Guarantees the answer appears exactly once and choices are de-duplicated
    (answer is never accidentally in wrong_choices).
    """
    # Guard: remove the answer from wrongs just in case of data overlap
    clean_wrongs = [w for w in wrong_choices if w != answer][:3]
    choices = [answer] + clean_wrongs
    random.shuffle(choices)
    return choices


# ── Fact validation (bonus) ────────────────────────────────────────────────────

def validate_facts(facts: List[Fact]) -> None:
    """
    Run extra cross-fact validation checks and log any warnings.
    Currently checks for duplicate IDs.
    """
    seen_ids: Set[str] = set()
    for fact in facts:
        if fact.id in seen_ids:
            log.warning("Duplicate fact ID detected: '%s' — later entry will shadow earlier.", fact.id)
        seen_ids.add(fact.id)
    log.info("Fact validation complete.")
