"""
engine.py — Core Question Generation Engine.

Orchestrates the full pipeline:
  1. Load facts and seen state
  2. Filter facts by topic / grade_band / level
  3. Build a shuffled pool of (fact, form) pairs not yet seen
  4. Generate the requested number of questions
  5. Persist updated seen state
  6. Return an EngineResult

All heavy logic lives in utils.py and generator.py — this file just connects them.
"""

import logging
import random
from typing import Dict, List, Optional, Tuple

from models import EngineResult, Fact, Question
from generator import generate_form
from utils import (
    load_facts,
    load_seen,
    save_seen,
    unseen_forms,
    validate_facts,
)

log = logging.getLogger(__name__)


def _filter_facts(facts: List[Fact], topic: str, grade_band: int, level: int) -> List[Fact]:
    """
    Apply the three filter rules:
      • fact.topic    == topic
      • fact.grade_band == grade_band
      • fact.level    <= level   (easier facts are always included)
    """
    filtered = [
        f for f in facts
        if f.topic == topic
        and f.grade_band == grade_band
        and f.level <= level
    ]
    log.info(
        "Filter: topic='%s', grade_band=%d, level<=%d → %d fact(s) matched.",
        topic, grade_band, level, len(filtered)
    )
    return filtered


def _build_candidate_pool(
    facts: List[Fact],
    seen: Dict[str, List[int]],
    level: int,
) -> List[Tuple[Fact, int]]:
    """
    Build a flat list of (fact, form) pairs where the form has not been seen
    for that fact yet.  The pool is shuffled so picks are random each run.
    """
    pool: List[Tuple[Fact, int]] = []
    for fact in facts:
        available = unseen_forms(fact.id, seen, level)
        for form in available:
            pool.append((fact, form))

    random.shuffle(pool)
    log.info("Candidate pool size: %d (fact × form) pairs.", len(pool))
    return pool


def generate_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    seed: Optional[int] = None,
) -> EngineResult:
    """
    Main entry point for question generation.

    Parameters
    ----------
    topic      : Match facts where fact.topic == topic.
    grade_band : Match facts where fact.grade_band == grade_band.
    level      : Maximum difficulty level (1–3). Also controls allowed forms.
    count      : Number of questions to generate.
    seed       : Optional integer for deterministic output (useful for testing).

    Returns
    -------
    EngineResult with `.questions` list and `.exhausted` flag.
    """
    # ── Optional deterministic mode ──────────────────────────────────────────
    if seed is not None:
        random.seed(seed)
        log.info("Deterministic mode: random seed set to %d.", seed)

    # ── Load data ────────────────────────────────────────────────────────────
    all_facts = load_facts()
    validate_facts(all_facts)
    seen = load_seen()

    # ── Filter ───────────────────────────────────────────────────────────────
    eligible_facts = _filter_facts(all_facts, topic, grade_band, level)

    if not eligible_facts:
        log.warning("No facts matched the given filters. Returning empty result.")
        return EngineResult(questions=[], exhausted=True)

    # ── Build candidate pool ─────────────────────────────────────────────────
    pool = _build_candidate_pool(eligible_facts, seen, level)

    # ── Determine how many we can actually serve ──────────────────────────────
    available = len(pool)
    exhausted = available < count
    to_generate = min(count, available)

    if exhausted:
        log.warning(
            "Exhausted: only %d unique (fact, form) pair(s) available, %d requested.",
            available, count
        )

    # ── Generate questions ───────────────────────────────────────────────────
    selected_pairs = pool[:to_generate]
    questions: List[Question] = []

    for fact, form_number in selected_pairs:
        try:
            q = generate_form(fact, form_number)
            questions.append(q)

            # Mark this (fact, form) pair as seen
            if fact.id not in seen:
                seen[fact.id] = []
            if form_number not in seen[fact.id]:
                seen[fact.id].append(form_number)

        except Exception as exc:
            # Log and skip bad generations — don't crash the whole run
            log.error(
                "Failed to generate form %d for fact '%s': %s",
                form_number, fact.id, exc
            )

    log.info("Generated %d question(s).", len(questions))

    # ── Persist seen state ───────────────────────────────────────────────────
    save_seen(seen)

    return EngineResult(questions=questions, exhausted=exhausted)
