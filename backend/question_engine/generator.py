"""
generator.py — Individual question form generators.

Each function takes a Fact and returns a Question.
Forms are pure functions — no side effects, easy to test independently.

Form map:
  1 → Direct          (What does X verb?)
  2 → Reverse         (Which category verbs Y?)
  3 → True/False      (X verbs wrong_Y. True or False?)
  4 → Fill-in-Blank   (Fact sentence with Y replaced by ___)
  5 → Category Reverse (Y is verbed by which category?)
  6 → Negative        (Which does NOT verb Y?)
"""

import random
from models import Fact, Question
from utils import pick_wrong_terms, shuffle_choices


# ── Form 1: Direct ─────────────────────────────────────────────────────────────

def form_1(fact: Fact) -> Question:
    """
    Direct question: What does {key_term_1} {verb}?
    Answer: key_term_2
    Wrong: 3 from wrong_term_2_options
    """
    wrongs = pick_wrong_terms(fact.wrong_term_2_options, 3)
    choices = shuffle_choices(fact.key_term_2, wrongs)
    return Question(
        id=fact.id,
        form=1,
        question=f"What does {fact.key_term_1} {fact.verb}?",
        choices=choices,
        answer=fact.key_term_2,
    )


# ── Form 2: Reverse ────────────────────────────────────────────────────────────

def form_2(fact: Fact) -> Question:
    """
    Reverse question: Which {category} {verb}s {key_term_2}?
    Answer: key_term_1
    Wrong: 3 from wrong_terms
    """
    wrongs = pick_wrong_terms(fact.wrong_terms, 3)
    choices = shuffle_choices(fact.key_term_1, wrongs)
    return Question(
        id=fact.id,
        form=2,
        question=f"Which {fact.category} {fact.verb}s {fact.key_term_2}?",
        choices=choices,
        answer=fact.key_term_1,
    )


# ── Form 3: True/False ─────────────────────────────────────────────────────────

def form_3(fact: Fact) -> Question:
    """
    True/False: {key_term_1} {verb}s {random_wrong_term_2}. True or False?
    Answer is always False (the statement is deliberately wrong).
    Choices: ["True", "False"] shuffled.
    """
    wrong_term2 = random.choice(fact.wrong_term_2_options)
    choices = ["True", "False"]
    random.shuffle(choices)
    return Question(
        id=fact.id,
        form=3,
        question=(
            f"{fact.key_term_1} {fact.verb}s {wrong_term2}. True or False?"
        ),
        choices=choices,
        answer="False",
    )


# ── Form 4: Fill-in-Blank ─────────────────────────────────────────────────────

def form_4(fact: Fact) -> Question:
    """
    Fill-in-blank: Replace key_term_2 in the original fact sentence with ___.
    Answer: key_term_2
    Wrong: 3 from wrong_term_2_options
    """
    # Replace the first occurrence of key_term_2 in the fact sentence
    blanked = fact.fact.replace(fact.key_term_2, "___", 1)
    question_text = f"Fill in the blank: {blanked}"

    wrongs = pick_wrong_terms(fact.wrong_term_2_options, 3)
    choices = shuffle_choices(fact.key_term_2, wrongs)
    return Question(
        id=fact.id,
        form=4,
        question=question_text,
        choices=choices,
        answer=fact.key_term_2,
    )


# ── Form 5: Category Reverse ──────────────────────────────────────────────────

def form_5(fact: Fact) -> Question:
    """
    Category reverse: {key_term_2} is {verb}d by which {category}?
    Answer: key_term_1
    Wrong: 3 from wrong_terms
    """
    wrongs = pick_wrong_terms(fact.wrong_terms, 3)
    choices = shuffle_choices(fact.key_term_1, wrongs)
    return Question(
        id=fact.id,
        form=5,
        question=f"{fact.key_term_2} is {fact.verb}d by which {fact.category}?",
        choices=choices,
        answer=fact.key_term_1,
    )


# ── Form 6: Negative ──────────────────────────────────────────────────────────

def form_6(fact: Fact) -> Question:
    """
    Negative: Which of these does NOT {verb} {key_term_2}?
    Answer: one wrong_term (NOT key_term_1, since key_term_1 DOES verb key_term_2).
    Choices: key_term_1 + 3 wrong_terms (one of the wrongs is the answer).

    Strategy:
      - Pick 3 wrong_terms
      - The answer is the first of those 3 (a wrong_term is correct here because
        the question asks which does NOT perform the verb)
      - Choices are: key_term_1 + all 3 wrong_terms (shuffled)
    """
    # Need at least 3 wrong_terms — validated in Fact.__post_init__
    three_wrongs = pick_wrong_terms(fact.wrong_terms, 3)
    # The "correct" answer is one of the wrong_terms (it does NOT verb key_term_2)
    answer = three_wrongs[0]
    # choices = the real doer (key_term_1) + all three wrong terms
    choices = shuffle_choices(answer, [fact.key_term_1] + three_wrongs[1:])
    return Question(
        id=fact.id,
        form=6,
        question=f"Which of these does NOT {fact.verb} {fact.key_term_2}?",
        choices=choices,
        answer=answer,
    )


# ── Dispatcher ────────────────────────────────────────────────────────────────

_FORM_FUNCTIONS = {
    1: form_1,
    2: form_2,
    3: form_3,
    4: form_4,
    5: form_5,
    6: form_6,
}


def generate_form(fact: Fact, form_number: int) -> Question:
    """
    Dispatch to the correct form function by number.
    Raises KeyError for unknown form numbers (safe extension point).
    """
    if form_number not in _FORM_FUNCTIONS:
        raise KeyError(f"Unknown question form: {form_number}. Valid forms: 1–6.")
    return _FORM_FUNCTIONS[form_number](fact)
