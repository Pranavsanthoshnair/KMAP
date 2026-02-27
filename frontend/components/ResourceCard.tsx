'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, Video, AlignLeft, Download, ExternalLink, ChevronDown } from 'lucide-react';
import { trackResourceOpen } from '@/lib/data-tracker';
import { cn } from '@/lib/utils';

export interface ResourceMeta {
    id: string;
    title: string;
    type: string;
    size_kb: number;
    preview_text?: string;
    thumbnail_url?: string | null;
    subtopic?: string;
    subject?: string;
    grade?: number;
    difficulty?: number;
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

    const typeKey = (resource.type in TYPE_ICONS ? (resource.type as keyof typeof TYPE_ICONS) : 'pdf');
    const Icon = TYPE_ICONS[typeKey] ?? FileText;
    const iconColor = TYPE_COLORS[typeKey] ?? 'text-muted-foreground';

    /** Fetch signed URL only for View (open in browser) */
    const fetchViewUrl = async (): Promise<string | null> => {
        if (url) return url;
        setLoadingUrl(true);
        setUrlError('');
        try {
            const res = await fetch(`/api/resource/${resource.id}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            const viewUrl = data.url as string;
            setUrl(viewUrl);
            trackResourceOpen(resource.size_kb);
            return viewUrl;
        } catch {
            setUrlError('Could not load resource. Try again.');
            return null;
        } finally {
            setLoadingUrl(false);
        }
    };

    const handleView = async () => {
        const viewUrl = await fetchViewUrl();
        if (viewUrl) window.open(viewUrl, '_blank', 'noopener,noreferrer');
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

                {/* View (in browser) + Download (save locally) */}
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        className="font-brand text-xs"
                        onClick={handleView}
                        disabled={loadingUrl}
                    >
                        {loadingUrl ? 'Loading…' : (
                            <>
                                <ExternalLink className="h-3 w-3 mr-1.5" /> View
                            </>
                        )}
                    </Button>
                    <a
                        href={`/api/resource/${resource.id}/download`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-brand text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        download
                    >
                        <Download className="h-3 w-3" /> Download
                    </a>
                    {resource.subtopic && resource.subject && resource.difficulty && (
                        <Link
                            href={`/assess?subject=${encodeURIComponent(resource.subject)}&topic=${encodeURIComponent(resource.subtopic)}&level=${resource.difficulty}&title=${encodeURIComponent(resource.title)}`}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-green-600/30 bg-green-500/10 px-3 py-1.5 text-xs font-brand text-green-700 dark:text-green-400 transition-colors hover:bg-green-500/20"
                        >
                            Assess Knowledge
                        </Link>
                    )}
                </div>

                {urlError && (
                    <p className="mt-2 text-xs text-destructive">{urlError}</p>
                )}
            </div>
        </Card>
    );
}
