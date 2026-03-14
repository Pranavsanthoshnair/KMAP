import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/** Single allocation request: canonical IDs only. No user data, no analytics. */
interface AllocateItem {
    subject_id: string;
    subtopic_id: string;
    skill_level: number;
}

/** Request body: items and optional low_data_mode flag. */
interface AllocatePayload {
    requests?: AllocateItem[];
    low_data_mode?: boolean;
}

/** Alternative shape from resources page: single subject + array of subtopics. */
interface AllocateBySubtopicsPayload {
    subject?: string;
    grade_band?: number;
    skill_level?: number;
    subtopics?: string[];
    limit_per_subtopic?: number;
    low_data_mode?: boolean;
}

interface ResourceMeta {
    id: string;
    title: string;
    thumbnail_url: string | null;
    difficulty: number;
    subject: string;
    subtopic: string;
    type?: string;
    size_kb?: number;
}

interface ResourceSection {
    subtopicLabel: string;
    resources: ResourceMeta[];
}

/**
 * POST /api/resources/allocate
 * Queries public.resources (schema: grade, difficulty, title per Supabase gen types).
 */
export async function POST(request: NextRequest) {
    let body: AllocatePayload | AllocateBySubtopicsPayload | AllocateItem | AllocateItem[];
    try {
        body = (await request.json()) as AllocatePayload | AllocateBySubtopicsPayload | AllocateItem | AllocateItem[];
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        return await runAllocate(body);
    } catch (err) {
        const message = (err instanceof Error ? err.message : String(err)) || 'Unknown error';
        console.error('[API/resources/allocate] Unhandled error:', err);
        return NextResponse.json(
            { error: 'Allocation failed', resources: [], sections: [], details: message },
            { status: 500 },
        );
    }
}

async function runAllocate(body: AllocatePayload | AllocateBySubtopicsPayload | AllocateItem | AllocateItem[]): Promise<NextResponse> {
    let items: AllocateItem[];
    let low_data_mode = false;
    let gradeBand: number | null = null;
    if (Array.isArray(body)) {
        items = body;
    } else if (body && typeof body === 'object' && 'requests' in body) {
        items = (body as AllocatePayload).requests ?? [];
        low_data_mode = Boolean((body as AllocatePayload).low_data_mode);
    } else if (body && typeof body === 'object' && 'subtopics' in body && Array.isArray((body as AllocateBySubtopicsPayload).subtopics)) {
        const b = body as AllocateBySubtopicsPayload;
        const subject = (b.subject ?? '').toString().toLowerCase().trim();
        const gb = Number(b.grade_band) || 2;
        gradeBand = Math.max(1, Math.min(5, gb));
        const skillFromGrade = gb <= 1 ? 1 : gb <= 3 ? 2 : 3;
        const skill = Math.max(1, Math.min(3, Number(b.skill_level) || skillFromGrade));
        const subtopics = (b.subtopics ?? []).filter((s): s is string => typeof s === 'string').map(s => s.toLowerCase().trim()).filter(Boolean);
        low_data_mode = Boolean(b.low_data_mode);
        items = subtopics.map(subtopic_id => ({ subject_id: subject, subtopic_id, skill_level: skill }));
    } else {
        items = [body as AllocateItem];
    }

    let supabase;
    try {
        supabase = createServerSupabase();
    } catch (e) {
        console.error('[API/resources/allocate] Supabase unavailable:', e);
        return NextResponse.json({ error: 'Resources service unavailable' }, { status: 503 });
    }

    const grades = gradeBand != null
        ? [gradeBand - 1, gradeBand, gradeBand + 1].filter(g => g >= 1 && g <= 5)
        : [1, 2, 3, 4, 5];

    const selectCols = 'id, title, thumbnail_url, difficulty, type, size_kb, subject, subtopic';
    const allResources: ResourceMeta[] = [];
    const seenIds = new Set<string>();

    for (const item of items) {
        const subject_id = (item.subject_id ?? '').toLowerCase().trim();
        const subtopic_id = (item.subtopic_id ?? '').toLowerCase().trim();
        const skill_level = Math.max(1, Math.min(3, Number(item.skill_level) || 2));

        if (!subject_id || !subtopic_id) continue;

        let exactRows: unknown[] | null = null;
        let exactErr: { message: string } | null = null;
        try {
            const res = await supabase
                .from('resources')
                .select(selectCols)
                .eq('subject', subject_id)
                .eq('subtopic', subtopic_id)
                .eq('difficulty', skill_level)
                .in('grade', grades);
            exactRows = res.data;
            exactErr = res.error;
        } catch (e) {
            console.warn('[API/resources/allocate] Supabase request failed', subject_id, subtopic_id, e instanceof Error ? e.message : String(e));
            continue;
        }

        if (exactErr) {
            console.warn('[API/resources/allocate] Supabase error', subject_id, subtopic_id, exactErr.message);
            continue;
        }

        let list = (exactRows ?? []) as Array<{ id: string; title: string; thumbnail_url: string | null; difficulty: number; type?: string; size_kb?: number; subject: string; subtopic: string }>;

        if (list.length === 0) {
            try {
                const fallback = await supabase
                    .from('resources')
                    .select(selectCols)
                    .eq('subject', subject_id)
                    .eq('subtopic', subtopic_id)
                    .in('grade', grades)
                    .order('difficulty', { ascending: true })
                    .limit(8);
                list = (fallback.data ?? []).sort(
                    (a, b) => Math.abs(a.difficulty - skill_level) - Math.abs(b.difficulty - skill_level),
                ) as typeof list;
            } catch {
                continue;
            }
        }

        if (low_data_mode) {
            list = list.filter(r => r.type !== 'video' && (r.size_kb ?? 0) <= 500);
        }
        for (const r of list.slice(0, 3)) {
            if (seenIds.has(r.id)) continue;
            seenIds.add(r.id);
            allResources.push({
                id: r.id,
                title: r.title,
                thumbnail_url: r.thumbnail_url ?? null,
                difficulty: r.difficulty,
                subject: r.subject,
                subtopic: r.subtopic,
                type: r.type,
                size_kb: r.size_kb,
            });
        }
    }

    if (allResources.length === 0) {
        console.warn('[API/resources/allocate] No resources for items:', JSON.stringify(items).slice(0, 400));

        // As a minimal, privacy-preserving fallback, try a broader subject+grade
        // browse similar to /api/resources/browse so that users still see some
        // material even if there are no exact subtopic matches.
        try {
            const fallbackGrades = gradeBand != null
                ? [gradeBand - 1, gradeBand, gradeBand + 1].filter(g => g >= 1 && g <= 5)
                : [1, 2, 3, 4, 5];

            const firstItem = items[0];
            const fallbackSubject = (firstItem?.subject_id ?? '').toLowerCase().trim();

            if (!fallbackSubject) {
                return NextResponse.json({ resources: [], sections: [] });
            }

            const { data, error } = await supabase
                .from('resources')
                .select(selectCols)
                .eq('subject', fallbackSubject)
                .in('grade', fallbackGrades)
                .limit(20);

            if (error || !data || data.length === 0) {
                if (error) {
                    console.warn('[API/resources/allocate] Subject-level fallback error:', error.message);
                }
                return NextResponse.json({ resources: [], sections: [] });
            }

            let list = data as Array<{ id: string; title: string; thumbnail_url: string | null; difficulty: number; type?: string; size_kb?: number; subject: string; subtopic: string }>;
            if (low_data_mode) {
                list = list.filter(r => r.type !== 'video' && (r.size_kb ?? 0) <= 500);
            }

            const deduped: ResourceMeta[] = [];
            const seen = new Set<string>();
            for (const r of list) {
                if (seen.has(r.id)) continue;
                seen.add(r.id);
                deduped.push({
                    id: r.id,
                    title: r.title,
                    thumbnail_url: r.thumbnail_url ?? null,
                    difficulty: r.difficulty,
                    subject: r.subject,
                    subtopic: r.subtopic,
                    type: r.type,
                    size_kb: r.size_kb,
                });
            }

            const bySubtopic = new Map<string, ResourceMeta[]>();
            for (const r of deduped) {
                const key = (r.subtopic || 'recommended').toLowerCase();
                const existing = bySubtopic.get(key);
                if (existing) existing.push(r);
                else bySubtopic.set(key, [r]);
            }
            const sections: ResourceSection[] = Array.from(bySubtopic.entries()).map(([subtopic, resources]) => ({
                subtopicLabel: subtopic,
                resources,
            }));

            return NextResponse.json({ resources: deduped, sections });
        } catch (e) {
            console.warn('[API/resources/allocate] Subject-level fallback failed:', e instanceof Error ? e.message : String(e));
            return NextResponse.json({ resources: [], sections: [] });
        }
    }

    const bySubtopic = new Map<string, ResourceMeta[]>();
    for (const r of allResources) {
        const key = (r.subtopic || 'recommended').toLowerCase();
        const existing = bySubtopic.get(key);
        if (existing) existing.push(r);
        else bySubtopic.set(key, [r]);
    }
    const sections: ResourceSection[] = Array.from(bySubtopic.entries()).map(([subtopic, resources]) => ({
        subtopicLabel: subtopic,
        resources,
    }));

    return NextResponse.json({ resources: allResources, sections });
}
