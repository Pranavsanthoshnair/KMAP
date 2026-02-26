import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Fact {
    subject: string;
    topic: string;
    grade_band: number;
}

// ── Module-level cache — parsed once per server process lifetime ─────────────
let factsCache: Fact[] | null = null;

function getFacts(): Fact[] {
    if (factsCache) return factsCache;
    const factsPath = path.join(process.cwd(), 'question_engine', 'facts.json');
    const raw = fs.readFileSync(factsPath, 'utf-8');
    factsCache = JSON.parse(raw) as Fact[];
    return factsCache;
}

/**
 * GET /api/topics?subject=science&grade_band=2
 *
 * Returns unique topics for the given subject & grade_band.
 * facts.json is cached in memory after the first read.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') || '';
    const grade_band = parseInt(searchParams.get('grade_band') || '0');

    try {
        const facts = getFacts();

        const seen = new Set<string>();
        const topics: { topic: string; label: string }[] = [];

        for (const f of facts) {
            const matchSubject = !subject || f.subject === subject;
            // Grade band tolerance ±1 so content is never empty
            const matchGrade = !grade_band || Math.abs(f.grade_band - grade_band) <= 1;

            if (matchSubject && matchGrade && !seen.has(f.topic)) {
                seen.add(f.topic);
                topics.push({
                    topic: f.topic,
                    label: f.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                });
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
        console.error('[API/topics] Error reading facts.json:', err);
        return NextResponse.json({ topics: [] });
    }
}
