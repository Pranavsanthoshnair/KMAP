"""
pattern_generator.py — Pattern-Based Question Generator

Generates fresh numeric questions from templates with randomised parameters.
Used for Math (parametric) and Science/English (static).

Key features:
 - generate_from_pattern()   : single question from one pattern
 - enforce_variety()         : no repeated pattern types per quiz set
 - generate_quiz_set()       : multi-subtopic, variety-enforced quiz
 - No reattempt logic exists here — sessions are stateless
"""

import json
import logging
import random
from pathlib import Path
from typing import Dict, List, Optional, Set

log = logging.getLogger(__name__)

_cache: Optional[List[Dict]] = None
PATTERNS_FILE = Path(__file__).parent / "patterns.json"

_SAFE_GLOBALS = {"abs": abs, "round": round, "max": max, "min": min, "__builtins__": {}}


def _load() -> List[Dict]:
    global _cache
    if _cache is None:
        with open(PATTERNS_FILE) as f:
            _cache = json.load(f)
    return _cache


def _eval(expr: str, params: Dict) -> str:
    """Safely evaluate a math expression; returns empty string on failure."""
    try:
        result = eval(str(expr), _SAFE_GLOBALS, dict(params))
        if isinstance(result, float):
            return str(int(result)) if result == int(result) else f"{result:.2f}".rstrip("0").rstrip(".")
        return str(result)
    except Exception:
        return ""


def _make_params(constraints: Dict, computed: Dict) -> Dict:
    """Generate random params from ranges, then evaluate computed values."""
    params: Dict = {}
    for k, v in constraints.items():
        params[k] = random.randint(int(v[0]), int(v[1]))
    for k, expr in computed.items():
        try:
            val = eval(str(expr), _SAFE_GLOBALS, dict(params))
            params[k] = int(val) if float(val) == int(float(val)) else val
        except Exception:
            pass
    return params


def _params_sig(params: Dict) -> str:
    return str(sorted(params.items()))


def generate_from_pattern(
    pattern: Dict,
    session_sigs: Optional[Set[str]] = None,
    retries: int = 10,
) -> Optional[Dict]:
    """
    Generate one question from a pattern dict.

    Parametric patterns  : have 'constraints' and 'answer_expr'.
    Static patterns      : have fixed 'answer' and 'distractors'.
    Returns None if a unique question cannot be generated.
    """
    # ── Static pattern ────────────────────────────────────────────────────────
    if "constraints" not in pattern:
        wrong = list(pattern.get("distractors", []))
        right = str(pattern.get("answer", ""))
        choices = ([right] + wrong[:3])
        while len(choices) < 4:
            choices.append("None of the above")
        random.shuffle(choices)
        return {
            "id":       pattern["id"],
            "form":     pattern["type"],
            "question": pattern["template"],
            "choices":  choices[:4],
            "answer":   right,
            "subtopic": pattern.get("subtopic", ""),
            "difficulty": pattern.get("difficulty", 1),
        }

    # ── Parametric pattern ────────────────────────────────────────────────────
    constraints = pattern["constraints"]
    computed    = pattern.get("computed", {})

    for _ in range(retries):
        params  = _make_params(constraints, computed)
        sig     = _params_sig(params)

        if session_sigs is not None and sig in session_sigs:
            continue  # try fresh numbers

        # Format question
        try:
            question = pattern["template"].format(**params)
        except (KeyError, ValueError):
            continue

        # Compute correct answer
        answer = _eval(pattern.get("answer_expr", ""), params)
        if not answer:
            continue

        # Compute distractors
        distractors: List[str] = []
        for expr in pattern.get("distractor_exprs", []):
            d = _eval(expr, params)
            if d and d != answer and d not in distractors:
                distractors.append(d)

        # Fill with nearby integers if needed
        try:
            a_num = float(answer)
            attempts = 0
            while len(distractors) < 3 and attempts < 20:
                attempts += 1
                delta = random.choice([-3, -2, -1, 1, 2, 3])
                d_num = a_num + delta
                if d_num > 0:
                    d_str = str(int(d_num)) if d_num == int(d_num) else f"{d_num:.2f}".rstrip("0").rstrip(".")
                    if d_str != answer and d_str not in distractors:
                        distractors.append(d_str)
        except ValueError:
            pass

        if len(distractors) < 3:
            continue  # not enough distractors

        choices = [answer] + distractors[:3]
        random.shuffle(choices)

        if session_sigs is not None:
            session_sigs.add(sig)

        return {
            "id":       f"{pattern['id']}_{abs(hash(question)) % 100000}",
            "form":     pattern["type"],
            "question": question,
            "choices":  choices[:4],
            "answer":   answer,
            "subtopic": pattern.get("subtopic", ""),
            "difficulty": pattern.get("difficulty", 1),
        }

    return None  # could not generate a unique question


def enforce_variety(questions: List[Dict]) -> List[Dict]:
    """Keep at most one question of each pattern type."""
    seen_types: Set[str] = set()
    unique: List[Dict] = []
    for q in questions:
        t = q.get("form", "unknown")
        if t not in seen_types:
            unique.append(q)
            seen_types.add(t)
    return unique


def get_patterns(subject: str, grade: int, subtopic: str, difficulty: int) -> List[Dict]:
    """Filter patterns by subject, grade (±1), subtopic, and max difficulty."""
    return [
        p for p in _load()
        if p["subject"]  == subject
        and abs(p["grade"] - grade) <= 1
        and p["subtopic"] == subtopic
        and p["difficulty"] <= difficulty
    ]


def generate_quiz_set(
    subject: str,
    grade: int,
    subtopics: List[str],
    skill_level: int,
    count: int,
    session_sigs: Optional[Set[str]] = None,
) -> List[Dict]:
    """
    Generate a diverse, variety-enforced quiz from one or more subtopics.

    Steps:
      1. Collect all matching patterns for given subtopics
      2. Generate 2× requested count as candidates (for variety filtering)
      3. Enforce variety (no repeated pattern types)
      4. Return top N

    Parameters
    ----------
    subtopics   : list of subtopic slugs (multi-subtopic support)
    skill_level : 1–3 max difficulty
    session_sigs: mutable set tracking used param signatures (dedup within session)
    """
    if session_sigs is None:
        session_sigs = set()

    # Gather and shuffle all eligible patterns
    pool: List[Dict] = []
    for subtopic in subtopics:
        pool.extend(get_patterns(subject, grade, subtopic, skill_level))

    if not pool:
        # Fallback: any pattern for this subject/grade
        pool = [
            p for p in _load()
            if p["subject"] == subject
            and abs(p["grade"] - grade) <= 1
            and p["difficulty"] <= skill_level
        ]

    if not pool:
        return []

    random.shuffle(pool)

    # Generate candidates (2× for variety breathing room)
    candidates: List[Dict] = []
    per_pattern = max(2, (count * 2) // (len(pool) or 1)) + 2
    for pattern in pool * per_pattern:
        if len(candidates) >= count * 2:
            break
        q = generate_from_pattern(pattern, session_sigs)
        if q:
            candidates.append(q)

    # Enforce variety then trim
    return enforce_variety(candidates)[:count]
