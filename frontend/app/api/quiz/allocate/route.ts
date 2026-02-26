import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createServerSupabase } from '@/lib/supabase/server';
import { mightContain } from '@/lib/bloom';

interface AllocatePayload {
    subject: string;
    grade_band: number;
    level: number; // 1..3
    filter: string; // bloom bitstring
    recent_resource_ids?: string[];
    low_data_mode?: boolean;
}

type ResourceRow = {
    id: string;
    subject: string;
    grade: number;
    subtopic: string;
    difficulty: number;
    type: string;
    size_kb: number;
};

function loadSubtopicsFromBank(subject: string, gradeBand: number): string[] {
    const bankPath = path.join(process.cwd(), '..', 'backend', 'question_engine', 'question_bank.json');
    const raw = fs.readFileSync(bankPath, 'utf-8');
    const bank = JSON.parse(raw) as Record<string, Record<string, Record<string, unknown>>>;

    const subjectData = bank[subject];
    if (!subjectData) return [];

    const seen = new Set<string>();
    const out: string[] = [];
    const bands = [gradeBand - 1, gradeBand, gradeBand + 1].filter(g => g >= 1 && g <= 5);
    for (const gb of bands) {
        const gradeKey = `grade${gb}`;
        const gradeData = subjectData[gradeKey];
        if (!gradeData) continue;
        for (const subtopic of Object.keys(gradeData)) {
            if (seen.has(subtopic)) continue;
            seen.add(subtopic);
            out.push(subtopic);
        }
    }
    return out;
}

function scoreResource(r: { grade: number; difficulty: number; size_kb: number }, targetGrade: number, level: number): number {
    let score = 0;
    if (r.grade === targetGrade) score += 0.35;
    score += Math.max(0, 0.25 - Math.abs((r.difficulty ?? 2) - level) * 0.1);
    score += 0.15 * (1 / (1 + (r.size_kb ?? 500) / 500));
    return score;
}

/**
 * POST /api/quiz/allocate
 *
 * Privacy-first: client sends only a Bloom filter encoding weak subtopics (+ grade/level).
 * Server expands the filter against known subtopics, fetches matching resources, and returns IDs.
 */
export async function POST(request: NextRequest) {
    let body: AllocatePayload;
    try {
        body = (await request.json()) as AllocatePayload;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const subject = (body.subject ?? '').toLowerCase().trim();
    const grade_band = Number(body.grade_band);
    const level = Number(body.level || 2);
    const filter = String(body.filter ?? '');
    const recent_resource_ids = Array.isArray(body.recent_resource_ids) ? body.recent_resource_ids : [];
    const low_data_mode = Boolean(body.low_data_mode);

    if (!subject || !grade_band || !filter) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Expand filter to candidate subtopics (including false positives).
    let subtopics: string[] = [];
    try {
        subtopics = loadSubtopicsFromBank(subject, grade_band);
    } catch (err) {
        console.error('[quiz/allocate] Failed to read question bank:', err);
        subtopics = [];
    }

    const hasAnyBits = filter.includes('1');
    const candidates = hasAnyBits
        ? subtopics.filter(st => mightContain(filter, st))
        : subtopics;

    // If filter is empty or too strict, fall back to all known subtopics for the grade/subject.
    const expanded = (candidates.length > 0 ? candidates : subtopics).slice(0, 200);

    // Step 2: Fetch matching resources from Supabase.
    const supabase = createServerSupabase();
    const recent = new Set(recent_resource_ids);

    const { data: resources, error } = await supabase
        .from('resources')
        .select('id, subject, grade, subtopic, difficulty, type, size_kb')
        .eq('subject', subject)
        .in('subtopic', expanded);

    if (error) {
        console.error('[quiz/allocate] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }

    // Step 3: Allocate IDs (privacy-preserving; no mastery required).
    const typed = (resources ?? []) as ResourceRow[];
    const filtered = typed.filter(r => {
        if (Math.abs(r.grade - grade_band) > 1) return false;
        if (recent.has(r.id)) return false;
        if (low_data_mode && (r.type === 'video' || r.size_kb > 500)) return false;
        return true;
    });

    const picked = filtered
        .map(r => ({ id: r.id, score: scoreResource(r, grade_band, level) }))
        .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id))
        .slice(0, 10)
        .map(x => x.id);

    // Fallback if no matches
    if (picked.length === 0) {
        const fallback = typed
            .filter(r => !recent.has(r.id))
            .sort((a, b) => Math.abs(a.grade - grade_band) - Math.abs(b.grade - grade_band))
            .slice(0, 10)
            .map(r => r.id);
        return NextResponse.json({ resource_ids: fallback });
    }

    return NextResponse.json({ resource_ids: picked });
}

