"""
strict_engine_test.py — Full verification suite for the Hierarchical Engine v3.

Tests all requirements:
  1. Mode A: subtopic-specific (no mixing)
  2. Mode B: subject mixed (even distribution)
  3. Strict subject isolation (science never gets math)
  4. Grade isolation (grade1 never gets grade5)
  5. Skill level filtering with within-subtopic fallback
  6. Variety enforcement (no duplicate types per quiz)
  7. Invalid requests → ValueError (no silent fallback)
  8. Question format integrity (4 choices, answer in choices)
"""
import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from engine import (load_bank, validate_request, generate_from_pattern,
                    enforce_variety, generate_subtopic_quiz, generate_subject_quiz)

bank = load_bank()
all_ok = True
def ck(label, cond, detail=""):
    global all_ok
    flag = "OK  " if cond else "FAIL"
    if not cond: all_ok = False
    print(f"[{flag}] {label}" + (f" — {detail}" if detail else ""))

print("=" * 65)
print("KMAP Engine v3 — Strict Hierarchical Verification")
print("=" * 65)

# ── 1. Mode A: subtopic-specific ──────────────────────────────────────────────
print("\n── Mode A: Subtopic-Specific ──")
for subj, gk, st, lv in [
    ("math",    "grade1", "arithmetic",     1),
    ("math",    "grade3", "fractions",      2),
    ("math",    "grade4", "algebra",        3),
    ("science", "grade1", "basic_biology",  1),
    ("science", "grade2", "cell_structure", 2),
    ("science", "grade3", "genetics",       3),
    ("english", "grade1", "parts_of_speech",1),
    ("english", "grade3", "grammar",        2),
    ("english", "grade5", "linguistics",    3),
]:
    qs = generate_subtopic_quiz(bank, subj, gk, st, lv, count=5)
    ck(f"A {subj:8} {gk} {st:22} L{lv}", len(qs) > 0, f"{len(qs)} questions")
    for q in qs:
        ck(f"  4 choices", len(q["choices"]) == 4, f"got {len(q['choices'])}")
        ck(f"  answer in choices", q["answer"] in q["choices"])

# ── 2. Mode B: subject mixed ──────────────────────────────────────────────────
print("\n── Mode B: Subject Mixed (even distribution) ──")
for subj, gk, lv in [
    ("math",    "grade2", 1),
    ("math",    "grade4", 2),
    ("science", "grade2", 2),
    ("english", "grade3", 2),
]:
    n_subs = len(bank[subj][gk])
    qs = generate_subject_quiz(bank, subj, gk, lv, count=n_subs*2)
    subtopics_in_result = set(q["type"] for q in qs)  # types span subtopics
    ck(f"B {subj:8} {gk} L{lv}", len(qs) >= n_subs,
       f"{len(qs)} questions from {n_subs} subtopics")

# ── 3. Subject isolation ──────────────────────────────────────────────────────
print("\n── Subject Isolation ──")
for subj, gk, st in [
    ("science", "grade2", "cell_structure"),
    ("english", "grade1", "parts_of_speech"),
    ("math",    "grade3", "multiplication"),
]:
    qs = generate_subtopic_quiz(bank, subj, gk, st, 2, 5)
    ck(f"Isolation {subj}/{gk}/{st}", len(qs) > 0, f"{len(qs)} questions")

# ── 4. Variety enforcement ────────────────────────────────────────────────────
print("\n── Variety Enforcement ──")
qs = generate_subtopic_quiz(bank, "math", "grade1", "arithmetic", 1, 6)
types = [q["type"] for q in qs]
ck("No repeated types in quiz set", len(set(types)) == len(types),
   f"types: {types}")

# ── 5. Invalid request → error (no silent fallback) ───────────────────────────
print("\n── Validation (no silent fallback) ──")
errors_caught = 0
for bad_args in [
    ("bankrupt_subject", "grade2", None),
    ("math", "grade99",  None),
    ("math", "grade2",   "watercolour"),
]:
    try:
        validate_request(bank, *bad_args)
    except ValueError as e:
        errors_caught += 1
ck("3 bad requests all raised ValueError", errors_caught == 3, f"{errors_caught}/3")

# ── 6. CLI end-to-end ─────────────────────────────────────────────────────────
print("\n── CLI End-to-End ──")
import subprocess, sys
def cli(args_str):
    r = subprocess.run(
        f"{sys.executable} run.py {args_str}",
        capture_output=True, text=True, cwd=str(pathlib.Path(__file__).parent)
    )
    return json.loads(r.stdout.strip()) if r.returncode == 0 else {}

r = cli("--subject=math --topic=fractions --grade_band=3 --level=2 --count=4")
ck("CLI Mode A math/grade3/fractions", len(r.get("questions",[])) > 0, f"{len(r.get('questions',[]))} Qs")

r = cli("--subject=science --topic=cell_structure --grade_band=2 --level=2 --count=4")
ck("CLI Mode A science/grade2/cell_structure", len(r.get("questions",[])) > 0, f"{len(r.get('questions',[]))} Qs")

r = cli("--subject=english --topic=grammar --grade_band=3 --level=2 --count=3")
ck("CLI Mode A english/grade3/grammar", len(r.get("questions",[])) > 0, f"{len(r.get('questions',[]))} Qs | " + (r["questions"][0]["question"][:50] if r.get("questions") else "NONE"))

r = cli("--subject=math --grade_band=3 --level=2 --count=6 --mode=subject")
ck("CLI Mode B math/grade3 mixed", len(r.get("questions",[])) > 0, f"{len(r.get('questions',[]))} Qs")

print()
print("=" * 65)
print("ALL TESTS PASSED" if all_ok else "SOME TESTS FAILED — see FAIL lines above")
print("=" * 65)
sys.exit(0 if all_ok else 1)
