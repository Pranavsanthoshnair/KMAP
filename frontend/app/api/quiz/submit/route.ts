import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export interface QuizResult {
    subtopic: string;
    correct: boolean;
}

export interface SubmitPayload {
    subject: string;
    grade: number;
    skill_level?: number;
    subtopic_results: QuizResult[];
    recent_resource_ids?: string[];
    low_data_mode?: boolean;
}

// ── Mastery computation (mirrors allocator.py:compute_mastery) ───────────────
function computeMastery(results: QuizResult[]): Record<string, number> {
    const stats: Record<string, { c: number; t: number }> = {};
    for (const r of results) {
        if (!stats[r.subtopic]) stats[r.subtopic] = { c: 0, t: 0 };
        stats[r.subtopic].t++;
        if (r.correct) stats[r.subtopic].c++;
    }
    const mastery: Record<string, number> = {};
    for (const [st, s] of Object.entries(stats)) {
        mastery[st] = Math.round((s.c / s.t) * 1000) / 1000;
    }
    return mastery;
}

// ── Classification (mirrors allocator.py:classify_subtopics) ─────────────────
function classifySubtopics(mastery: Record<string, number>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [st, score] of Object.entries(mastery)) {
        out[st] = score < 0.3 ? 'weak' : score <= 0.6 ? 'medium' : 'strong';
    }
    return out;
}

// ── Resource scoring (mirrors allocator.py:_score_resource) ──────────────────
function scoreResource(
    r: { grade: number; difficulty: number; size_kb: number; subtopic: string },
    mastery: Record<string, number>,
    targetGrade: number,
    skillLevel: number,
    classification: string,
): number {
    let score = classification === 'weak' ? 0.4 : classification === 'medium' ? 0.2 : 0;
    if (r.grade === targetGrade) score += 0.3;
    const diffGap = Math.abs((r.difficulty ?? 2) - skillLevel);
    score += Math.max(0, 0.2 - diffGap * 0.08);
    score += 0.1 * (1 / (1 + (r.size_kb ?? 500) / 500));
    return score;
}

// ── Full allocation (mirrors allocator.py:allocate_resources) ────────────────
function allocateResources(
    mastery: Record<string, number>,
    classified: Record<string, string>,
    resources: Array<{ id: string; grade: number; subtopic: string; difficulty: number; size_kb: number; type: string }>,
    subject: string,
    grade: number,
    skillLevel: number,
    n: number,
    recentIds: string[],
    lowDataMode: boolean,
): string[] {
    const recent = new Set(recentIds);

    // Step 1: filter by subject, grade ±1, matching subtopic, low-data constraints
    const filtered = resources.filter(r => {
        if (!(r.subtopic in mastery)) return false;
        if (Math.abs(r.grade - grade) > 1) return false;
        if (recent.has(r.id)) return false;
        if (lowDataMode && (r.type === 'video' || r.size_kb > 500)) return false;
        return true;
    });

    if (filtered.length === 0) {
        // fallback: return anything from the subject sorted by grade proximity
        return resources
            .filter(r => !recent.has(r.id))
            .sort((a, b) => Math.abs(a.grade - grade) - Math.abs(b.grade - grade))
            .slice(0, n)
            .map(r => r.id);
    }

    // Step 2: group by classification bucket and score
    const groups: Record<string, Array<{ id: string; score: number }>> = { weak: [], medium: [], strong: [] };
    for (const r of filtered) {
        const cls = classified[r.subtopic] ?? 'medium';
        groups[cls].push({ id: r.id, score: scoreResource(r, mastery, grade, skillLevel, cls) });
    }
    for (const cls of ['weak', 'medium', 'strong']) {
        groups[cls].sort((a, b) => b.score - a.score);
    }

    // Step 3: 60 / 30 / 10 ratio
    const weakN = Math.ceil(n * 0.6);
    const mediumN = Math.ceil(n * 0.3);
    const strongN = Math.max(1, Math.floor(n * 0.1));

    const pick = (cls: string, count: number): string[] => {
        const pool = groups[cls].slice(0, count).map(r => r.id);
        if (pool.length < count) {
            const fallbackCls = cls !== 'medium' ? 'medium' : 'weak';
            const need = count - pool.length;
            pool.push(...groups[fallbackCls].slice(groups[fallbackCls].length - need).map(r => r.id));
        }
        return pool;
    };

    const picked = [...pick('weak', weakN), ...pick('medium', mediumN), ...pick('strong', strongN)];
    const seen = new Set<string>();
    return picked.filter(id => { if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, n);
}

/**
 * POST /api/quiz/submit
 *
 * Receives quiz answers → computes mastery → runs allocation → returns resource IDs.
 * Pure TypeScript — no Python subprocesses.
 * No user data is persisted server-side.
 */
export async function POST(request: NextRequest) {
    let body: SubmitPayload;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
        subject,
        grade,
        skill_level = 2,
        subtopic_results,
        recent_resource_ids = [],
        low_data_mode = false,
    } = body;

    if (!subject || !grade || !Array.isArray(subtopic_results) || subtopic_results.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Step 1: Compute mastery & classify ──────────────────────────────────
    const mastery = computeMastery(subtopic_results);
    const classified = classifySubtopics(mastery);
    const subtopics = Object.keys(mastery);

    // ── Step 2: Fetch matching resources from Supabase ──────────────────────
    const supabase = createServerSupabase();

    const { data: resources, error } = await supabase
        .from('resources')
        .select('id, subject, grade, subtopic, difficulty, type, size_kb')
        .eq('subject', subject)
        .in('subtopic', subtopics);

    if (error) {
        console.error('[quiz/submit] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }

    // ── Step 3: Allocate (pure TS, no subprocess) ───────────────────────────
    const resource_ids = allocateResources(
        mastery,
        classified,
        (resources ?? []) as Array<{ id: string; grade: number; subtopic: string; difficulty: number; size_kb: number; type: string }>,
        subject,
        grade,
        skill_level,
        10,
        recent_resource_ids,
        low_data_mode,
    );

    return NextResponse.json({ resource_ids, mastery, classified });
}
