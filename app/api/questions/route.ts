import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * GET /api/questions?topic=cell_structure&grade_band=2&level=2&count=6&reset=true
 *
 * Calls the local Python engine and returns generated questions as JSON.
 * Pass reset=true to clear seen-state for the topic (used by "New Set" button).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic') || 'cell_structure';
    const grade_band = parseInt(searchParams.get('grade_band') || '2');
    const level = parseInt(searchParams.get('level') || '2');
    const count = parseInt(searchParams.get('count') || '6');
    const reset = searchParams.get('reset') === 'true';

    const engineDir = path.join(process.cwd(), 'question_engine');

    const args = [
        `python run.py`,
        `--topic="${topic}"`,
        `--grade_band=${grade_band}`,
        `--level=${level}`,
        `--count=${count}`,
        ...(reset ? ['--reset'] : []),
    ].join(' ');

    try {
        const { stdout } = await execAsync(args, {
            cwd: engineDir,
            timeout: 15000,
        });
        return NextResponse.json(JSON.parse(stdout.trim()));
    } catch (err: any) {
        console.error('[API/questions] Engine error:', err?.stderr || err?.message);
        return NextResponse.json(
            { questions: [], exhausted: true, error: 'Question engine failed.' },
            { status: 500 }
        );
    }
}
