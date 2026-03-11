import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/resources/browse
 * ?subject=math&grade_band=2&subtopic=fractions
 * Uses public.resources schema: grade, difficulty, title (per Supabase gen types).
 * Always returns 200; on error returns { resources: [] } and logs.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const subject = (searchParams.get('subject') ?? '').trim().toLowerCase();
        const grade_band = Math.max(1, Math.min(5, parseInt(searchParams.get('grade_band') ?? '2', 10) || 2));
        const subtopic = (searchParams.get('subtopic') ?? '').trim().toLowerCase();
        const low_data = searchParams.get('low_data') === 'true';

        let supabase;
        try {
            supabase = createServerSupabase();
        } catch (e) {
            console.error('[API/resources/browse] Supabase init failed:', e);
            return NextResponse.json({ resources: [] });
        }

        const grades = [grade_band - 1, grade_band, grade_band + 1].filter(g => g >= 1 && g <= 5);
        if (grades.length === 0) {
            return NextResponse.json({ resources: [] });
        }

        let query = supabase
            .from('resources')
            .select('id, title, type, size_kb, preview_text, thumbnail_url, subject, subtopic, difficulty')
            .in('grade', grades)
            .limit(20);
        if (subject) query = query.eq('subject', subject);
        if (subtopic) query = query.eq('subtopic', subtopic);

        let data: unknown[] | null = null;
        let error: { message: string; code?: string } | null = null;
        try {
            const result = await query;
            data = result.data;
            error = result.error;
        } catch (e) {
            console.error('[API/resources/browse] Supabase request failed (fetch/network):', e);
            return NextResponse.json({ resources: [] });
        }
        if (error) {
            console.error('[API/resources/browse] Supabase query error:', error.message, error.code);
            return NextResponse.json({ resources: [] });
        }

        const resources = (data ?? []).map((r: { thumbnail_url?: string | null }) => ({
            ...r,
            thumbnail_url: low_data ? null : (r.thumbnail_url ?? null),
        }));

        return NextResponse.json({ resources });
    } catch (err) {
        console.error('[API/resources/browse] Unhandled error:', err);
        return NextResponse.json({ resources: [] });
    }
}
