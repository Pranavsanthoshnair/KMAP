"""
engine.py — Core Question Generation Engine.

Orchestrates the full pipeline:
  1. Load facts and seen state
  2. Filter facts by topic / grade_band / level
  3. (Optionally reset seen state for this topic)
  4. Build a shuffled pool of (fact, form) pairs not yet seen
  5. Auto-reset if pool is completely empty (guarantees New Set always works)
  6. Generate the requested number of questions
  7. Persist updated seen state
  8. Return an EngineResult
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


# ── Private helpers ────────────────────────────────────────────────────────────

def _filter_facts(facts: List[Fact], topic: str, grade_band: int, level: int) -> List[Fact]:
    """
    Return facts where:
      • fact.topic      == topic
      • fact.grade_band == grade_band
      • fact.level      <= level   (easier facts are included at harder levels)
    """
    filtered = [
        f for f in facts
        if f.topic == topic
        and f.grade_band == grade_band
        and f.level <= level
    ]
    log.info(
        "Filter: topic='%s', grade_band=%d, level<=%d -> %d fact(s) matched.",
        topic, grade_band, level, len(filtered)
    )
    return filtered


def _reset_seen_for_topic(seen: Dict[str, List[int]], facts: List[Fact]) -> None:
    """Clear seen-state for every fact in the topic so all forms become available again."""
    for fact in facts:
        if fact.id in seen:
            del seen[fact.id]
    log.info("Seen state cleared for %d fact(s).", len(facts))


def _build_candidate_pool(
    facts: List[Fact],
    seen: Dict[str, List[int]],
    level: int,
) -> List[Tuple[Fact, int]]:
    """
    Build a flat, shuffled list of (fact, form) pairs that have not been seen yet.
    """
    pool: List[Tuple[Fact, int]] = []
    for fact in facts:
        for form in unseen_forms(fact.id, seen, level):
            pool.append((fact, form))
    random.shuffle(pool)
    log.info("Candidate pool: %d (fact x form) pairs.", len(pool))
    return pool


# ── Main entry point ───────────────────────────────────────────────────────────

def generate_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    seed: Optional[int] = None,
    reset_seen: bool = False,
) -> EngineResult:
    """
    Generate multiple-choice questions from the local knowledge base.

    Parameters
    ----------
    topic       : Filter facts where fact.topic == topic.
    grade_band  : Filter facts where fact.grade_band == grade_band.
    level       : Max difficulty level (1-3); controls which question forms are allowed.
    count       : Number of questions to generate.
    seed        : Optional integer for deterministic/reproducible output.
    reset_seen  : If True, clear seen-state for this topic before building the pool.
                  Automatically set True when the pool is empty (infinite replay).

    Returns
    -------
    EngineResult with .questions list and .exhausted flag.
    """
    # ── Deterministic mode ────────────────────────────────────────────────────
    if seed is not None:
        random.seed(seed)
        log.info("Deterministic mode: seed=%d.", seed)

    # ── Load data ─────────────────────────────────────────────────────────────
    all_facts = load_facts()
    validate_facts(all_facts)
    seen = load_seen()

    # ── Filter ────────────────────────────────────────────────────────────────
    eligible_facts = _filter_facts(all_facts, topic, grade_band, level)
    if not eligible_facts:
        log.warning("No facts matched filters — returning empty result.")
        return EngineResult(questions=[], exhausted=True)

    # ── Optional explicit reset (e.g. "New Set" button) ───────────────────────
    if reset_seen:
        log.info("Explicit reset requested — clearing seen state for topic '%s'.", topic)
        _reset_seen_for_topic(seen, eligible_facts)

    # ── Build pool ────────────────────────────────────────────────────────────
    pool = _build_candidate_pool(eligible_facts, seen, level)

    # ── Auto-reset when pool is empty (infinite replay guarantee) ─────────────
    if len(pool) == 0:
        log.info("Pool exhausted — auto-resetting seen state for topic '%s'.", topic)
        _reset_seen_for_topic(seen, eligible_facts)
        pool = _build_candidate_pool(eligible_facts, seen, level)

    # ── Determine how many to serve ───────────────────────────────────────────
    available   = len(pool)
    exhausted   = available < count
    to_generate = min(count, available)

    if exhausted:
        log.warning("Only %d pair(s) available, %d requested.", available, count)

    # ── Generate ──────────────────────────────────────────────────────────────
    questions: List[Question] = []
    for fact, form_number in pool[:to_generate]:
        try:
            q = generate_form(fact, form_number)
            questions.append(q)
            # Mark this (fact, form) pair as seen
            seen.setdefault(fact.id, [])
            if form_number not in seen[fact.id]:
                seen[fact.id].append(form_number)
        except Exception as exc:
            log.error("Form %d / fact '%s' failed: %s", form_number, fact.id, exc)

    log.info("Generated %d question(s).", len(questions))
    save_seen(seen)
    return EngineResult(questions=questions, exhausted=exhausted)
