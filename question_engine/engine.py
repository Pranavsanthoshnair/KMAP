"""
engine.py — Strict Hierarchical Question Engine v3

Architecture:
  • Single source of truth: question_bank.json
  • Strict validation: subject → grade → subtopic (no silent fallback)
  • Mode A: Subtopic-specific quiz (bank[subject][grade][subtopic] only)
  • Mode B: Subject mixed quiz (even distribution across all subtopics)
  • No cross-subject, cross-grade, or cross-subtopic mixing

Required functions (in order):
  load_bank()               — load question_bank.json (cached)
  validate_request()        — raise ValueError on bad subject/grade/subtopic
  generate_from_pattern()   — single question from one pattern dict
  enforce_variety()         — remove duplicate pattern types from a list
  generate_subtopic_quiz()  — Mode A: only one subtopic
  generate_subject_quiz()   — Mode B: even across all subtopics
"""

import json
import logging
import random
from pathlib import Path
from typing import Dict, List, Optional, Set

log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
BANK_FILE = Path(__file__).parent / "question_bank.json"
_BANK: Optional[Dict] = None

_SAFE = {"abs": abs, "round": round, "max": max, "min": min, "__builtins__": {}}

LEVEL_TO_DIFF = {1: "beginner", 2: "intermediate", 3: "advanced"}

# Within-subtopic only fallback order
DIFF_FALLBACKS = {
    "beginner":     ["beginner", "intermediate"],
    "intermediate": ["intermediate", "beginner", "advanced"],
    "advanced":     ["advanced", "intermediate"],
}


# ── 1. load_bank() ─────────────────────────────────────────────────────────────

def load_bank() -> Dict:
    """Load question_bank.json and cache it in memory."""
    global _BANK
    if _BANK is None:
        with open(BANK_FILE, encoding="utf-8") as f:
            _BANK = json.load(f)
        log.info("Loaded question bank: %d subjects", len(_BANK))
    return _BANK


# ── 2. validate_request() ──────────────────────────────────────────────────────

def validate_request(
    bank: Dict,
    subject: str,
    grade: str,
    subtopic: Optional[str] = None,
) -> None:
    """
    Strict hierarchical validation. Raises ValueError on any mismatch.

    Parameters
    ----------
    bank    : Loaded question bank dict.
    subject : "math" | "science" | "english"
    grade   : "grade1" .. "grade5"
    subtopic: Optional subtopic slug.

    Raises
    ------
    ValueError if subject, grade, or subtopic is invalid.
    """
    if subject not in bank:
        raise ValueError(
            f"Invalid subject '{subject}'. Available: {sorted(bank.keys())}"
        )

    grade_data = bank[subject]
    if grade not in grade_data:
        raise ValueError(
            f"No data for grade '{grade}' in subject '{subject}'. "
            f"Available: {sorted(grade_data.keys())}"
        )

    if subtopic is not None:
        subtopic_data = grade_data[grade]
        if subtopic not in subtopic_data:
            raise ValueError(
                f"Subtopic '{subtopic}' not found in {subject}/{grade}. "
                f"Available: {sorted(subtopic_data.keys())}"
            )


# ── 3. generate_from_pattern() ─────────────────────────────────────────────────

def _eval_safe(expr: str, params: Dict) -> str:
    """Safely evaluate a math expression; returns empty string on failure."""
    try:
        result = eval(str(expr), _SAFE, dict(params))
        if isinstance(result, float):
            return (
                str(int(result)) if result == int(result)
                else f"{result:.4f}".rstrip("0").rstrip(".")
            )
        return str(result)
    except Exception:
        return ""


def generate_from_pattern(
    pattern: Dict,
    session_sigs: Optional[Set[str]] = None,
    retries: int = 12,
) -> Optional[Dict]:
    """
    Generate one question from a pattern dict.

    Static patterns  : have 'answer' + 'distractors' → returned as-is.
    Parametric patterns: have 'constraints' + 'answer_expr' → randomised values.

    Returns None if a fresh, valid question cannot be generated.
    """
    # ── Static pattern (no randomised params) ────────────────────────────────
    if "constraints" not in pattern:
        answer = str(pattern.get("answer", ""))
        wrong  = [str(d) for d in pattern.get("distractors", [])]
        choices = ([answer] + wrong[:3])
        while len(choices) < 4:
            choices.append("None of the above")
        random.shuffle(choices)
        return {
            "id":       pattern["id"],
            "type":     pattern["type"],
            "question": pattern["template"],
            "choices":  choices[:4],
            "answer":   answer,
        }

    # ── Parametric pattern ────────────────────────────────────────────────────
    constraints   = pattern["constraints"]
    computed_defs = pattern.get("computed", {})

    for _ in range(retries):
        # Generate random params
        params: Dict = {
            k: random.randint(int(v[0]), int(v[1]))
            for k, v in constraints.items()
        }
        # Apply computed values
        for k, expr in computed_defs.items():
            try:
                val = eval(str(expr), _SAFE, dict(params))
                params[k] = int(val) if float(val) == int(float(val)) else val
            except Exception:
                pass

        sig = str(sorted(params.items()))
        if session_sigs is not None and sig in session_sigs:
            continue  # duplicate numeric values within session

        # Format question text
        try:
            question = pattern["template"].format(**params)
        except (KeyError, ValueError):
            continue

        # Compute correct answer
        answer = _eval_safe(pattern.get("answer_expr", ""), params)
        if not answer:
            continue

        # Compute distractors
        distractors: List[str] = []
        for expr in pattern.get("distractor_exprs", []):
            d = _eval_safe(expr, params)
            if d and d != answer and d not in distractors:
                distractors.append(d)

        # Fill missing distractors with nearby integers
        try:
            a_num  = float(answer)
            tries_ = 0
            while len(distractors) < 3 and tries_ < 20:
                tries_ += 1
                d_num = a_num + random.choice([-3, -2, -1, 1, 2, 3])
                if d_num > 0:
                    d_str = (
                        str(int(d_num)) if d_num == int(d_num)
                        else f"{d_num:.4f}".rstrip("0").rstrip(".")
                    )
                    if d_str != answer and d_str not in distractors:
                        distractors.append(d_str)
        except ValueError:
            pass

        if len(distractors) < 3:
            continue  # can't build enough choices

        choices = [answer] + distractors[:3]
        random.shuffle(choices)

        if session_sigs is not None:
            session_sigs.add(sig)

        return {
            "id":       f"{pattern['id']}_{abs(hash(question)) % 100000}",
            "type":     pattern["type"],
            "question": question,
            "choices":  choices[:4],
            "answer":   answer,
        }

    return None  # exhausted retries


# ── 4. enforce_variety() ───────────────────────────────────────────────────────

def enforce_variety(questions: List[Dict]) -> List[Dict]:
    """
    Remove duplicate pattern types within a quiz set.
    Keeps the first occurrence of each type (highest-scored candidate).
    """
    seen: Set[str] = set()
    unique: List[Dict] = []
    for q in questions:
        t = q.get("type", "unknown")
        if t not in seen:
            unique.append(q)
            seen.add(t)
    return unique


# ── Internal helpers ───────────────────────────────────────────────────────────

def _patterns_for_subtopic(
    bank: Dict,
    subject: str,
    grade: str,
    subtopic: str,
    skill_level: int,
) -> List[Dict]:
    """
    Return patterns for (subject, grade, subtopic) filtered by difficulty.
    Fallback order stays WITHIN THE SAME SUBTOPIC ONLY.
    """
    target_diff = LEVEL_TO_DIFF.get(skill_level, "beginner")
    all_pats    = bank[subject][grade][subtopic]["patterns"]

    for diff in DIFF_FALLBACKS[target_diff]:
        filtered = [p for p in all_pats if p["difficulty"] == diff]
        if filtered:
            if diff != target_diff:
                log.info(
                    "Difficulty fallback within %s/%s/%s: %s → %s",
                    subject, grade, subtopic, target_diff, diff,
                )
            return filtered

    return all_pats   # all difficulties as absolute last resort (same subtopic)


def _generate_n_from_pool(
    pool: List[Dict],
    count: int,
    session_sigs: Set[str],
) -> List[Dict]:
    """Generate up to 2×count candidates, then enforce variety and trim to count."""
    random.shuffle(pool)
    target     = count * 2
    expanded   = pool * (max(2, target // max(len(pool), 1)) + 2)
    random.shuffle(expanded)

    candidates: List[Dict] = []
    for pattern in expanded:
        if len(candidates) >= target:
            break
        q = generate_from_pattern(pattern, session_sigs)
        if q:
            candidates.append(q)

    return enforce_variety(candidates)[:count]


# ── 5. generate_subtopic_quiz() — MODE A ──────────────────────────────────────

def generate_subtopic_quiz(
    bank: Dict,
    subject: str,
    grade: str,
    subtopic: str,
    skill_level: int,
    count: int,
    session_sigs: Optional[Set[str]] = None,
) -> List[Dict]:
    """
    MODE A — Subtopic-Specific Quiz.

    Generates questions EXCLUSIVELY from bank[subject][grade][subtopic].
    No other subtopics, no other grades, no other subjects.

    Raises ValueError for any invalid parameter combination.
    """
    validate_request(bank, subject, grade, subtopic)

    # Defensive subject assertion — no fallback allowed
    assert subject in bank, f"BUG: subject '{subject}' not in bank after validation"

    if session_sigs is None:
        session_sigs = set()

    pool = _patterns_for_subtopic(bank, subject, grade, subtopic, skill_level)
    result = _generate_n_from_pool(pool, count, session_sigs)

    log.info(
        "[Mode A] %s/%s/%s skill=%d → requested=%d generated=%d",
        subject, grade, subtopic, skill_level, count, len(result),
    )
    return result


# ── 6. generate_subject_quiz() — MODE B ───────────────────────────────────────

def generate_subject_quiz(
    bank: Dict,
    subject: str,
    grade: str,
    skill_level: int,
    count: int,
    session_sigs: Optional[Set[str]] = None,
) -> List[Dict]:
    """
    MODE B — Subject Mixed Quiz.

    Divides 'count' evenly across ALL subtopics in subject/grade.
    Each subtopic contributes independently via generate_subtopic_quiz().
    No subtopic dominance. No cross-subject or cross-grade mixing.

    Example: 4 subtopics, 8 questions → 2 per subtopic.

    Raises ValueError for any invalid parameter combination.
    """
    validate_request(bank, subject, grade)

    # Defensive assertion
    assert subject in bank, f"BUG: subject '{subject}' not in bank after validation"

    if session_sigs is None:
        session_sigs = set()

    subtopics  = list(bank[subject][grade].keys())
    n_subs     = len(subtopics)
    per_sub    = max(1, count // n_subs)
    remainder  = count - (per_sub * n_subs)  # distribute extras to first N subtopics

    all_qs: List[Dict] = []
    for i, subtopic in enumerate(subtopics):
        n = per_sub + (1 if i < remainder else 0)
        qs = generate_subtopic_quiz(
            bank, subject, grade, subtopic, skill_level, n, session_sigs
        )
        all_qs.extend(qs)

    random.shuffle(all_qs)

    log.info(
        "[Mode B] %s/%s skill=%d → %d subtopics, %d per sub, generated=%d",
        subject, grade, skill_level, n_subs, per_sub, len(all_qs),
    )
    return all_qs[:count]


# ── Legacy compatibility shim ─────────────────────────────────────────────────
# Keeps existing run.py interface working while using the new engine.

def _grade_key(grade_band: int) -> str:
    """Convert numeric grade_band (1–5) to grade key string ("grade1" etc.)."""
    return f"grade{grade_band}"


def _infer_subject(topic: str, subject_hint: Optional[str]) -> str:
    """Infer subject from a topic slug when not explicitly provided."""
    if subject_hint:
        return subject_hint.lower().strip()

    _MATH = {
        "arithmetic", "fractions", "geometry", "algebra", "decimals",
        "statistics", "calculus", "trigonometry", "multiplication",
        "counting", "probability", "number_theory", "linear_equations",
    }
    _SCI = {
        "basic_biology", "cell_structure", "photosynthesis", "genetics",
        "chemical_reactions", "electricity", "forces", "ecology",
        "human_body", "states_of_matter", "microbiology", "astronomy",
        "evolution", "periodic_table", "acids_bases", "wave_optics",
    }
    _ENG = {
        "parts_of_speech", "figures_of_speech", "literary_devices",
        "grammar", "punctuation", "sentence_structure", "linguistics",
        "advanced_writing", "reading_comprehension", "vocabulary",
        "poetry", "prose", "narrative", "rhetoric", "advanced_grammar",
    }

    t = (topic or "").lower()
    if t in _MATH or t.startswith("math"):
        return "math"
    if t in _SCI or t.startswith("sci"):
        return "science"
    if t in _ENG or t.startswith("eng"):
        return "english"
    return "science"  # only used as hard last-resort


def generate_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    seed: Optional[int] = None,
    reset_seen: bool = False,       # kept for API compat; bank-mode is stateless
    subject: Optional[str] = None,
    subtopics: Optional[List[str]] = None,
    mode: str = "subtopic",         # "subtopic" | "subject"
    session_sigs: Optional[Set[str]] = None,
) -> Dict:
    """
    Unified entry point — called by run.py.

    Routes to:
      MODE A (mode="subtopic"): generate_subtopic_quiz for topic/subtopics[0]
      MODE B (mode="subject"):  generate_subject_quiz across entire grade

    Returns a plain dict: {"questions": [...], "exhausted": bool}
    """
    if seed is not None:
        random.seed(seed)

    bank  = load_bank()
    grade = _grade_key(grade_band)
    subj  = _infer_subject(topic, subject)

    # Resolve the primary subtopic
    primary = (subtopics[0] if subtopics else None) or topic

    # Validate before any generation
    try:
        if mode == "subject":
            validate_request(bank, subj, grade)
        else:
            validate_request(bank, subj, grade, primary)
    except ValueError as e:
        log.error("Validation failed: %s", e)
        return {"questions": [], "exhausted": True, "error": str(e)}

    if session_sigs is None:
        session_sigs = set()

    try:
        if mode == "subject":
            raw_qs = generate_subject_quiz(bank, subj, grade, level, count, session_sigs)
        else:
            raw_qs = generate_subtopic_quiz(bank, subj, grade, primary, level, count, session_sigs)
    except ValueError as e:
        log.error("Generation error: %s", e)
        return {"questions": [], "exhausted": True, "error": str(e)}

    # Convert to wire format
    questions = [
        {
            "id":       q["id"],
            "form":     q["type"],
            "question": q["question"],
            "choices":  q["choices"],
            "answer":   q["answer"],
        }
        for q in raw_qs
    ]

    return {"questions": questions, "exhausted": len(questions) < count}
