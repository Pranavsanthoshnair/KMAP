"""
models.py — Data models for the Question Generation Engine.

Uses Python dataclasses for clean, type-safe structures.
"""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Fact:
    """
    Represents a single educational fact entry loaded from facts.json.
    All fields mirror the facts.json schema exactly.
    """
    id: str
    fact: str
    subject: str
    topic: str
    grade_band: int          # 1–5 (student grade group)
    level: int               # 1–3 (difficulty)
    key_term_1: str          # Primary subject of the fact (e.g. "Mitochondria")
    key_term_2: str          # Output/result of the fact  (e.g. "ATP")
    verb: str                # Action word linking the two terms (e.g. "produces")
    category: str            # Conceptual category of key_term_1 (e.g. "organelle")
    wrong_terms: List[str]   # Wrong substitutes for key_term_1
    wrong_term_2_options: List[str]  # Wrong substitutes for key_term_2

    def __post_init__(self):
        """Validate mandatory list lengths so form generation never breaks."""
        if len(self.wrong_terms) < 3:
            raise ValueError(
                f"Fact '{self.id}': wrong_terms must have at least 3 items, "
                f"got {len(self.wrong_terms)}."
            )
        if len(self.wrong_term_2_options) < 3:
            raise ValueError(
                f"Fact '{self.id}': wrong_term_2_options must have at least 3 items, "
                f"got {len(self.wrong_term_2_options)}."
            )


@dataclass
class Question:
    """
    Represents a fully generated multiple-choice question ready for output.
    """
    id: str            # Fact ID the question was generated from
    form: int          # Question form number (1–6)
    question: str      # The question text shown to the student
    choices: List[str] # Shuffled list of 4 answer options
    answer: str        # The correct answer (must be one of the choices)

    def to_dict(self) -> dict:
        """Serialize to plain dict for JSON output."""
        return {
            "id": self.id,
            "form": self.form,
            "question": self.question,
            "choices": self.choices,
            "answer": self.answer,
        }


@dataclass
class EngineResult:
    """
    Top-level output returned by generate_questions().
    """
    questions: List[Question] = field(default_factory=list)
    exhausted: bool = False   # True when fewer questions exist than requested

    def to_dict(self) -> dict:
        """Serialize the full result to a plain dict for JSON output."""
        return {
            "questions": [q.to_dict() for q in self.questions],
            "exhausted": self.exhausted,
        }
