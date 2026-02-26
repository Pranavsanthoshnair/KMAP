import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/resources/browse
 *  ?subject=math&grade_band=3&subtopic=fractions   (optional subtopic)
 *  ?subject=science&grade_band=2                   (all subtopics for subject+grade)
 *
 * Returns resource metadata (no storage_path) from Supabase resources table.
 * low_data=true strips thumbnail_url.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') || '';
    const grade_band = parseInt(searchParams.get('grade_band') || '2');
    const subtopic = searchParams.get('subtopic') || '';
    const low_data = searchParams.get('low_data') === 'true';

    const supabase = createServerSupabase();

    // Grade tolerance ±1 band
    const grades = [grade_band - 1, grade_band, grade_band + 1].filter(g => g >= 1 && g <= 5);

    let query = supabase
        .from('resources')
        .select('id, title, type, size_kb, preview_text, thumbnail_url, subject, grade, subtopic, difficulty')
        .in('grade', grades)
        .limit(12);

    if (subject) query = query.eq('subject', subject);
    if (subtopic) query = query.eq('subtopic', subtopic);

    const { data, error } = await query;

    if (error) {
        console.error('[API/resources/browse]', error.message);
        return NextResponse.json({ resources: [] }, { status: 500 });
    }

    const resources = (data ?? []).map(r => ({
        ...r,
        thumbnail_url: low_data ? null : r.thumbnail_url,
    }));

    return NextResponse.json({ resources });
}
