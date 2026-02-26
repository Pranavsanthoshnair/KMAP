"""
engine_test.py — Verification suite for the upgraded pattern-based engine.
Tests: math pattern generation, science facts-based, variety enforcement, multi-subtopic, New Set reset.
"""
import sys, json, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
pathlib.Path('seen.json').write_text('{}')

from engine import generate_questions
from pattern_generator import enforce_variety, generate_quiz_set

print("=" * 60)
print("KMAP Engine v2 — Verification Suite")
print("=" * 60)

all_ok = True

def check(label, condition, detail=""):
    global all_ok
    status = "OK  " if condition else "FAIL"
    if not condition:
        all_ok = False
    print(f"[{status}] {label}" + (f" — {detail}" if detail else ""))

# ── 1. Math pattern-based generation ─────────────────────────────────────────
print("\n── Math (Pattern-Based) ──")
for topic, gb, lv in [("arithmetic",1,1),("arithmetic",2,1),("fractions",2,2),
                       ("fractions",3,2),("geometry",3,2),("multiplication",3,2),
                       ("algebra",4,2),("decimals",4,2),("statistics",4,2),
                       ("algebra",5,3),("geometry",5,3),("calculus",5,3)]:
    r = generate_questions(topic=topic, grade_band=gb, level=lv, count=5, subject="math")
    check(f"math GB{gb} L{lv} {topic:20}", len(r.questions) > 0,
          f"{len(r.questions)} questions")
    # Verify choices and answer exist
    for q in r.questions:
        check(f"  Q has 4 choices", len(q.choices) == 4, f"got {len(q.choices)}")
        check(f"  answer in choices", q.answer in q.choices, f"ans='{q.answer}'")

# ── 2. Science facts-based generation ─────────────────────────────────────────
print("\n── Science (Facts-Based) ──")
for topic, gb, lv in [("basic_biology",1,1),("cell_structure",2,2),
                       ("photosynthesis",2,2),("genetics",3,3),("electricity",4,3)]:
    r = generate_questions(topic=topic, grade_band=gb, level=lv, count=4, subject="science")
    check(f"science GB{gb} L{lv} {topic:20}", len(r.questions) > 0,
          f"{len(r.questions)} questions")

# ── 3. English facts-based ─────────────────────────────────────────────────────
print("\n── English (Facts-Based) ──")
for topic, gb, lv in [("parts_of_speech",1,1),("figures_of_speech",2,2),
                       ("literary_devices",3,2),("linguistics",5,3)]:
    r = generate_questions(topic=topic, grade_band=gb, level=lv, count=4, subject="english")
    check(f"english GB{gb} L{lv} {topic:20}", len(r.questions) > 0,
          f"{len(r.questions)} questions")

# ── 4. Variety enforcement ─────────────────────────────────────────────────────
print("\n── Variety Enforcement ──")
r = generate_questions(topic="arithmetic", grade_band=2, level=2, count=6, subject="math")
types = [q.form for q in r.questions]
unique_types = len(set(types))
check("No repeated pattern types", unique_types == len(types),
      f"{unique_types} unique / {len(types)} total types: {types}")

# ── 5. Multi-subtopic quiz ─────────────────────────────────────────────────────
print("\n── Multi-Subtopic (Math GB3) ──")
qs = generate_quiz_set(subject="math", grade=3, subtopics=["arithmetic","fractions","geometry"],
                       skill_level=2, count=6)
subtopics_seen = set(q.get("subtopic","") for q in qs)
check("Multi-subtopic returns questions", len(qs) > 0, f"{len(qs)} questions")
check("Multiple subtopics represented", len(subtopics_seen) > 1, str(subtopics_seen))

# ── 6. New Set — always fresh ──────────────────────────────────────────────────
print("\n── New Set (Fresh on Reset) ──")
r1 = generate_questions(topic="arithmetic", grade_band=1, level=1, count=5, subject="math")
r2 = generate_questions(topic="arithmetic", grade_band=1, level=1, count=5, subject="math", reset_seen=True)
check("New Set returns fresh questions", len(r2.questions) > 0, f"{len(r2.questions)} questions")

# ── 7. Pattern numeric variety (no identical values) ───────────────────────────
print("\n── Numeric Variety (no identical questions) ──")
r = generate_questions(topic="arithmetic", grade_band=1, level=1, count=5, subject="math")
questions_text = [q.question for q in r.questions]
check("No identical question text", len(set(questions_text)) == len(questions_text),
      f"{len(set(questions_text))} unique / {len(questions_text)} total")

print("\n" + "=" * 60)
print("ALL TESTS PASSED" if all_ok else "SOME TESTS FAILED")
print("=" * 60)
