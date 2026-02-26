"""
allocator.py — Resource Allocation Engine

Deterministic, no-ML allocation of educational resources based on mastery scores.

Key functions:
  compute_mastery()         — Raw results → per-subtopic float (0–1)
  classify_subtopics()      — Float map → Weak / Medium / Strong
  enforce_ratio_distribution() — 60% Weak / 30% Medium / 10% Strong
  allocate_resources()      — Full pipeline: filter → score → distribute → return IDs
  avoid_recent_resources()  — Excludes recently served resource IDs
"""

import math
from typing import Dict, List, Optional

# ── Mastery classification thresholds ─────────────────────────────────────────
WEAK_THRESHOLD   = 0.30   # mastery < 0.30 → Weak   (needs most help)
STRONG_THRESHOLD = 0.60   # mastery > 0.60 → Strong  (already secure)

# ── Allocation ratio ─────────────────────────────────────────────────────────
RATIO = {"weak": 0.60, "medium": 0.30, "strong": 0.10}


# ── 1. Mastery computation ─────────────────────────────────────────────────────

def compute_mastery(results: List[Dict]) -> Dict[str, float]:
    """
    Compute per-subtopic mastery from a list of quiz answer records.

    Input
    -----
    results : [{"subtopic": "algebra", "correct": True}, ...]

    Output
    ------
    {"algebra": 0.80, "fractions": 0.20, ...}
    """
    stats: Dict[str, Dict[str, int]] = {}
    for r in results:
        st = r.get("subtopic", "unknown")
        if st not in stats:
            stats[st] = {"correct": 0, "total": 0}
        stats[st]["total"] += 1
        if r.get("correct"):
            stats[st]["correct"] += 1

    return {
        st: round(s["correct"] / s["total"], 3)
        for st, s in stats.items()
        if s["total"] > 0
    }


# ── 2. Classification ──────────────────────────────────────────────────────────

def classify_subtopics(mastery: Dict[str, float]) -> Dict[str, str]:
    """
    Classify each subtopic as "weak", "medium", or "strong".

    Weak   → mastery < 0.30  (allocate most resources here)
    Medium → 0.30–0.60
    Strong → mastery > 0.60  (minimal allocation — already secure)
    """
    result = {}
    for subtopic, score in mastery.items():
        if score < WEAK_THRESHOLD:
            result[subtopic] = "weak"
        elif score <= STRONG_THRESHOLD:
            result[subtopic] = "medium"
        else:
            result[subtopic] = "strong"
    return result


# ── 3. Scoring & novelty ───────────────────────────────────────────────────────

def avoid_recent_resources(
    resources: List[Dict],
    recent_ids: List[str],
) -> List[Dict]:
    """Remove recently served resources to enforce novelty."""
    recent_set = set(recent_ids)
    return [r for r in resources if r.get("id") not in recent_set]


def _score_resource(
    resource: Dict,
    mastery: Dict[str, float],
    target_grade: int,
    skill_level: int,
    classification: str,
) -> float:
    """
    Score a single resource. Higher score = higher priority.

    Components:
      • Weak boost        — more weight when classification is 'weak'
      • Grade match       — exact grade gets +0.3 boost
      • Difficulty match  — resource difficulty matching user skill_level
      • Size boost        — smaller files score slightly higher (bandwidth)
    """
    score = 0.0

    # Weak subtopics get priority
    if classification == "weak":
        score += 0.40
    elif classification == "medium":
        score += 0.20

    # Exact grade match
    if resource.get("grade") == target_grade:
        score += 0.30

    # Difficulty alignment  (1=easy, 2=medium, 3=hard)
    res_diff = resource.get("difficulty", 2)
    diff_gap = abs(res_diff - skill_level)
    score += max(0.0, 0.20 - diff_gap * 0.08)

    # Smaller file = better for bandwidth
    size_kb = resource.get("size_kb", 500)
    score += 0.10 * (1.0 / (1.0 + size_kb / 500.0))

    return score


# ── 4. Ratio distribution ─────────────────────────────────────────────────────

def enforce_ratio_distribution(
    classified: Dict[str, str],
    resources_by_subtopic: Dict[str, List[Dict]],
    mastery: Dict[str, float],
    target_grade: int,
    skill_level: int,
    n: int,
) -> List[str]:
    """
    Enforce 60/30/10 allocation across weak/medium/strong subtopics.
    Returns an ordered list of resource IDs.
    """
    # Group resources by classification
    groups: Dict[str, List[Dict]] = {"weak": [], "medium": [], "strong": []}
    for subtopic, cls in classified.items():
        for res in resources_by_subtopic.get(subtopic, []):
            res["_cls"] = cls
            res["_score"] = _score_resource(res, mastery, target_grade, skill_level, cls)
            groups[cls].append(res)

    # Sort each group by score descending
    for cls in groups:
        groups[cls].sort(key=lambda r: r["_score"], reverse=True)

    # Determine slot counts
    weak_n   = math.ceil(n * RATIO["weak"])
    medium_n = math.ceil(n * RATIO["medium"])
    strong_n = max(1, math.floor(n * RATIO["strong"]))

    picked: List[str] = []

    def pick_from(cls: str, count: int) -> List[str]:
        pool = groups[cls]
        chosen = pool[:count]
        # If not enough in this class, borrow from others
        remaining = count - len(chosen)
        if remaining > 0:
            fallback_cls = "medium" if cls != "medium" else "weak"
            chosen += groups[fallback_cls][len(groups[fallback_cls]) - remaining:]
        return [r["id"] for r in chosen if "id" in r]

    picked += pick_from("weak",   weak_n)
    picked += pick_from("medium", medium_n)
    picked += pick_from("strong", strong_n)

    # Deduplicate while preserving order
    seen: set = set()
    deduped: List[str] = []
    for rid in picked:
        if rid not in seen:
            seen.add(rid)
            deduped.append(rid)

    return deduped[:n]


# ── 5. Main allocation entry point ────────────────────────────────────────────

def allocate_resources(
    mastery: Dict[str, float],
    all_resources: List[Dict],
    subject: str,
    grade: int,
    skill_level: int = 2,
    n: int = 10,
    recent_ids: Optional[List[str]] = None,
    low_data_mode: bool = False,
) -> List[str]:
    """
    Full allocation pipeline.

    Step 1 — Filter by subject, grade ±1, matching subtopic
    Step 2 — Remove recently served resources
    Step 3 — Group by subtopic, classify, score
    Step 4 — Enforce 60/30/10 ratio, return top N IDs

    Parameters
    ----------
    mastery       : {"subtopic": float, ...}  (0–1 per subtopic)
    all_resources : list of resource dicts from Supabase
    subject       : e.g. "math"
    grade         : user's grade band (1–5)
    skill_level   : 1–3 difficulty preference
    n             : number of resource IDs to return
    recent_ids    : IDs served in recent sessions (for novelty)
    low_data_mode : if True, exclude large files and videos

    Returns
    -------
    List of resource IDs (strings), max length n.
    """
    if recent_ids is None:
        recent_ids = []

    # ── Step 1: Filter ────────────────────────────────────────────────────────
    filtered = []
    for r in all_resources:
        # Subject match
        if r.get("subject") != subject:
            continue
        # Grade ±1
        if abs(r.get("grade", 0) - grade) > 1:
            continue
        # Must belong to a subtopic the user has mastery data for
        if r.get("subtopic") not in mastery:
            continue
        # Low data mode: skip video and large files
        if low_data_mode:
            if r.get("type") == "video":
                continue
            if r.get("size_kb", 0) > 500:
                continue

        filtered.append(r)

    if not filtered:
        return []

    # ── Step 2: Remove recent resources ──────────────────────────────────────
    filtered = avoid_recent_resources(filtered, recent_ids)

    # ── Step 3: Group by subtopic ─────────────────────────────────────────────
    by_subtopic: Dict[str, List[Dict]] = {}
    for r in filtered:
        st = r.get("subtopic", "")
        by_subtopic.setdefault(st, []).append(r)

    # ── Step 4: Classify and distribute ──────────────────────────────────────
    classified = classify_subtopics(mastery)
    return enforce_ratio_distribution(
        classified, by_subtopic, mastery, grade, skill_level, n
    )
