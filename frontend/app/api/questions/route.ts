import { NextRequest, NextResponse } from 'next/server';
import { exec, ExecOptions } from 'child_process';
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

    // On Vercel, use the external Python engine over HTTP.
    if (process.env.VERCEL === '1') {
        const engineUrl = process.env.QUESTION_ENGINE_URL2 ?? process.env.QUESTION_ENGINE_URL;
        if (!engineUrl) {
            return NextResponse.json(
                {
                    questions: [],
                    exhausted: true,
                    error: 'QUESTION_ENGINE_URL2 not configured on server.',
                },
                { status: 500 },
            );
        }

        try {
            const res = await fetch(engineUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    subject,
                    grade_band,
                    level,
                    count,
                    mode,
                    subtopics,
                    reset,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                console.error('[API/questions] HTTP engine error', res.status, text);
                return NextResponse.json(
                    {
                        questions: [],
                        exhausted: true,
                        error: 'Remote question engine HTTP error.',
                        details: text,
                        status: res.status,
                    },
                    { status: 500 },
                );
            }

            const data = await res.json();
            return NextResponse.json(data);
        } catch (err: unknown) {
            const e = err as { message?: string };
            console.error('[API/questions] HTTP engine exception', e?.message);
            return NextResponse.json(
                {
                    questions: [],
                    exhausted: true,
                    error: 'Remote question engine network error.',
                    details: e?.message ?? 'Unknown HTTP exception',
                },
                { status: 500 },
            );
        }
    }

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
        const options: ExecOptions = {
            cwd: engineDir,
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8',
            },
        };
        const result = await execAsync(args, options);
        const raw =
            typeof result.stdout === 'string'
                ? result.stdout.trim()
                : String(result.stdout).trim();
        let data: unknown;
        try {
            data = JSON.parse(raw);
        } catch {
            throw new Error('Question engine returned non‑JSON output');
        }
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
