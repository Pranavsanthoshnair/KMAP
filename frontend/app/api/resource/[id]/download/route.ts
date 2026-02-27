import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const BUCKET = 'kmap-resources';

/** Sanitize for use in Content-Disposition filename (ASCII, no quotes/newlines) */
function safeFilename(name: string, ext: string): string {
    const base = name.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_').slice(0, 100) || 'resource';
    return `${base}.${ext}`;
}

/**
 * GET /api/resource/[id]/download
 *
 * Streams the file from Supabase Storage and returns it with
 * Content-Disposition: attachment so the browser saves it locally.
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
        console.error('[GET /api/resource/[id]/download] Supabase unavailable:', e);
        return NextResponse.json({ error: 'Resources service unavailable' }, { status: 503 });
    }

    const { data: resource, error: fetchError } = await supabase
        .from('resources')
        .select('id, storage_path, type, title')
        .eq('id', id)
        .single();

    if (fetchError || !resource) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    let blob: Blob | null = null;
    let downloadError: { message?: string } | null = null;
    try {
        const result = await supabase.storage.from(BUCKET).download(resource.storage_path);
        blob = result.data;
        downloadError = result.error;
    } catch (e) {
        console.error('[GET /api/resource/[id]/download] Storage error:', e);
        return NextResponse.json({ error: 'Could not download file' }, { status: 500 });
    }

    if (downloadError || !blob) {
        console.error('[GET /api/resource/[id]/download] Storage error:', downloadError?.message);
        return NextResponse.json({ error: 'Could not download file' }, { status: 500 });
    }

    const pathExt = resource.storage_path?.split('.').pop()?.toLowerCase();
    const typeExt = (resource.type === 'pdf' ? 'pdf' : resource.type === 'video' ? 'mp4' : 'txt').toLowerCase();
    const ext = pathExt && /^[a-z0-9]+$/.test(pathExt) ? pathExt : typeExt;
    const filename = safeFilename(resource.title ?? 'resource', ext);

    return new NextResponse(blob, {
        headers: {
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': blob.type || 'application/octet-stream',
            'Cache-Control': 'private, no-cache',
        },
    });
}
