import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/resources?ids=r001,r002,r003&low_data=false
 *
 * Phase 1 lazy load — returns METADATA ONLY.
 * No heavy content, no auto-download.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') ?? '';
    const lowData = searchParams.get('low_data') === 'true';

    const ids = idsParam
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .slice(0, 20); // hard cap to prevent abuse

    if (ids.length === 0) {
        return NextResponse.json([]);
    }

    let supabase;
    try {
        supabase = createServerSupabase();
    } catch (e) {
        console.error('[GET /api/resources] Supabase unavailable:', e);
        return NextResponse.json({ error: 'Resources service unavailable' }, { status: 503 });
    }

    // Select only metadata — NOT storage_path (we never expose that directly)
    const { data, error } = await supabase
        .from('resources')
        .select('id, title, type, size_kb, preview_text, thumbnail_url, subtopic, subject, grade, difficulty')
        .in('id', ids);

    if (error) {
        console.error('[GET /api/resources] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to fetch resource metadata' }, { status: 500 });
    }

    // Apply Low Data Mode: strip thumbnails to save bandwidth
    const payload = (data ?? []).map(r => ({
        ...r,
        thumbnail_url: lowData ? null : r.thumbnail_url,
    }));

    // Preserve the requested ID order
    const ordered = ids
        .map(id => payload.find(r => r.id === id))
        .filter(Boolean);

    return NextResponse.json(ordered);
}
