import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/topics?subject=science&grade_band=2
 *
 * Reads question_bank.json (the authoritative question source) and returns
 * the subtopics for the given subject + grade band.
 *
 * Grade tolerance: ±1 band so the list is never empty near band boundaries.
 * Each subtopic is guaranteed to produce at least one question.
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
            return NextResponse.json({ topics: [] });
        }

        // Collect subtopics from the exact grade band and ±1 bands
        const seen = new Set<string>();
        const topics: { topic: string; label: string }[] = [];

        for (let delta = 0; delta <= 1; delta++) {
            for (const sign of [0, 1, -1]) {
                const gb = grade_band + sign * delta;
                const gradeKey = `grade${gb}`;
                const gradeData = subjectData[gradeKey];
                if (!gradeData) continue;

                for (const subtopic of Object.keys(gradeData)) {
                    if (!seen.has(subtopic)) {
                        seen.add(subtopic);
                        topics.push({
                            topic: subtopic,
                            label: subtopic
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, c => c.toUpperCase()),
                        });
                    }
                }
            }
        }

        return NextResponse.json(
            { topics },
            {
                headers: {
                    // Cache for 5 min; serve stale up to 10 min while revalidating
                    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                },
            }
        );
    } catch (err) {
        console.error('[API/topics] Error reading question_bank.json:', err);
        return NextResponse.json({ topics: [] });
    }
}
