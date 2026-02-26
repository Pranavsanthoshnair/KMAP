"""Quick verification: engine returns exactly count=1 for every topic including missing ones."""
import sys, pathlib, subprocess, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from engine import load_bank, generate_subtopic_quiz

bank = load_bank()
all_ok = True

def ck(label, cond, detail=""):
    global all_ok
    flag = "OK  " if cond else "FAIL"
    if not cond: all_ok = False
    print(f"[{flag}] {label}" + (f" — {detail}" if detail else ""))

# 1. Bank topics always return exactly 1 question
for subj, gk, st, lv in [
    ("math",    "grade1", "arithmetic",      1),
    ("math",    "grade3", "fractions",        2),
    ("math",    "grade4", "algebra",          2),
    ("science", "grade2", "cell_structure",   2),
    ("science", "grade2", "photosynthesis",   2),
    ("english", "grade1", "parts_of_speech",  1),
    ("english", "grade3", "grammar",          2),
]:
    qs = generate_subtopic_quiz(bank, subj, gk, st, lv, count=1)
    ck(f"count=1 {subj}/{gk}/{st}", len(qs) == 1, f"got {len(qs)}")

# 2. Missing subtopics (not in bank) also return exactly 1 question
for subj, gk, st, lv in [
    ("math",    "grade3", "probability",      2),
    ("science", "grade2", "microbiology",     2),
    ("english", "grade3", "poetry",           2),
]:
    qs = generate_subtopic_quiz(bank, subj, gk, st, lv, count=1)
    ck(f"fallback =1 {subj}/{gk}/{st}", len(qs) == 1, f"got {len(qs)}")

# 3. CLI run.py --count=1
for subj, topic, gb in [("math","arithmetic",1),("science","cell_structure",2),("english","grammar",3)]:
    r = subprocess.run(
        [sys.executable, "run.py", f"--subject={subj}", f"--topic={topic}",
         f"--grade_band={gb}", "--level=2", "--count=1"],
        capture_output=True, text=True, cwd=str(pathlib.Path(__file__).parent)
    )
    data = json.loads(r.stdout.strip()) if r.returncode == 0 else {}
    qs = data.get("questions", [])
    ck(f"CLI count=1 {subj}/{topic}", len(qs) == 1, f"got {len(qs)}: {qs[0]['question'][:50] if qs else 'NONE'}")

print("\nALL OK" if all_ok else "SOME FAILED")
