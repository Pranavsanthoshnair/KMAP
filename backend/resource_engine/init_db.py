"""
init_db.py — Initialize local SQLite modules.db with Grade 1 & 2 topics.

Taxonomy (Grade 1 + 2 only):
  Science: 8 topics × 3 levels = 24 rows
  Math:    8 topics × 3 levels = 24 rows
  Total:   48 rows
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'modules.db')

# ── Grade 1 + 2 topic taxonomy ───────────────────────────────────────────────
TAXONOMY = {
    "science": {
        1: ["basic_biology", "animals", "plants", "weather"],
        2: ["cell_structure", "photosynthesis", "states_of_matter", "human_body"],
    },
    "math": {
        1: ["arithmetic", "counting", "shapes", "comparison"],
        2: ["money", "division", "measurement", "time"],
    },
}

TOPIC_TITLES = {
    "basic_biology": "Basic Biology", "animals": "Animals", "plants": "Plants",
    "weather": "Weather", "cell_structure": "Cell Structure",
    "photosynthesis": "Photosynthesis", "states_of_matter": "States of Matter",
    "human_body": "Human Body",
    "arithmetic": "Arithmetic", "counting": "Counting", "shapes": "Shapes",
    "comparison": "Comparison", "money": "Money", "division": "Division",
    "measurement": "Measurement", "time": "Time",
}

LEVEL_LABELS = {
    1: "Fundamentals",
    2: "Building Understanding",
    3: "Mastery",
}


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS modules (
        id          TEXT PRIMARY KEY,
        topic       TEXT NOT NULL,
        subject     TEXT NOT NULL,
        level       INTEGER NOT NULL,
        grade_band  INTEGER NOT NULL,
        title       TEXT NOT NULL,
        content_url TEXT,
        size_bytes  INTEGER DEFAULT 0,
        description TEXT
    );
    ''')

    cursor.execute("DELETE FROM modules")

    rows = []
    for subject, grades in TAXONOMY.items():
        prefix = "sci" if subject == "science" else "mat"
        for grade, topics in grades.items():
            for topic in topics:
                for level in range(1, 4):
                    rid = f"{prefix}_{topic}_G{grade}_L{level}"
                    topic_label = TOPIC_TITLES.get(topic, topic.replace("_", " ").title())
                    level_label = LEVEL_LABELS.get(level, f"Level {level}")
                    title = f"{topic_label} — {level_label}"
                    desc = f"Grade {grade} {subject} resource for {topic_label}, {level_label}."
                    rows.append((rid, topic, subject, level, grade, title, None, 0, desc))

    cursor.executemany('''
        INSERT OR REPLACE INTO modules
            (id, topic, subject, level, grade_band, title, content_url, size_bytes, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', rows)

    conn.commit()
    conn.close()
    print(f"Database initialized: {len(rows)} module rows inserted into {DB_PATH}")


if __name__ == "__main__":
    init_db()
