import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const BUCKET = 'kmap-resources';

/**
 * GET /api/resources/download?id=sci_basic_biology_G1_L1
 *
 * Fetches a single PDF from Supabase Storage ON DEMAND (only when user clicks).
 * Returns a signed URL that expires in 60 seconds.
 * The client redirects/opens the signed URL — no heavy payload through the API.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ?? '';

    if (!id) {
        return NextResponse.json({ error: 'Missing resource id' }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Look up the storage_path for this resource
    const { data: row, error: dbErr } = await supabase
        .from('resources')
        .select('storage_path, title')
        .eq('id', id)
        .single();

    if (dbErr || !row) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Generate a signed URL (expires in 60s)
    const { data: signed, error: storageErr } = await supabase
        .storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60);

    if (storageErr || !signed?.signedUrl) {
        console.error('[resources/download] Storage error:', storageErr?.message);
        return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.json({
        url: signed.signedUrl,
        title: row.title,
    });
}
