import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

interface SkillUpdateBody {
    user_id: string;
    skills: Record<string, number>;
    last_scores?: Record<string, number>;
}

export async function POST(request: NextRequest) {
    let body: SkillUpdateBody;
    try {
        body = (await request.json()) as SkillUpdateBody;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { user_id, skills, last_scores } = body;
    if (!user_id || !skills || typeof skills !== 'object') {
        return NextResponse.json({ error: 'Missing user_id or skills' }, { status: 400 });
    }

    const entries = Object.entries(skills).filter(
        ([, lvl]) => Number.isFinite(lvl) && lvl >= 1 && lvl <= 3,
    );
    if (entries.length === 0) {
        return NextResponse.json({ error: 'No valid skills to update' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const rows = entries.map(([subject_id, lvl]) => ({
        user_id,
        subject_id,
        skill_level: Math.max(1, Math.min(3, Math.floor(lvl))),
        last_score: last_scores?.[subject_id],
    }));

    const { error } = await supabase
        .from('user_subject_skills')
        .upsert(rows, { onConflict: 'user_id,subject_id' });

    if (error) {
        console.error('[skill/update] Supabase error:', error.message);
        return NextResponse.json({ error: 'Failed to update skills' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

