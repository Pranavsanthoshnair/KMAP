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

interface ResourceMeta {
    id: string;
    title: string;
    thumbnail_url: string | null;
    difficulty: number;
    subject: string;
    subtopic: string;
}

/**
 * POST /api/resources/allocate
 * Stateless: accepts only subject_id, subtopic_id, skill_level per request.
 * Validates by querying resources table; returns minimal metadata only.
 * No request logging, no user storage.
 */
export async function POST(request: NextRequest) {
    let body: AllocatePayload | AllocateItem | AllocateItem[];
    try {
        body = (await request.json()) as AllocatePayload | AllocateItem | AllocateItem[];
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let items: AllocateItem[];
    let low_data_mode = false;
    if (Array.isArray(body)) {
        items = body;
    } else if (body && typeof body === 'object' && 'requests' in body) {
        items = (body as AllocatePayload).requests ?? [];
        low_data_mode = Boolean((body as AllocatePayload).low_data_mode);
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

    const allResources: ResourceMeta[] = [];
    const seenIds = new Set<string>();

    for (const item of items) {
        const subject_id = (item.subject_id ?? '').toLowerCase().trim();
        const subtopic_id = (item.subtopic_id ?? '').toLowerCase().trim();
        const skill_level = Math.max(1, Math.min(3, Number(item.skill_level) || 2));

        if (!subject_id || !subtopic_id) {
            continue;
        }

        // First try exact difficulty match
        const { data: exactRows, error: exactErr } = await supabase
            .from('resources')
            .select('id, title, thumbnail_url, difficulty, type, size_kb, subject, subtopic')
            .eq('subject', subject_id)
            .eq('subtopic', subtopic_id)
            .eq('difficulty', skill_level);

        if (exactErr) {
            continue;
        }

        let list = (exactRows ?? []) as Array<{ id: string; title: string; thumbnail_url: string | null; difficulty: number; type: string; size_kb: number; subject: string; subtopic: string; }>;

        // Fallback: if no exact match, get nearest level
        if (list.length === 0) {
            const { data: fallbackRows } = await supabase
                .from('resources')
                .select('id, title, thumbnail_url, difficulty, type, size_kb, subject, subtopic')
                .eq('subject', subject_id)
                .eq('subtopic', subtopic_id)
                .order('difficulty', { ascending: true })
                .limit(5);

            list = ((fallbackRows ?? []) as typeof list)
                .sort((a, b) => Math.abs(a.difficulty - skill_level) - Math.abs(b.difficulty - skill_level));
        }

        if (low_data_mode) {
            list = list.filter(r => r.type !== 'video' && (r.size_kb ?? 0) <= 500);
        }
        list = list.slice(0, 3);
        const metaList: ResourceMeta[] = list.map(({ id, title, thumbnail_url, difficulty, subject, subtopic }) => ({
            id,
            title,
            thumbnail_url: thumbnail_url ?? null,
            difficulty,
            subject,
            subtopic,
        }));

        for (const r of metaList) {
            if (!seenIds.has(r.id)) {
                seenIds.add(r.id);
                allResources.push(r);
            }
        }
    }

    return NextResponse.json({ resources: allResources });
}
