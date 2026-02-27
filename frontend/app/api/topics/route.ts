import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/topics?subject=science&grade_band=2
 *
 * Returns only subtopics that (1) exist in question_bank.json and (2) have at
 * least one resource in the resources table. Guarantees allocate hit for weak subtopics.
 * Grade tolerance: ±1 band.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = (searchParams.get('subject') || '').toLowerCase();
    const grade_band = parseInt(searchParams.get('grade_band') || '2');

    const bankPath = path.join(process.cwd(), '..', 'backend', 'question_engine', 'question_bank.json');

    try {
        const raw = fs.readFileSync(bankPath, 'utf-8');
        const bank = JSON.parse(raw) as Record<string, Record<string, Record<string, unknown>>>;

        const subjectData = bank[subject];
        if (!subjectData) {
            return NextResponse.json({ topics: [] }, { status: 200 });
        }

        // Build candidate topics from question_bank (grade_band ±1)
        const seen = new Set<string>();
        const candidateTopics: { topic: string; label: string }[] = [];

        for (let delta = 0; delta <= 1; delta++) {
            for (const sign of [0, 1, -1]) {
                const gb = grade_band + sign * delta;
                const gradeKey = `grade${gb}`;
                const gradeData = subjectData[gradeKey];
                if (!gradeData) continue;

                for (const subtopic of Object.keys(gradeData)) {
                    if (!seen.has(subtopic)) {
                        seen.add(subtopic);
                        candidateTopics.push({
                            topic: subtopic,
                            label: subtopic
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, c => c.toUpperCase()),
                        });
                    }
                }
            }
        }

        // Fetch valid (subject, grade, subtopic) from resources table
        const grades = [grade_band - 1, grade_band, grade_band + 1].filter(g => g >= 1 && g <= 5);
        let validSet: Set<string> = new Set();
        try {
            const supabase = createServerSupabase();
            const { data, error } = await supabase
                .from('resources')
                .select('subject, grade, subtopic')
                .eq('subject', subject)
                .in('grade', grades);

            if (error) {
                console.error('[API/topics] Supabase error:', error.message);
                return NextResponse.json({ topics: [] }, { status: 200 });
            }

            (data ?? []).forEach((row: { subject: string; grade: number; subtopic: string }) => {
                validSet.add(`${row.subject}:${row.grade}:${row.subtopic}`);
            });
        } catch (e) {
            console.error('[API/topics] Supabase unavailable:', e);
            return NextResponse.json(
                { error: 'Topics service unavailable' },
                { status: 503 }
            );
        }

        // Only return topics that exist in resources for this subject and grade range
        const topics = candidateTopics.filter(ct => {
            return grades.some(g => validSet.has(`${subject}:${g}:${ct.topic}`));
        });

        return NextResponse.json(
            { topics },
            {
                headers: {
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                },
            }
        );
    } catch (err) {
        console.error('[API/topics] Error reading question_bank.json:', err);
        return NextResponse.json({ topics: [] }, { status: 200 });
    }
}
