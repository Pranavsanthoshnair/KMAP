"""
engine.py — Core Question Generation Engine (v2)

Two-track generation:
  • Pattern-based  : math → numeric templates with randomised params (pattern_generator.py)
  • Facts-based    : science / english → 6 question forms from facts.json (generator.py)

Both tracks enforce:
  • No repetition within session (session_sigs / seen.json)
  • Variety per quiz set (no repeated pattern types)
  • Auto-reset when all pairs are exhausted (New Set always works)
  • Multi-subtopic support (subtopics: list[str])
"""

import logging
import random
from typing import Dict, List, Optional, Set

from models import EngineResult, Fact, Question
from generator import generate_form
from pattern_generator import generate_quiz_set as pattern_quiz_set, generate_from_pattern, get_patterns
from utils import load_facts, load_seen, save_seen, unseen_forms, validate_facts

log = logging.getLogger(__name__)

# Subjects that use pattern-based generation
PATTERN_SUBJECTS = {"math"}


# ── Facts-based helpers ────────────────────────────────────────────────────────

def _filter_facts(facts: List[Fact], topic: str, grade_band: int, level: int) -> List[Fact]:
    return [
        f for f in facts
        if f.topic == topic
        and f.grade_band == grade_band
        and f.level <= level
    ]


def _reset_seen_for_topic(seen: Dict, facts: List[Fact]) -> None:
    for fact in facts:
        seen.pop(fact.id, None)
    log.info("Seen state cleared for %d fact(s).", len(facts))


def _build_pool(facts: List[Fact], seen: Dict, level: int):
    pool = []
    for fact in facts:
        for form in unseen_forms(fact.id, seen, level):
            pool.append((fact, form))
    random.shuffle(pool)
    return pool


# ── Pattern-based generation ────────────────────────────────────────────────────

def _generate_pattern_questions(
    subject: str,
    grade: int,
    subtopics: List[str],
    level: int,
    count: int,
    session_sigs: Set[str],
) -> EngineResult:
    """Generate questions using pattern templates (no seen.json needed)."""
    from pattern_generator import enforce_variety as _enforce_variety

    raw_qs = pattern_quiz_set(
        subject=subject,
        grade=grade,
        subtopics=subtopics,
        skill_level=level,
        count=count,
        session_sigs=session_sigs,
    )

    # enforce_variety already ran inside generate_quiz_set, but raw_qs still
    # has "form" as the type STRING — use it now before converting to Question.
    # Map type string → stable int for the Question.form field.
    _type_map: Dict[str, int] = {}
    questions: List[Question] = []
    for q in raw_qs:
        type_str = q.get("form", "unknown")
        if type_str not in _type_map:
            _type_map[type_str] = len(_type_map) + 10  # offset from facts forms (1-6)
        questions.append(Question(
            id=q["id"],
            form=_type_map[type_str],
            question=q["question"],
            choices=q["choices"],
            answer=q["answer"],
        ))

    exhausted = len(questions) < count
    return EngineResult(questions=questions, exhausted=exhausted)


# ── Facts-based generation ─────────────────────────────────────────────────────

def _generate_facts_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    reset_seen: bool,
) -> EngineResult:
    """Generate questions from facts.json using 6 question forms."""
    all_facts = load_facts()
    validate_facts(all_facts)
    seen = load_seen()

    eligible = _filter_facts(all_facts, topic, grade_band, level)
    if not eligible:
        log.warning("No facts for topic='%s' grade=%d level<=%d", topic, grade_band, level)
        return EngineResult(questions=[], exhausted=True)

    if reset_seen:
        _reset_seen_for_topic(seen, eligible)

    pool = _build_pool(eligible, seen, level)

    # Auto-reset if pool empty (guarantees New Set always works)
    if not pool:
        log.info("Pool exhausted — auto-resetting seen state for topic '%s'.", topic)
        _reset_seen_for_topic(seen, eligible)
        pool = _build_pool(eligible, seen, level)

    exhausted = len(pool) < count
    selected  = pool[:count]
    questions: List[Question] = []

    for fact, form_number in selected:
        try:
            q = generate_form(fact, form_number)
            questions.append(q)
            seen.setdefault(fact.id, [])
            if form_number not in seen[fact.id]:
                seen[fact.id].append(form_number)
        except Exception as exc:
            log.error("Form %d / fact '%s' failed: %s", form_number, fact.id, exc)

    save_seen(seen)
    return EngineResult(questions=questions, exhausted=exhausted)


# ── Main entry point ───────────────────────────────────────────────────────────

def generate_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    seed: Optional[int] = None,
    reset_seen: bool = False,
    subject: Optional[str] = None,
    subtopics: Optional[List[str]] = None,
    session_sigs: Optional[Set[str]] = None,
) -> EngineResult:
    """
    Unified question generation entry point.

    Routes to pattern-based generation for math;
    falls back to facts-based generation for science/english.

    Parameters
    ----------
    topic      : Primary subtopic slug.
    grade_band : User's grade band (1–5).
    level      : Max difficulty level (1–3).
    count      : Number of questions requested.
    seed       : Optional random seed for determinism.
    reset_seen : Clear seen state for this topic before generating.
    subject    : Subject name (auto-inferred from topic if omitted).
    subtopics  : For multi-subtopic quiz; if given, topic is ignored.
    session_sigs: Mutable set of used parameter signatures for in-session dedup.
    """
    if seed is not None:
        random.seed(seed)

    # Infer subject from topic prefix if not provided
    if not subject:
        if topic.startswith("math") or topic in {
            "arithmetic", "fractions", "geometry", "algebra",
            "decimals", "statistics", "calculus", "trigonometry",
            "multiplication", "counting",
        }:
            subject = "math"
        elif topic.startswith("sci") or topic in {
            "basic_biology", "cell_structure", "photosynthesis", "genetics",
            "chemical_reactions", "electricity", "forces", "ecology",
            "human_body", "states_of_matter", "microbiology",
        }:
            subject = "science"
        else:
            subject = "english"

    if session_sigs is None:
        session_sigs = set()

    # Resolve subtopics list
    topics_list = subtopics if subtopics else [topic]

    # ── Route to pattern-based for math ───────────────────────────────────────
    if subject in PATTERN_SUBJECTS:
        result = _generate_pattern_questions(
            subject=subject,
            grade=grade_band,
            subtopics=topics_list,
            level=level,
            count=count,
            session_sigs=session_sigs,
        )
        # If no patterns available (new topic not yet in patterns.json),
        # fall back to facts-based
        if not result.questions:
            log.info("No patterns for '%s' — falling back to facts-based.", topic)
            return _generate_facts_questions(topic, grade_band, level, count, reset_seen)
        return result

    # ── Facts-based for science / english ─────────────────────────────────────
    # Multi-subtopic: merge results from each subtopic
    if len(topics_list) > 1:
        per_topic = max(1, count // len(topics_list))
        all_qs: List[Question] = []
        for t in topics_list:
            r = _generate_facts_questions(t, grade_band, level, per_topic, reset_seen)
            all_qs.extend(r.questions)
        random.shuffle(all_qs)
        return EngineResult(questions=all_qs[:count], exhausted=len(all_qs) < count)

    return _generate_facts_questions(topic, grade_band, level, count, reset_seen)
