'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Video, AlignLeft, Download, ExternalLink, ChevronDown } from 'lucide-react';
import { trackMetadataFetch, trackResourceOpen } from '@/lib/data-tracker';
import { cn } from '@/lib/utils';

export interface ResourceMeta {
    id: string;
    title: string;
    type: 'pdf' | 'video' | 'text';
    size_kb: number;
    preview_text?: string;
    thumbnail_url?: string | null;
    subtopic?: string;
}

interface ResourceCardProps {
    resource: ResourceMeta;
    lowDataMode?: boolean;
}

const TYPE_ICONS = {
    pdf: FileText,
    video: Video,
    text: AlignLeft,
};

const TYPE_COLORS = {
    pdf: 'text-red-500',
    video: 'text-purple-500',
    text: 'text-blue-500',
};

function formatSize(kb: number): string {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function ResourceCard({ resource, lowDataMode = false }: ResourceCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [loadingUrl, setLoadingUrl] = useState(false);
    const [urlError, setUrlError] = useState('');

    // Track that metadata was shown
    trackMetadataFetch(1);

    const Icon = TYPE_ICONS[resource.type] ?? FileText;
    const iconColor = TYPE_COLORS[resource.type] ?? 'text-muted-foreground';

    /** Phase 2: fetch signed URL on user click */
    const fetchContent = async () => {
        if (url) return; // already fetched
        setLoadingUrl(true);
        setUrlError('');
        try {
            const res = await fetch(`/api/resource/${resource.id}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            setUrl(data.url);
            trackResourceOpen(resource.size_kb); // track actual data used
        } catch {
            setUrlError('Could not load resource. Try again.');
        } finally {
            setLoadingUrl(false);
        }
    };

    return (
        <Card className="overflow-hidden">
            {/* Thumbnail (Phase 1 — only if not Low Data Mode and thumbnail exists) */}
            {!lowDataMode && resource.thumbnail_url && (
                <div className="h-28 w-full overflow-hidden bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={resource.thumbnail_url}
                        alt={resource.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                </div>
            )}

            <div className="p-4">
                {/* Header row */}
                <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 shrink-0', iconColor)}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-brand text-sm font-semibold text-foreground leading-snug">
                            {resource.title}
                        </p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-brand text-xs uppercase">
                                {resource.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatSize(resource.size_kb)}</span>
                            {resource.subtopic && (
                                <span className="text-xs text-muted-foreground capitalize">
                                    {resource.subtopic.replace(/_/g, ' ')}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Expand/collapse preview */}
                    {resource.preview_text && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
                        </button>
                    )}
                </div>

                {/* Preview text (expandable) */}
                {expanded && resource.preview_text && (
                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                        {resource.preview_text}
                    </p>
                )}

                {/* Phase 2: View + Download buttons (only after click) */}
                <div className="mt-3 flex gap-2">
                    {!url && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="font-brand text-xs"
                            onClick={fetchContent}
                            disabled={loadingUrl}
                        >
                            {loadingUrl ? 'Loading…' : 'View Resource'}
                        </Button>
                    )}

                    {url && (
                        <>
                            <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-brand text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                <ExternalLink className="h-3 w-3" /> View
                            </a>
                            <a
                                href={url}
                                download
                                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-brand text-foreground transition-colors hover:bg-secondary"
                            >
                                <Download className="h-3 w-3" /> Download
                            </a>
                        </>
                    )}
                </div>

                {urlError && (
                    <p className="mt-2 text-xs text-destructive">{urlError}</p>
                )}
            </div>
        </Card>
    );
}
