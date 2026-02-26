import { NextRequest, NextResponse } from 'next/server';
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

// All known topics (Grade 1 + 2)
const ALL_TOPICS = [
    'basic_biology', 'animals', 'plants', 'weather',
    'cell_structure', 'photosynthesis', 'states_of_matter', 'human_body',
    'arithmetic', 'counting', 'shapes', 'comparison',
    'money', 'division', 'measurement', 'time',
];

/**
 * POST /api/quiz/allocate
 *
 * Privacy-first: client sends only a Bloom filter encoding weak subtopics.
 * Server expands the filter against known topics, fetches matching resource
 * METADATA from Supabase, and returns it. No PDF content is sent.
 */
export async function POST(request: NextRequest) {
    let body: AllocatePayload;
    try {
        body = (await request.json()) as AllocatePayload;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const subject = (body.subject ?? '').toLowerCase().trim();
    const grade_band = Number(body.grade_band) || 2;
    const level = Math.min(3, Math.max(1, Number(body.level) || 2));
    const filter = String(body.filter ?? '');
    const recent = new Set(Array.isArray(body.recent_resource_ids) ? body.recent_resource_ids : []);
    const low_data_mode = Boolean(body.low_data_mode);

    if (!subject || !filter) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Expand Bloom filter → candidate subtopics
    const hasAnyBits = filter.includes('1');
    const candidates = hasAnyBits
        ? ALL_TOPICS.filter(t => mightContain(filter, t))
        : ALL_TOPICS;

    const expanded = candidates.length > 0 ? candidates : ALL_TOPICS;

    // Step 2: Fetch matching resource METADATA from Supabase (no storage_path!)
    const supabase = createServerSupabase();

    const { data: resources, error } = await supabase
        .from('resources')
        .select('id, title, type, size_kb, preview_text, subject, grade, subtopic, difficulty')
        .eq('subject', subject)
        .in('subtopic', expanded)
        .limit(20);

    if (error) {
        console.error('[quiz/allocate] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
    }

    // Step 3: Score and filter resources
    const typed = (resources ?? []);
    const filtered = typed.filter(r => {
        if (Math.abs(r.grade - grade_band) > 1) return false;
        if (recent.has(r.id)) return false;
        if (low_data_mode && r.size_kb > 500) return false;
        return true;
    });

    // Sort by level match (exact match first, then nearby)
    const sorted = filtered
        .map(r => ({
            ...r,
            _score: (r.grade === grade_band ? 0.35 : 0) +
                Math.max(0, 0.25 - Math.abs(r.difficulty - level) * 0.1),
        }))
        .sort((a, b) => b._score - a._score)
        .slice(0, 10)
        .map(({ _score, ...r }) => r);

    // Fallback if nothing matched
    const pool = sorted.length > 0
        ? sorted
        : typed.filter(r => !recent.has(r.id)).slice(0, 10);

    return NextResponse.json({
        resource_ids: pool.map(r => r.id),
        resources: pool,
    });
}
