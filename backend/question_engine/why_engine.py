"""
why_engine.py — Parallel Why Engine (decorative only).

Enriches a question dict with per-option "explanations" after generation.
Does not modify question selection, scoring, or any core engine logic.
Uses: (1) tagged misconceptions, (2) subtopic/subject templates, (3) fallback.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional

EXPLANATIONS_FILE = Path(__file__).parent / "explanations.json"
_BANK: Optional[Dict[str, Any]] = None


def _load_bank() -> Dict[str, Any]:
    global _BANK
    if _BANK is None:
        if not EXPLANATIONS_FILE.exists():
            _BANK = {"misconception_templates": {}, "by_subtopic": {}, "by_subject": {}}
        else:
            with open(EXPLANATIONS_FILE, encoding="utf-8") as f:
                _BANK = json.load(f)
    return _BANK


def attach_explanations(
    question: Dict[str, Any],
    *,
    level: int,
    subject: str,
    subtopic: str,
) -> Dict[str, Any]:
    """
    Add an "explanations" map to the question dict.
    Keys "0".."3" → explanation text for each option.
    Does not mutate or remove any existing keys; only adds "explanations".
    """
    choices = question.get("choices", [])[:4]
    answer = question.get("answer", "")
    if not choices:
        question["explanations"] = {}
        return question

    # Correct option index (by value match after shuffle)
    correct_idx: Optional[int] = None
    for i, c in enumerate(choices):
        if c == answer:
            correct_idx = i
            break
    if correct_idx is None:
        correct_idx = 0

    bank = _load_bank()
    templates = bank.get("misconception_templates") or {}
    by_subtopic = bank.get("by_subtopic") or {}
    by_subject = bank.get("by_subject") or {}

    misconceptions = question.get("misconceptions") or {}
    explanations: Dict[str, str] = {}

    for i in range(len(choices)):
        key = str(i)
        if i == correct_idx:
            # Correct option — Layer 3 reinforcement
            explanations[key] = "That's right."
            continue

        # Wrong option — Layer 1, then 2, then 3
        text: Optional[str] = None

        # Layer 1: tagged misconception
        mis_key = misconceptions.get(key)
        if mis_key and mis_key in templates:
            text = templates[mis_key]

        # Layer 2: subtopic or subject template (generic)
        if not text and subtopic and subtopic in by_subtopic:
            tpl = by_subtopic.get(subtopic)
            if isinstance(tpl, str):
                text = tpl.format(answer=answer)
        if not text and subject and subject in by_subject:
            tpl = by_subject.get(subject)
            if isinstance(tpl, str):
                text = tpl.format(answer=answer)

        # Layer 3: fallback
        if not text:
            text = f"The right answer is: {answer}."

        explanations[key] = text

    # Ensure all four slots exist for frontend
    for i in range(4):
        if str(i) not in explanations:
            explanations[str(i)] = "The right answer is: {answer}.".format(answer=answer)

    question["explanations"] = explanations
    return question
