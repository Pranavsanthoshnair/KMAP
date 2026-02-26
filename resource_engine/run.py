import sqlite3
import json
import argparse
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'modules.db')

# Mapping for 01001010 style filter
ALL_TOPICS = [
    # Assumed mapping based on other parts of codebase, 
    # placeholder list for demonstration of decoding filter
    "cell_structure", "photosynthesis", "human_body", "fractions", "algebra",
    "geometry", "history_ww2", "history_ancient", "geography_rivers", "geography_mountains",
    "physics_motion", "physics_light", "chemistry_atoms", "chemistry_bonding", "literature_poetry",
    "literature_drama"
]

def decode_filter(filter_str: str) -> list[str]:
    """Decodes a binary string filter into a list of matched topics."""
    matched = []
    for i, char in enumerate(filter_str):
        if i < len(ALL_TOPICS) and char == '1':
            matched.append(ALL_TOPICS[i])
    
    # If filter is empty or doesn't match anything, or we just want everything,
    # return a fallback. For now, rely strictly on the filter.
    if not matched:
        return ALL_TOPICS # Fallback to all if empty
    return matched

def get_modules(filter_str: str, level: int, grade_band: int):
    matched_topics = decode_filter(filter_str)
    
    if not os.path.exists(DB_PATH):
        print(json.dumps({"error": "Database not found."}))
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create placeholders for IN clause
    placeholders = ','.join(['?'] * len(matched_topics))
    query = f"""
        SELECT id, title, topic, level, size_bytes, description, content_url
        FROM modules 
        WHERE topic IN ({placeholders}) 
        AND level = ? 
        AND grade_band = ?
    """
    
    params = tuple(matched_topics + [level, grade_band])
    
    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        modules = [dict(row) for row in rows]
        print(json.dumps({"modules": modules}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query learning modules")
    parser.add_argument("--filter", type=str, required=True, help="Binary string filter of topics")
    parser.add_argument("--level", type=int, required=True, help="Difficulty level")
    parser.add_argument("--grade_band", type=int, required=True, help="Grade band of student")
    
    args = parser.parse_args()
    get_modules(args.filter, args.level, args.grade_band)
