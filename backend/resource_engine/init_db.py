import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'modules.db')

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
        size_bytes  INTEGER,
        description TEXT
    );
    ''')

    # Insert some mock data
    mock_data = [
        ("math_fractions_GB1_L1", "fractions", "mathematics", 1, 1, "What is half?", "url_1", 1024, "Intro to fractions"),
        ("math_fractions_GB2_L1", "fractions", "mathematics", 1, 2, "Fractions on a number line", "url_2", 2048, "Middle school fractions"),
        ("math_fractions_GB3_L1", "fractions", "mathematics", 1, 3, "Rational numbers intro", "url_3", 4096, "High school fractions"),
        ("sci_cells_GB2_L2", "cell_structure", "science", 2, 2, "Cell organelles", "url_4", 3072, "Middle school cells"),
        ("sci_cells_GB4_L3", "cell_structure", "science", 3, 4, "Advanced cell biology", "url_5", 5120, "Senior secondary cells")
    ]

    cursor.execute("DELETE FROM modules")
    cursor.executemany('''
        INSERT INTO modules (id, topic, subject, level, grade_band, title, content_url, size_bytes, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', mock_data)

    conn.commit()
    conn.close()
    print("Database initialized and mock data inserted.")

if __name__ == "__main__":
    init_db()
