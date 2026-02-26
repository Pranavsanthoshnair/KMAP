import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/topics?subject=science&grade_band=2
 *
 * Reads facts.json and returns all unique topics
 * matching the given subject and grade_band.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') || '';
    const grade_band = parseInt(searchParams.get('grade_band') || '0');

    const factsPath = path.join(process.cwd(), 'question_engine', 'facts.json');

    try {
        const raw = fs.readFileSync(factsPath, 'utf-8');
        const facts = JSON.parse(raw) as Array<{
            subject: string;
            topic: string;
            grade_band: number;
        }>;

        // Collect unique topics matching the filters
        const seen = new Set<string>();
        const topics: { topic: string; label: string }[] = [];

        for (const f of facts) {
            const matchSubject = !subject || f.subject === subject;
            // Grade band tolerance: show topics within ±1 band so content is never empty
            const matchGrade = !grade_band || Math.abs(f.grade_band - grade_band) <= 1;

            if (matchSubject && matchGrade && !seen.has(f.topic)) {
                seen.add(f.topic);
                topics.push({
                    topic: f.topic,
                    // "cell_structure" → "Cell Structure"
                    label: f.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                });
            }
        }

        return NextResponse.json({ topics });
    } catch (err) {
        console.error('[API/topics] Error reading facts.json:', err);
        return NextResponse.json({ topics: [] });
    }
}
