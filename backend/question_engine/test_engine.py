"""
test_engine.py — Verification tests for the Question Generation Engine.
Run from within the question_engine/ directory: python test_engine.py
"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from engine import generate_questions

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    print(f"  [{status}] {name}{(' — ' + detail) if detail else ''}")
    results.append(condition)

# ── Reset seen.json before tests ──────────────────────────────────────────────
seen_path = pathlib.Path(__file__).parent / "seen.json"
seen_path.write_text("{}")

# ── Test 1: Basic generation ───────────────────────────────────────────────────
print("\n=== Test 1: Basic generation ===")
r = generate_questions(topic="cell_structure", grade_band=2, level=2, count=5)
check("Returns 5 questions",        len(r.questions) == 5)
check("exhausted is False",         r.exhausted is False)
check("Each question has 4 choices", all(len(q.choices) == 4 for q in r.questions))
check("Answer is in choices",        all(q.answer in q.choices for q in r.questions))
check("Form is 1–4 for level=2",     all(1 <= q.form <= 4 for q in r.questions))

# ── Test 2: Repetition prevention ─────────────────────────────────────────────
print("\n=== Test 2: Repetition prevention ===")
seen_path.write_text("{}")
r1 = generate_questions(topic="cell_structure", grade_band=2, level=2, count=5, seed=7)
r2 = generate_questions(topic="cell_structure", grade_band=2, level=2, count=5, seed=7)
pairs1 = {(q.id, q.form) for q in r1.questions}
pairs2 = {(q.id, q.form) for q in r2.questions}
check("No (id, form) repeats across runs", pairs1.isdisjoint(pairs2),
      f"r1={sorted(pairs1)}, r2={sorted(pairs2)}")

# ── Test 3: Exhaustion ─────────────────────────────────────────────────────────
print("\n=== Test 3: Exhaustion ===")
seen_path.write_text("{}")
r3 = generate_questions(topic="cell_structure", grade_band=2, level=2, count=999)
check("exhausted=True when count > pool", r3.exhausted is True)
check("Still returns all available questions", len(r3.questions) > 0)

# ── Test 4: Level filtering ────────────────────────────────────────────────────
print("\n=== Test 4: Level filtering ===")
seen_path.write_text("{}")
r4 = generate_questions(topic="cell_structure", grade_band=2, level=1, count=10)
check("Level 1 only uses forms 1 and 4", all(q.form in (1, 4) for q in r4.questions),
      f"forms used: {sorted({q.form for q in r4.questions})}")

# ── Test 5: Level 3 allows all forms ──────────────────────────────────────────
print("\n=== Test 5: All forms at level 3 ===")
seen_path.write_text("{}")
r5 = generate_questions(topic="cell_structure", grade_band=2, level=3, count=50)
forms_used = {q.form for q in r5.questions}
check("Forms 5 or 6 appear at level 3", bool(forms_used & {5, 6}),
      f"forms used: {sorted(forms_used)}")

# ── Test 6: Deterministic mode ────────────────────────────────────────────────
print("\n=== Test 6: Deterministic mode (seed) ===")
seen_path.write_text("{}")
ra = generate_questions(topic="cell_structure", grade_band=2, level=2, count=3, seed=42)
seen_path.write_text("{}")
rb = generate_questions(topic="cell_structure", grade_band=2, level=2, count=3, seed=42)
check("Same seed → same questions",
      [q.to_dict() for q in ra.questions] == [q.to_dict() for q in rb.questions])

# ── Test 7: Performance (<1 second for 50 questions) ─────────────────────────
print("\n=== Test 7: Performance ===")
seen_path.write_text("{}")
t0 = time.perf_counter()
generate_questions(topic="cell_structure", grade_band=2, level=3, count=50)
elapsed = time.perf_counter() - t0
check(f"50 questions in <1 second ({elapsed:.4f}s)", elapsed < 1.0)

# ── Test 8: Missing topic → exhausted, no crash ───────────────────────────────
print("\n=== Test 8: No matching facts ===")
seen_path.write_text("{}")
r8 = generate_questions(topic="nonexistent_topic", grade_band=2, level=2, count=5)
check("No match → exhausted=True",   r8.exhausted is True)
check("No match → 0 questions",      len(r8.questions) == 0)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*40}")
passed = sum(results)
print(f"Result: {passed}/{len(results)} checks passed.")
if passed == len(results):
    print("All tests PASSED ✓")
else:
    print("Some tests FAILED ✗")
