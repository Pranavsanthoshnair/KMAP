"""
engine.py — Strict Hierarchical Question Engine v3 (clean)

Architecture:
  • Single source of truth: question_bank.json
  • load_bank / validate_request / generate_from_pattern / enforce_variety
  • generate_single_subtopic_question — safe fallback for any missing subtopic
  • generate_subtopic_quiz (Mode A) — one subtopic only, fallback if not in bank
  • generate_subject_quiz  (Mode B) — even distribution across all subtopics
"""

import json
import hashlib
import logging
import random
from pathlib import Path
from typing import Dict, List, Optional, Set

from why_engine import attach_explanations as attach_why_explanations

log = logging.getLogger(__name__)

BANK_FILE = Path(__file__).parent / "question_bank.json"
VALID_TOPICS_FILE = Path(__file__).parent / "valid_topics.json"
_BANK: Optional[Dict] = None
LEVEL_TO_DIFF = {1: "beginner", 2: "intermediate", 3: "advanced"}
DIFF_FALLBACKS = {
    "beginner":     ["beginner", "intermediate"],
    "intermediate": ["intermediate", "beginner", "advanced"],
    "advanced":     ["advanced", "intermediate"],
}

def gcd(a, b) -> int:
    a = abs(int(a))
    b = abs(int(b))
    while b:
        a, b = b, a % b
    return a

_SAFE = {
    "abs": abs,
    "round": round,
    "max": max,
    "min": min,
    "int": int,
    "str": str,
    "gcd": gcd,
    "__builtins__": {},
}

def _stable_id_suffix(text: str) -> str:
    """
    Python's built-in hash() is salted per process, so it changes between runs.
    Use a stable digest so question IDs remain consistent across sessions.
    """
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


# ─────────────────────────────────────────────────────────────────────────────
# 1. load_bank
# ─────────────────────────────────────────────────────────────────────────────

def load_bank() -> Dict:
    """
    Load the question bank and, if available, intersect it with valid_topics.json.

    In earlier versions the engine failed hard when valid_topics.json was missing
    or produced an empty intersection for a subject/grade, which caused
    {\"questions\": []} errors even when question_bank.json contained valid data.

    To keep question generation robust (and independent of Supabase state) we now:
      - Always load question_bank.json first.
      - If valid_topics.json exists and yields matches for a subject/grade, we
        filter to those subtopics.
      - If valid_topics.json is missing or has no entries for a subject/grade,
        we fall back to the raw bank for that subject/grade instead of dropping it.
    """
    global _BANK
    if _BANK is None:
        with open(BANK_FILE, encoding="utf-8") as f:
            raw_bank = json.load(f)
        log.info("Loaded question bank: %d subjects", len(raw_bank))

        if VALID_TOPICS_FILE.exists():
            try:
                with open(VALID_TOPICS_FILE, encoding="utf-8") as f:
                    valid = json.load(f)
            except Exception as e:
                log.warning("valid_topics.json unreadable (%s); using full bank.", e)
                _BANK = raw_bank
                return _BANK

            filtered: Dict = {}
            for subject, grades in raw_bank.items():
                subj_valid = valid.get(subject) or {}
                # If subject not in valid, keep its grades as-is (no filtering).
                if subject not in valid:
                    filtered[subject] = grades
                    continue

                kept_grades: Dict = {}
                for grade_key, subtopics_data in grades.items():
                    valid_subtopics = set(subj_valid.get(grade_key) or [])
                    if not valid_subtopics:
                        # No valid_topics entry for this grade → keep all subtopics.
                        kept_grades[grade_key] = subtopics_data
                        continue
                    kept = {st: data for st, data in subtopics_data.items() if st in valid_subtopics}
                    if kept:
                        kept_grades[grade_key] = kept
                # If filtering removed everything for this subject, fall back to raw.
                filtered[subject] = kept_grades or grades

            _BANK = filtered
            log.info("Filtered bank to valid_topics where available: %d subjects", len(_BANK))
        else:
            log.warning("valid_topics.json not found; using full question bank without filtering.")
            _BANK = raw_bank

    return _BANK


# ─────────────────────────────────────────────────────────────────────────────
# 2. validate_request
# ─────────────────────────────────────────────────────────────────────────────

def validate_request(
    bank: Dict,
    subject: str,
    grade: str,
    subtopic: Optional[str] = None,
) -> None:
    """Strict validation. Raises ValueError if subject/grade/subtopic not found."""
    if subject not in bank:
        raise ValueError(f"Invalid subject '{subject}'. Available: {sorted(bank.keys())}")
    if grade not in bank[subject]:
        raise ValueError(
            f"Grade '{grade}' not found for subject '{subject}'. "
            f"Available: {sorted(bank[subject].keys())}"
        )
    if subtopic is not None and subtopic not in bank[subject][grade]:
        raise ValueError(
            f"Subtopic '{subtopic}' not found in {subject}/{grade}. "
            f"Available: {sorted(bank[subject][grade].keys())}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3. generate_from_pattern
# ─────────────────────────────────────────────────────────────────────────────

def _eval_safe(expr: str, params: Dict) -> str:
    try:
        result = eval(str(expr), _SAFE, dict(params))
        if isinstance(result, float):
            return str(int(result)) if result == int(result) else f"{result:.4f}".rstrip("0").rstrip(".")
        return str(result)
    except Exception:
        return ""


def generate_from_pattern(
    pattern: Dict,
    session_sigs: Optional[Set[str]] = None,
    retries: int = 12,
) -> Optional[Dict]:
    """Generate one question from a pattern. Returns None if unsuccessful."""

    # Static pattern (no randomised params)
    if "constraints" not in pattern:
        answer = str(pattern.get("answer", ""))
        wrong  = [str(d) for d in pattern.get("distractors", [])]
        choices = ([answer] + wrong[:3])
        while len(choices) < 4:
            choices.append("None of the above")
        random.shuffle(choices)
        out = {
            "id":       pattern["id"],
            "type":     pattern["type"],
            "question": pattern["template"],
            "choices":  choices[:4],
            "answer":   answer,
        }
        if "misconceptions" in pattern:
            out["misconceptions"] = pattern["misconceptions"]
        return out

    # Parametric pattern
    constraints   = pattern["constraints"]
    computed_defs = pattern.get("computed", {})

    for _ in range(retries):
        params: Dict = {k: random.randint(int(v[0]), int(v[1])) for k, v in constraints.items()}
        for k, expr in computed_defs.items():
            try:
                val = eval(str(expr), _SAFE, dict(params))
                params[k] = int(val) if float(val) == int(float(val)) else val
            except Exception:
                pass

        sig = str(sorted(params.items()))
        if session_sigs is not None and sig in session_sigs:
            continue

        try:
            question_text = pattern["template"].format(**params)
        except (KeyError, ValueError):
            continue

        answer = _eval_safe(pattern.get("answer_expr", ""), params)
        if not answer:
            continue

        distractors: List[str] = []
        for expr in pattern.get("distractor_exprs", []):
            d = _eval_safe(expr, params)
            if d and d != answer and d not in distractors:
                distractors.append(d)

        try:
            a_num = float(answer)
            attempts = 0
            while len(distractors) < 3 and attempts < 20:
                attempts += 1
                d_num = a_num + random.choice([-3, -2, -1, 1, 2, 3])
                if d_num > 0:
                    d_str = str(int(d_num)) if d_num == int(d_num) else f"{d_num:.4f}".rstrip("0").rstrip(".")
                    if d_str != answer and d_str not in distractors:
                        distractors.append(d_str)
        except ValueError:
            pass

        if len(distractors) < 3:
            continue

        choices = [answer] + distractors[:3]
        random.shuffle(choices)
        if session_sigs is not None:
            session_sigs.add(sig)

        out = {
            "id":       f"{pattern['id']}_{_stable_id_suffix(question_text)}",
            "type":     pattern["type"],
            "question": question_text,
            "choices":  choices[:4],
            "answer":   answer,
        }
        if "misconceptions" in pattern:
            out["misconceptions"] = pattern["misconceptions"]
        return out

    return None


# ─────────────────────────────────────────────────────────────────────────────
# 4. enforce_variety
# ─────────────────────────────────────────────────────────────────────────────

def enforce_variety(questions: List[Dict]) -> List[Dict]:
    """Remove duplicate pattern types — keep first occurrence of each type."""
    seen: Set[str] = set()
    unique: List[Dict] = []
    for q in questions:
        t = q.get("type", "unknown")
        if t not in seen:
            unique.append(q)
            seen.add(t)
    return unique


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _patterns_for_subtopic(bank, subject, grade, subtopic, skill_level):
    target = LEVEL_TO_DIFF.get(skill_level, "beginner")
    all_p  = bank[subject][grade][subtopic]["patterns"]
    for diff in DIFF_FALLBACKS[target]:
        filtered = [p for p in all_p if p["difficulty"] == diff]
        if filtered:
            return filtered
    return all_p


def _generate_n_from_pool(pool, count, session_sigs):
    random.shuffle(pool)
    target   = count * 2
    expanded = pool * (max(2, target // max(len(pool), 1)) + 2)
    random.shuffle(expanded)
    candidates: List[Dict] = []
    for pattern in expanded:
        if len(candidates) >= target:
            break
        q = generate_from_pattern(pattern, session_sigs)
        if q:
            candidates.append(q)
    return enforce_variety(candidates)[:count]


# ─────────────────────────────────────────────────────────────────────────────
# generate_single_subtopic_question — safe fallback
# ─────────────────────────────────────────────────────────────────────────────

def generate_single_subtopic_question(
    subject: str,
    grade: str,
    subtopic: str,
    skill_level: int,
) -> Dict:
    """
    Generates ONE safe placeholder question for any subtopic not in the bank.
    Never mixes subjects, grades, or subtopics.
    """
    disp  = subtopic.replace("_", " ").title()
    gdisp = grade.replace("grade", "Grade ")

    if subject.lower() == "math":
        # Concept-style fallback so each subtopic still feels distinct even
        # when we have no explicit patterns for it.
        answer = disp
        pool = [
            "Fractions", "Geometry", "Algebra", "Statistics",
            "Decimals", "Number Theory", "Probability",
        ]
        wrongs = [w for w in pool if w != answer][:3]
        # Ensure we always have at least three distractors.
        while len(wrongs) < 3:
            filler = f"Concept {len(wrongs) + 1}"
            if filler not in wrongs and filler != answer:
                wrongs.append(filler)
        choices = [answer] + wrongs[:3]
        random.shuffle(choices)
        return {
            "id":       f"fallback_{subject}_{grade}_{subtopic}",
            "type":     "auto_generated",
            "question": f"Which concept is most closely related to {disp} in {gdisp} Maths?",
            "choices":  choices[:4],
            "answer":   answer,
        }

    if subject.lower() == "science":
        answer  = disp
        wrongs  = [w for w in ["Photosynthesis", "Cell Division", "Gravity", "Osmosis"] if w != answer][:3]
        choices = [answer] + wrongs
        random.shuffle(choices)
        return {
            "id":       f"fallback_{subject}_{grade}_{subtopic}",
            "type":     "auto_generated",
            "question": f"Which of the following best describes the study of {disp} in {gdisp}?",
            "choices":  choices[:4],
            "answer":   answer,
        }

    # English / default
    answer  = disp
    wrongs  = [w for w in ["Metaphor", "Noun", "Punctuation", "Clause"] if w != answer][:3]
    choices = [answer] + wrongs
    random.shuffle(choices)
    return {
        "id":       f"fallback_{subject}_{grade}_{subtopic}",
        "type":     "auto_generated",
        "question": f"What is the core concept studied in '{disp}' for {gdisp} English?",
        "choices":  choices[:4],
        "answer":   answer,
    }


# ─────────────────────────────────────────────────────────────────────────────
# get_question_for_subtopic — strict lookup returning exactly ONE question
# ─────────────────────────────────────────────────────────────────────────────

def get_question_for_subtopic(
    bank: Dict,
    subject: str,
    grade: str,
    subtopic: str,
    skill_level: int,
) -> Dict:
    """
    Returns exactly ONE question for subtopic.
    Bank lookup first; fallback for missing subtopics (subject+grade still validated).
    """
    validate_request(bank, subject, grade)  # subject + grade only
    try:
        pats = bank[subject][grade][subtopic]["patterns"]
        if pats:
            q = generate_from_pattern(random.choice(pats))
            if q:
                return q
    except KeyError:
        pass
    return generate_single_subtopic_question(subject, grade, subtopic, skill_level)


# ─────────────────────────────────────────────────────────────────────────────
# 5. generate_subtopic_quiz — MODE A
# ─────────────────────────────────────────────────────────────────────────────

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
    MODE A — questions from exactly one subtopic.
    Uses safe fallback if subtopic is not in question_bank.json.
    Raises ValueError only for invalid subject or grade.
    """
    validate_request(bank, subject, grade)   # subject + grade only
    assert subject in bank

    if session_sigs is None:
        session_sigs = set()

    # Subtopic not in bank → safe fallback (same subject/grade, no mixing)
    if subtopic not in bank.get(subject, {}).get(grade, {}):
        log.info("[A] '%s' not in bank for %s/%s — fallback", subtopic, subject, grade)
        return [
            dict(generate_single_subtopic_question(subject, grade, subtopic, skill_level),
                 id=f"fallback_{subject}_{grade}_{subtopic}_{i}")
            for i in range(count)
        ]

    pool   = _patterns_for_subtopic(bank, subject, grade, subtopic, skill_level)
    result = _generate_n_from_pool(pool, count, session_sigs)

    if not result:
        log.warning("[A] Empty pool after generation — fallback")
        return [generate_single_subtopic_question(subject, grade, subtopic, skill_level)
                for _ in range(count)]

    log.info("[A] %s/%s/%s lv=%d → %d Qs", subject, grade, subtopic, skill_level, len(result))
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 6. generate_subject_quiz — MODE B
# ─────────────────────────────────────────────────────────────────────────────

def generate_subject_quiz(
    bank: Dict,
    subject: str,
    grade: str,
    skill_level: int,
    count: int,
    session_sigs: Optional[Set[str]] = None,
) -> List[Dict]:
    """
    MODE B — evenly distributed across ALL subtopics in subject/grade.
    No subtopic dominance. No cross-subject or cross-grade mixing.
    """
    validate_request(bank, subject, grade)
    assert subject in bank

    if session_sigs is None:
        session_sigs = set()

    subtopics = list(bank[subject][grade].keys())
    n_subs    = len(subtopics)
    per_sub   = max(1, count // n_subs)
    remainder = count - (per_sub * n_subs)

    all_qs: List[Dict] = []
    for i, st in enumerate(subtopics):
        n  = per_sub + (1 if i < remainder else 0)
        qs = generate_subtopic_quiz(bank, subject, grade, st, skill_level, n, session_sigs)
        all_qs.extend(qs)

    random.shuffle(all_qs)
    log.info("[B] %s/%s lv=%d → %d subtopics, %d Qs", subject, grade, skill_level, n_subs, len(all_qs))
    return all_qs[:count]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers for run.py / API compat
# ─────────────────────────────────────────────────────────────────────────────

def _grade_key(grade_band: int) -> str:
    return f"grade{grade_band}"


def _infer_subject(topic: str, hint: Optional[str]) -> str:
    if hint:
        return hint.lower().strip()
    _MATH = {"arithmetic","fractions","geometry","algebra","decimals","statistics",
              "calculus","trigonometry","multiplication","counting","probability",
              "number_theory","linear_equations"}
    _SCI  = {"basic_biology","cell_structure","photosynthesis","genetics",
              "chemical_reactions","electricity","forces","ecology","human_body",
              "states_of_matter","microbiology","astronomy","evolution",
              "periodic_table","acids_bases","wave_optics"}
    _ENG  = {"parts_of_speech","figures_of_speech","literary_devices","grammar",
              "punctuation","sentence_structure","linguistics","advanced_writing",
              "reading_comprehension","vocabulary","poetry","prose","narrative",
              "rhetoric","advanced_grammar"}
    t = (topic or "").lower()
    if t in _MATH or t.startswith("math"):   return "math"
    if t in _SCI  or t.startswith("sci"):    return "science"
    if t in _ENG  or t.startswith("eng"):    return "english"
    return "science"


def generate_questions(
    topic: str,
    grade_band: int,
    level: int,
    count: int,
    seed: Optional[int] = None,
    reset_seen: bool = False,
    subject: Optional[str] = None,
    subtopics: Optional[List[str]] = None,
    mode: str = "subtopic",
    session_sigs: Optional[Set[str]] = None,
) -> Dict:
    """
    Main entry point called by run.py.
    Routes to Mode A (subtopic) or Mode B (subject).
    Returns {"questions": [...], "exhausted": bool}.
    """
    if seed is not None:
        random.seed(seed)

    bank    = load_bank()
    grade   = _grade_key(grade_band)
    subj    = _infer_subject(topic, subject)
    primary = (subtopics[0] if subtopics else None) or topic

    # Validate subject + grade (subtopic handled by generate_subtopic_quiz).
    # If the exact grade key is missing but neighbouring grades exist for the
    # same subject, fall back to the closest available grade to avoid hard
    # failures when the bank is slightly out of sync with UI grade bands.
    try:
        validate_request(bank, subj, grade)
    except ValueError as e:
        grades_for_subject = sorted(bank.get(subj, {}).keys())
        if not grades_for_subject:
            log.error("Validation failed (no grades for subject %s): %s", subj, e)
            return {"questions": [], "exhausted": True, "error": str(e)}

        target_num = grade_band
        def _grade_to_num(g: str) -> int:
            try:
                return int(str(g).replace("grade", ""))
            except ValueError:
                return target_num

        closest = min(grades_for_subject, key=lambda g: abs(_grade_to_num(g) - target_num))
        log.warning(
            "Grade key %s missing for subject %s, falling back to closest existing grade %s",
            grade,
            subj,
            closest,
        )
        grade = closest

    if session_sigs is None:
        session_sigs = set()

    try:
        raw_qs = (
            generate_subject_quiz(bank, subj, grade, level, count, session_sigs)
            if mode == "subject"
            else generate_subtopic_quiz(bank, subj, grade, primary, level, count, session_sigs)
        )
    except ValueError as e:
        log.error("Generation error: %s", e)
        return {"questions": [], "exhausted": True, "error": str(e)}

    questions = []
    for q in raw_qs:
        choices = q.get("choices", [])[:4]
        answer = q.get("answer", "")
        question_dict = {
            "id": q["id"],
            "form": q["type"],
            "question": q["question"],
            "choices": choices,
            "answer": answer,
        }
        if "misconceptions" in q:
            question_dict["misconceptions"] = q["misconceptions"]
        attach_why_explanations(
            question_dict,
            level=level,
            subject=subj,
            subtopic=primary,
        )
        questions.append(question_dict)
    return {"questions": questions, "exhausted": len(questions) < count}
