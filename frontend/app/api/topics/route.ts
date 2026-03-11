import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/topics?subject=science&grade_band=2
 *
 * Returns subtopics that:
 *   1. Exist in question_bank.json (so questions can be generated), AND
 *   2. Have at least one matching resource in Supabase (so allocation works).
 *
 * This ensures the quiz never asks about a topic that has no resources to show afterward.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const subject = (searchParams.get('subject') || '').toLowerCase();
        const grade_band = parseInt(searchParams.get('grade_band') || '2', 10) || 2;

        // ── 1. Read question bank ────────────────────────────────────────────
        const cwd = process.cwd();
        const bankPathCandidates = [
            path.join(cwd, 'question_engine', 'question_bank.json'),
            path.join(cwd, '..', 'question_engine', 'question_bank.json'),
            path.join(cwd, '..', 'backend', 'question_engine', 'question_bank.json'),
            path.join(cwd, 'backend', 'question_engine', 'question_bank.json'),
        ];
        const bankPath = bankPathCandidates.find(p => fs.existsSync(p));
        if (!bankPath) {
            console.error('[API/topics] question_bank.json not found. Tried:', bankPathCandidates.join('; '));
            return NextResponse.json({ topics: [] }, { status: 200 });
        }

        const raw = fs.readFileSync(bankPath, 'utf-8');
        const bank = JSON.parse(raw) as Record<string, Record<string, Record<string, unknown>>>;

        const subjectData = bank[subject];
        if (!subjectData) {
            return NextResponse.json({ topics: [] }, { status: 200 });
        }

        // Collect all candidate subtopics from question bank (grade ±1 tolerance)
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

        if (candidateTopics.length === 0) {
            return NextResponse.json({ topics: [] }, { status: 200 });
        }

        // ── 2. Cross-reference with Supabase resources ───────────────────────
        // Only keep subtopics that have at least one resource entry.
        // This guarantees the allocation step will always return something.
        let resourceSubtopics: Set<string> = new Set(candidateTopics.map(t => t.topic)); // fallback: all
        try {
            const supabase = createServerSupabase();
            const grades = [grade_band - 1, grade_band, grade_band + 1].filter(g => g >= 1 && g <= 5);
            const subtopicList = candidateTopics.map(t => t.topic);

            const { data, error } = await supabase
                .from('resources')
                .select('subtopic')
                .eq('subject', subject)
                .in('grade', grades)
                .in('subtopic', subtopicList);

            if (!error && data && data.length > 0) {
                resourceSubtopics = new Set(data.map((r: { subtopic: string }) => r.subtopic));
            }
        } catch (e) {
            // Supabase unavailable — fall back to returning all question-bank topics
            console.warn('[API/topics] Supabase unavailable for cross-reference, returning all topics:', e instanceof Error ? e.message : String(e));
        }

        // ── 3. Return only topics that have both questions AND resources ──────
        const filteredTopics = candidateTopics.filter(t => resourceSubtopics.has(t.topic));

        return NextResponse.json(
            { topics: filteredTopics },
            {
                headers: {
                    // Short cache so new resources added to Supabase appear quickly
                    'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
                },
            }
        );
    } catch (err) {
        console.error('[API/topics] Error:', err);
        return NextResponse.json({ topics: [] }, { status: 200 });
    }
}
