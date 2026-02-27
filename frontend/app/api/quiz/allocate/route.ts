import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/quiz/allocate
 * @deprecated Use POST /api/resources/allocate with canonical subject_id, subtopic_id, skill_level instead.
 * Privacy-first: weakness is computed client-side; server only validates IDs and returns resource metadata.
 */
export async function POST(_request: NextRequest) {
    return NextResponse.json(
        { error: 'Deprecated. Use POST /api/resources/allocate with subject_id, subtopic_id, skill_level.' },
        { status: 410 }
    );
}
