import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * GET /api/questions
 *
 * Params:
 *   topic      — primary subtopic slug (e.g. "fractions")
 *   subject    — "math" | "science" | "english"
 *   grade_band — 1–5
 *   level      — 1 (beginner) | 2 (intermediate) | 3 (advanced)
 *   count      — number of questions (default 6)
 *   mode       — "subtopic" (Mode A, default) | "subject" (Mode B, mixed)
 *   subtopics  — comma-separated list (Mode A multi, first used as primary)
 *   reset      — "true" to clear seen-state (handled in engine)
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const topic = searchParams.get('topic') || 'cell_structure';
    const subject = searchParams.get('subject') || '';
    const grade_band = parseInt(searchParams.get('grade_band') || '2');
    const level = parseInt(searchParams.get('level') || '2');
    const count = parseInt(searchParams.get('count') || '6');
    const mode = searchParams.get('mode') || 'subtopic';   // "subtopic" | "subject"
    const subtopics = searchParams.get('subtopics') || '';
    const reset = searchParams.get('reset') === 'true';

    const engineDir = path.join(process.cwd(), '..', 'backend', 'question_engine');

    const args = [
        'python run.py',
        `--topic=${topic}`,
        `--grade_band=${grade_band}`,
        `--level=${level}`,
        `--count=${count}`,
        `--mode=${mode}`,
        ...(subject ? [`--subject=${subject}`] : []),
        ...(subtopics ? [`--subtopics=${subtopics}`] : []),
        ...(reset ? ['--reset'] : []),
    ].join(' ');

    try {
        const { stdout } = await execAsync(args, { cwd: engineDir, timeout: 15000 });
        const data = JSON.parse(stdout.trim());
        return NextResponse.json(data);
    } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        console.error('[API/questions] Engine error:', e?.stderr || e?.message);
        return NextResponse.json(
            { questions: [], exhausted: true, error: 'Question engine failed.' },
            { status: 500 }
        );
    }
}
