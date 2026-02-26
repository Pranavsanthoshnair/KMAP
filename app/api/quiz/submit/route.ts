import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

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

/**
 * POST /api/quiz/submit
 *
 * Receives quiz answers → computes mastery → runs allocation → returns resource IDs.
 * Only the mastery MAP is persisted to Supabase (no raw answers).
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

    // ── Step 1: Compute mastery via Python allocator ────────────────────────────
    const engineDir = path.join(process.cwd(), 'question_engine');

    const computeCmd = `python -c "
import json, sys
sys.path.insert(0, '.')
from allocator import compute_mastery, classify_subtopics
results = json.loads(sys.argv[1])
mastery = compute_mastery(results)
classified = classify_subtopics(mastery)
print(json.dumps({'mastery': mastery, 'classified': classified}))
" '${JSON.stringify(subtopic_results).replace(/'/g, "'\\''")}' `;

    let mastery: Record<string, number> = {};
    let classified: Record<string, string> = {};

    try {
        const { stdout } = await execAsync(computeCmd, { cwd: engineDir, timeout: 8000 });
        const parsed = JSON.parse(stdout.trim());
        mastery = parsed.mastery ?? {};
        classified = parsed.classified ?? {};
    } catch (err) {
        // Fallback: compute mastery in TypeScript if Python fails
        const stats: Record<string, { c: number; t: number }> = {};
        for (const r of subtopic_results) {
            if (!stats[r.subtopic]) stats[r.subtopic] = { c: 0, t: 0 };
            stats[r.subtopic].t++;
            if (r.correct) stats[r.subtopic].c++;
        }
        for (const [st, s] of Object.entries(stats)) {
            mastery[st] = Math.round((s.c / s.t) * 1000) / 1000;
            classified[st] = mastery[st] < 0.3 ? 'weak' : mastery[st] <= 0.6 ? 'medium' : 'strong';
        }
    }

    // ── Step 2: Fetch matching resources from Supabase ──────────────────────────
    const supabase = createServerSupabase();
    const subtopics = Object.keys(mastery);

    const { data: resources, error } = await supabase
        .from('resources')
        .select('id, subject, grade, subtopic, difficulty, type, size_kb')
        .eq('subject', subject)
        .in('subtopic', subtopics);

    if (error) {
        console.error('[quiz/submit] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }

    // ── Step 3: Run allocation via Python ───────────────────────────────────────
    const allocPayload = JSON.stringify({
        mastery,
        resources: resources ?? [],
        subject,
        grade,
        skill_level,
        recent_ids: recent_resource_ids,
        low_data_mode,
        n: 10,
    });

    const allocCmd = `python -c "
import json, sys
sys.path.insert(0, '.')
from allocator import allocate_resources
p = json.loads(sys.argv[1])
ids = allocate_resources(
    mastery=p['mastery'],
    all_resources=p['resources'],
    subject=p['subject'],
    grade=p['grade'],
    skill_level=p['skill_level'],
    n=p['n'],
    recent_ids=p['recent_ids'],
    low_data_mode=p['low_data_mode'],
)
print(json.dumps(ids))
" '${allocPayload.replace(/'/g, "'\\''")}' `;

    let resource_ids: string[] = [];
    try {
        const { stdout } = await execAsync(allocCmd, { cwd: engineDir, timeout: 8000 });
        resource_ids = JSON.parse(stdout.trim());
    } catch {
        // Fallback: return top resources sorted by grade proximity
        resource_ids = (resources ?? [])
            .sort((a, b) => Math.abs(a.grade - grade) - Math.abs(b.grade - grade))
            .slice(0, 10)
            .map(r => r.id);
    }

    return NextResponse.json({
        resource_ids,
        mastery,       // float map (0–1) — the ONLY data from quiz stored server-side
        classified,    // weak/medium/strong per subtopic
    });
}
