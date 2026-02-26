# KMAP Backend

Python scripts for question generation, resource allocation, and Supabase migrations.

## Structure

```
backend/
├── question_engine/     # Question generation engine + question bank
│   ├── engine.py        # Core engine (load_bank, generate_questions, etc.)
│   ├── allocator.py     # Resource allocation logic
│   ├── run.py           # CLI entrypoint (called by Next.js API routes)
│   ├── question_bank.json
│   └── ...
├── resource_engine/     # Local SQLite resource index
│   ├── init_db.py
│   └── modules.db
├── supabase/            # DB migrations
│   └── migrations/
└── requirements.txt
```

## Setup

```bash
pip install -r requirements.txt
```

## Running Smoke Tests

```bash
cd backend
python -c "
import json, sys
sys.path.insert(0, 'question_engine')
from engine import load_bank, generate_questions
bank = load_bank()
for subj in ['math','science','english']:
    for grade in bank[subj]:
        for subtopic in bank[subj][grade]:
            qs = generate_questions(bank, subj, grade.replace('grade',''), subtopic, 1, 1)
            assert len(qs)==1, f'FAIL {subj}/{grade}/{subtopic}'
            print(f'OK {subj}/{grade}/{subtopic}')
print('ALL PASS')
"
```
