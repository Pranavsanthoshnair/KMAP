import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { mightContain } from '@/lib/bloom';

export interface QuizResult {
    subtopic: string;
    correct: boolean;
}

export interface SubmitPayload {
    subject: string;
    grade: number;
    subtopic_results: QuizResult[];
    recent_resource_ids?: string[];
    low_data_mode?: boolean;
}

// ── Score → knowledge level mapping ─────────────────────────────────────────
// 0–33%  → Level 1 (Fundamentals)
// 34–66% → Level 2 (Building Understanding)
// 67–100%→ Level 3 (Mastery)
function scoreToLevel(pct: number): number {
    if (pct >= 67) return 3;
    if (pct >= 34) return 2;
    return 1;
}

// ── Mastery computation ─────────────────────────────────────────────────────
function computeMastery(results: QuizResult[]): Record<string, number> {
    const stats: Record<string, { c: number; t: number }> = {};
    for (const r of results) {
        if (!stats[r.subtopic]) stats[r.subtopic] = { c: 0, t: 0 };
        stats[r.subtopic].t++;
        if (r.correct) stats[r.subtopic].c++;
    }
    const mastery: Record<string, number> = {};
    for (const [st, s] of Object.entries(stats)) {
        mastery[st] = Math.round((s.c / s.t) * 100);   // percentage 0–100
    }
    return mastery;
}

/**
 * POST /api/quiz/submit
 *
 * Receives quiz results → computes per-topic scores → derives knowledge level →
 * fetches resources at that level for matched topics from Supabase.
 *
 * The Bloom filter identifies WHICH topics. The score determines WHICH level.
 *
 * Score → Level mapping:
 *   0–33%  → Level 1 (needs fundamentals)
 *   34–66% → Level 2 (building understanding)
 *   67–100%→ Level 3 (mastery)
 *
 * No user data is stored server-side.
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
        subtopic_results,
        recent_resource_ids = [],
        low_data_mode = false,
    } = body;

    if (!subject || !grade || !Array.isArray(subtopic_results) || subtopic_results.length === 0) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Step 1: Compute per-topic score percentages ──────────────────────────
    const mastery = computeMastery(subtopic_results);

    // ── Step 2: Derive overall knowledge level from average score ────────────
    const scores = Object.values(mastery);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const knowledgeLevel = scoreToLevel(avgScore);

    // ── Step 3: Fetch resources from Supabase at the correct level ───────────
    const supabase = createServerSupabase();
    const subtopics = Object.keys(mastery);

    const { data: resources, error } = await supabase
        .from('resources')
        .select('id, title, type, size_kb, preview_text, subject, grade, subtopic, difficulty, storage_path')
        .eq('subject', subject)
        .eq('difficulty', knowledgeLevel)
        .in('subtopic', subtopics);

    if (error) {
        console.error('[quiz/submit] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }

    // ── Step 4: Filter by grade tolerance and recency ────────────────────────
    const recent = new Set(recent_resource_ids);
    const filtered = (resources ?? []).filter(r => {
        if (Math.abs(r.grade - grade) > 0) return false;  // exact grade match only
        if (recent.has(r.id)) return false;
        if (low_data_mode && r.size_kb > 500) return false;
        return true;
    });

    // Fallback: anything at the right level for the subject
    const pool = filtered.length > 0 ? filtered : (resources ?? []).filter(r => !recent.has(r.id));

    const resource_ids = pool.map(r => r.id);

    // Return resource metadata so the client can display cards immediately
    const resource_meta = pool.map(r => ({
        id: r.id,
        title: r.title,
        type: r.type,
        size_kb: r.size_kb,
        preview_text: r.preview_text,
        subject: r.subject,
        grade: r.grade,
        subtopic: r.subtopic,
        difficulty: r.difficulty,
    }));

    return NextResponse.json({
        resource_ids,
        resources: resource_meta,
        knowledge_level: knowledgeLevel,
        average_score: Math.round(avgScore),
        mastery,
    });
}
