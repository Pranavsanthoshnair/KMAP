"""Quick smoke test to validate the expanded facts.json."""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))

with open('facts.json') as f:
    facts = json.load(f)

print(f"Total facts: {len(facts)}")

from collections import Counter
print("By subject:   ", dict(Counter(f['subject'] for f in facts)))
print("By grade_band:", dict(sorted(Counter(f['grade_band'] for f in facts).items())))
topics = sorted(set(f['topic'] for f in facts))
print(f"Unique topics ({len(topics)}):", topics)

# Reset seen
pathlib.Path('seen.json').write_text('{}')

from engine import generate_questions

tests = [
    ('science', 'basic_biology',     1, 1, 4),
    ('math',    'arithmetic',        1, 2, 4),
    ('english', 'parts_of_speech',   1, 1, 4),
    ('science', 'cell_structure',    2, 2, 4),
    ('math',    'fractions',         2, 2, 3),
    ('english', 'figures_of_speech', 2, 2, 3),
    ('science', 'genetics',          3, 3, 4),
    ('math',    'algebra',           3, 3, 3),
    ('english', 'literary_devices',  3, 2, 4),
    ('science', 'electricity',       4, 3, 3),
    ('math',    'trigonometry',      4, 3, 3),
    ('math',    'calculus',          5, 3, 3),
    ('english', 'linguistics',       5, 3, 3),
]

print("\n--- Cross-Grade Smoke Test ---")
all_ok = True
for subj, topic, gb, lv, count in tests:
    r = generate_questions(topic=topic, grade_band=gb, level=lv, count=count)
    ok = len(r.questions) > 0
    all_ok = all_ok and ok
    status = 'OK  ' if ok else 'FAIL'
    print(f"[{status}] {subj:8} GB{gb} L{lv}  {topic:22} -> {len(r.questions)} questions")

print("\nAll tests passed!" if all_ok else "\nSome tests FAILED.")
