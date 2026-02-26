import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * POST /api/resources
 * Body: { "filter": "010011...", "level": 1, "grade_band": 2 }
 *
 * Calls the local resource_engine and returns matched modules.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { filter, level, grade_band } = body;

        if (!filter || level === undefined || grade_band === undefined) {
            return NextResponse.json(
                { error: 'Missing required parameters: filter, level, grade_band' },
                { status: 400 }
            );
        }

        const engineDir = path.join(process.cwd(), 'resource_engine');

        // Build the command
        const cmd = `python run.py --filter="${filter}" --level=${level} --grade_band=${grade_band}`;

        const { stdout } = await execAsync(cmd, {
            cwd: engineDir,
            timeout: 10000, // 10 second safety timeout
        });

        const result = JSON.parse(stdout.trim());

        if (result.error) {
            console.error('[API/resources] Engine returned error:', result.error);
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json(result);

    } catch (err: any) {
        console.error('[API/resources] Error:', err?.message || err);
        return NextResponse.json(
            { error: 'Failed to fetch resources.' },
            { status: 500 }
        );
    }
}
