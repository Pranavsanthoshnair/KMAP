import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/subjects
 * Returns canonical subject IDs and labels from DB. No auth required.
 * Frontend should fallback to hardcoded list if this fails or returns empty.
 */
export async function GET() {
    try {
        const supabase = createServerSupabase();
        const { data, error } = await supabase
            .from('subjects')
            .select('id, label')
            .order('id');

        if (error) {
            console.error('[api/subjects]', error.message);
            return NextResponse.json({ subjects: [] });
        }

        const subjects = (data ?? []).map(r => ({ id: r.id, label: r.label }));
        return NextResponse.json(
            { subjects },
            {
                headers: {
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                },
            }
        );
    } catch (e) {
        console.error('[api/subjects]', e);
        return NextResponse.json({ subjects: [] });
    }
}
