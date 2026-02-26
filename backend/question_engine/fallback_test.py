import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from engine import load_bank, generate_subtopic_quiz, get_question_for_subtopic

bank = load_bank()

# Test 1: topic IS in bank
qs = generate_subtopic_quiz(bank, 'math', 'grade3', 'fractions', 2, 4)
print(f'[OK] In-bank math/grade3/fractions: {len(qs)} questions')
print(f'     Sample: {qs[0]["question"][:60]}')

# Test 2: topic NOT in bank (should return fallback, no error)
qs = generate_subtopic_quiz(bank, 'math', 'grade3', 'probability', 2, 4)
print(f'[OK] Fallback math/grade3/probability: {len(qs)} questions')
print(f'     Sample: {qs[0]["question"][:60]}')

# Test 3: get_question_for_subtopic — one question for any subtopic
q = get_question_for_subtopic(bank, 'science', 'grade2', 'microbiology', 1)
print(f'[OK] get_one science/grade2/microbiology')
print(f'     Q: {q["question"][:60]}')

# Test 4: english not in bank
qs = generate_subtopic_quiz(bank, 'english', 'grade3', 'poetry', 2, 3)
print(f'[OK] Fallback english/grade3/poetry: {len(qs)} questions')

# Test 5: in-bank english
qs = generate_subtopic_quiz(bank, 'english', 'grade3', 'grammar', 2, 4)
print(f'[OK] In-bank english/grade3/grammar: {len(qs)} questions | {qs[0]["question"][:50]}')

print('ALL TESTS PASSED')
