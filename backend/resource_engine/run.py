"""
run.py — Query learning modules from local SQLite using Bloom filter matching.

Usage:
    python run.py --filter="0100010000000001" --level=2 --grade_band=2

The filter is a Bloom filter bit-string generated client-side.
This script tests each known topic against the filter using the same
hash functions as the frontend (FNV-1a + Kirsch-Mitzenmacher),
then returns matching modules at the requested knowledge level.
"""

import sqlite3
import json
import argparse
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'modules.db')

# ── Bloom filter parameters (must match frontend lib/bloom.ts) ───────────────
DEFAULT_M_BITS = 128
DEFAULT_K = 3
DEFAULT_SEED = "kmap-bloom-v1"


def fnv1a32(input_str: str, seed: int = 0x811c9dc5) -> int:
    """FNV-1a 32-bit hash — mirrors frontend bloom.ts."""
    h = seed & 0xFFFFFFFF
    for ch in input_str:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def derive_hashes(item: str, k: int = DEFAULT_K, seed: str = DEFAULT_SEED) -> list[int]:
    """Kirsch–Mitzenmacher: two base hashes → k derived hashes."""
    h1 = fnv1a32(f"{seed}|1|{item}")
    h2 = fnv1a32(f"{seed}|2|{item}", 0x9e3779b9)
    return [(h1 + i * h2) & 0xFFFFFFFF for i in range(k)]


def might_contain(filter_str: str, item_raw: str,
                  m_bits: int = DEFAULT_M_BITS, k: int = DEFAULT_K,
                  seed: str = DEFAULT_SEED) -> bool:
    """Check if a topic is (probably) in the Bloom filter."""
    if not filter_str or len(filter_str) < m_bits:
        return False
    item = item_raw.strip().lower()
    if not item:
        return False
    for h in derive_hashes(item, k, seed):
        idx = h % m_bits
        if filter_str[idx] != '1':
            return False
    return True


# All known topics across science and math
ALL_TOPICS = [
    # Science G1 + G2
    "basic_biology", "animals", "plants", "weather",
    "cell_structure", "photosynthesis", "states_of_matter", "human_body",
    # Math G1 + G2
    "arithmetic", "counting", "shapes", "comparison",
    "money", "division", "measurement", "time",
]


def decode_filter(filter_str: str) -> list[str]:
    """Test every known topic against the Bloom filter and return matches."""
    m_bits = len(filter_str) if len(filter_str) > 0 else DEFAULT_M_BITS
    matched = [t for t in ALL_TOPICS if might_contain(filter_str, t, m_bits)]
    return matched if matched else ALL_TOPICS  # fallback to all if nothing matches


def get_modules(filter_str: str, level: int, grade_band: int):
    """Query SQLite for modules matching the Bloom filter + level + grade."""
    matched_topics = decode_filter(filter_str)

    if not os.path.exists(DB_PATH):
        print(json.dumps({"error": "Database not found. Run init_db.py first."}))
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    placeholders = ','.join(['?'] * len(matched_topics))
    query = f"""
        SELECT id, title, topic, level, grade_band, size_bytes, description, content_url
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
        print(json.dumps({
            "modules": modules,
            "_meta": {
                "matched_topic_count": len(matched_topics),
                "results": len(modules),
            }
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query KMAP learning modules")
    parser.add_argument("--filter", type=str, required=True,
                        help="Bloom filter bit-string from client")
    parser.add_argument("--level", type=int, required=True,
                        help="Knowledge level 1-4 (derived from quiz score)")
    parser.add_argument("--grade_band", type=int, required=True,
                        help="Grade band 1-4")

    args = parser.parse_args()
    get_modules(args.filter, args.level, args.grade_band)
