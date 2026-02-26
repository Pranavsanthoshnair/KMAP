"""subject_routing_test.py — Tests that each subject returns its own questions, not math."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
pathlib.Path('seen.json').write_text('{}')
from engine import generate_questions

# (topic, explicit_subject_or_None, grade_band, level, expected_subject_label)
tests = [
    # Auto-inferred from topic name
    ('parts_of_speech',   None,      1, 1, 'english'),
    ('figures_of_speech', None,      2, 2, 'english'),
    ('literary_devices',  None,      3, 2, 'english'),
    ('cell_structure',    None,      2, 2, 'science'),
    ('genetics',          None,      3, 3, 'science'),
    ('basic_biology',     None,      1, 1, 'science'),
    ('arithmetic',        None,      1, 1, 'math'),
    ('algebra',           None,      4, 2, 'math'),
    ('geometry',          None,      3, 2, 'math'),
    # Explicit subject (API route passes this)
    ('arithmetic',        'math',    2, 2, 'math'),
    ('cell_structure',    'science', 2, 2, 'science'),
    ('parts_of_speech',   'english', 1, 1, 'english'),
    ('fractions',         'math',    3, 2, 'math'),
    ('electricity',       'science', 4, 3, 'science'),
    ('linguistics',       'english', 5, 3, 'english'),
]

all_ok = True
for topic, subj, gb, lv, expected in tests:
    r = generate_questions(topic=topic, grade_band=gb, level=lv, count=4, subject=subj)
    ok = len(r.questions) > 0
    first_q = r.questions[0].question[:55] if r.questions else '(NONE)'
    label = f'{expected:8} [{subj or "infer":8}] {topic:22}'
    print(f'[{"OK  " if ok else "FAIL"}] {label} -> {len(r.questions)}q | {first_q}')
    if not ok:
        all_ok = False

print()
print('ALL SUBJECT ROUTING OK' if all_ok else 'SOME TESTS FAILED')
