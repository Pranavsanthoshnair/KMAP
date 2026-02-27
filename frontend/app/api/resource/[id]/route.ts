import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * GET /api/resource/[id]
 *
 * Phase 2 lazy load — returns a signed Supabase Storage URL valid for 60 minutes.
 * Called ONLY when the user explicitly clicks View or Download.
 * No pre-loading, no auto-download.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id) {
        return NextResponse.json({ error: 'Resource ID required' }, { status: 400 });
    }

    let supabase;
    try {
        supabase = createServerSupabase();
    } catch (e) {
        console.error('[GET /api/resource/[id]] Supabase unavailable:', e);
        return NextResponse.json({ error: 'Resources service unavailable' }, { status: 503 });
    }

    // Fetch the storage_path for this resource
    const { data: resource, error: fetchError } = await supabase
        .from('resources')
        .select('id, storage_path, type, size_kb, title')
        .eq('id', id)
        .single();

    if (fetchError || !resource) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Generate a signed URL (60 min expiry)
    const { data: signed, error: signError } = await supabase
        .storage
        .from('kmap-resources')
        .createSignedUrl(resource.storage_path, 3600);

    if (signError || !signed) {
        console.error('[GET /api/resource/[id]] Sign error:', signError?.message);
        return NextResponse.json({ error: 'Could not generate access URL' }, { status: 500 });
    }

    return NextResponse.json({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        size_kb: resource.size_kb,
        url: signed.signedUrl,  // Temporary, expires in 60 min
    });
}
