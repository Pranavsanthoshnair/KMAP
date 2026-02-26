'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trackMetadataFetch } from '@/lib/data-tracker';

type SimpleResource = {
    id: string;
    title: string;
    type: string;
    size_kb: number;
    subtopic?: string;
};

type ResourceSection = {
    subtopicLabel: string;
    resources: SimpleResource[];
};

const MAX_RESOURCES_PER_WEAK_SUBTOPIC = 1;

// ── Dummy resources fallback (for when Supabase has no data yet) ──────────────

const DUMMY_RESOURCES: SimpleResource[] = [
    {
        id: 'dummy_math_arithmetic_1',
        title: '10-Minute Addition Warm‑Up',
        type: 'pdf',
        size_kb: 120,
        subtopic: 'arithmetic',
    },
    {
        id: 'dummy_math_fractions_1',
        title: 'Fractions on a Number Line',
        type: 'text',
        size_kb: 64,
        subtopic: 'fractions',
    },
    {
        id: 'dummy_math_decimals_1',
        title: 'Decimals and Place Value',
        type: 'text',
        size_kb: 72,
        subtopic: 'decimals',
    },
    {
        id: 'dummy_science_cell_1',
        title: 'Tour of a Cell',
        type: 'pdf',
        size_kb: 140,
        subtopic: 'cell_structure',
    },
    {
        id: 'dummy_english_grammar_1',
        title: 'Parts of Speech Quick Reference',
        type: 'text',
        size_kb: 58,
        subtopic: 'grammar',
    },
];

function humanizeSubtopic(st: string): string {
    return (st || '').replace(/_/g, ' ').trim();
}

function makePlaceholderResource(subject: string, subtopic: string): SimpleResource {
    const safeSubject = (subject || 'subject').toLowerCase();
    const safeSubtopic = (subtopic || 'topic').toLowerCase();
    const pretty = humanizeSubtopic(safeSubtopic);
    return {
        id: `placeholder_${safeSubject}_${safeSubtopic}`,
        title: `Practice pack: ${pretty || 'Topic'}`,
        type: 'text',
        size_kb: 32,
        subtopic: safeSubtopic,
    };
}

function pickFallbackForSubtopic(subject: string, subtopic?: string): SimpleResource[] {
    if (!subtopic) {
        // If we ever land here, return a tiny generic set.
        return [
            makePlaceholderResource(subject, 'basics'),
            makePlaceholderResource(subject, 'practice'),
        ].slice(0, MAX_RESOURCES_PER_WEAK_SUBTOPIC);
    }

    const targeted = DUMMY_RESOURCES.filter(r => r.subtopic === subtopic);
    if (targeted.length > 0) {
        return targeted.slice(0, MAX_RESOURCES_PER_WEAK_SUBTOPIC);
    }

    // Ensure every weak subtopic gets a unique placeholder (no repeats).
    return [makePlaceholderResource(subject, subtopic)];
}

function formatSize(kb: number): string {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function ResourcesPage() {
    const params = useParams<{ subject: string }>();
    const search = useSearchParams();
    const router = useRouter();

    const subject = (params?.subject ?? '').toLowerCase();
    const gradeBand = parseInt(search.get('grade_band') || '2', 10) || 2;
    const weakParam = search.get('weak') || '';
    const weakSubtopics = Array.from(
        new Set(
            weakParam
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
        ),
    );

    const [sections, setSections] = useState<ResourceSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchResources = async () => {
            setLoading(true);
            setError(null);
            try {
                const targets = weakSubtopics.length ? weakSubtopics : ['__all__'];
                const collected: ResourceSection[] = [];
                let totalCount = 0;
                const seenIds = new Set<string>();

                for (const target of targets) {
                    let url = `/api/resources/browse?subject=${encodeURIComponent(subject)}&grade_band=${gradeBand}`;
                    const isAll = target === '__all__';
                    if (!isAll) {
                        url += `&subtopic=${encodeURIComponent(target)}`;
                    }

                    let resources: SimpleResource[] = [];

                    try {
                        const res = await fetch(url);
                        if (res.ok) {
                            const text = await res.text();
                            if (text) {
                                const data = JSON.parse(text) as { resources?: any[] };
                                const raw = data.resources ?? [];
                                resources = raw
                                    .map(r => ({
                                        id: r.id,
                                        title: r.title,
                                        type: r.type,
                                        size_kb: r.size_kb,
                                        subtopic: r.subtopic,
                                    }))
                                    .filter(r => {
                                        if (seenIds.has(r.id)) return false;
                                        seenIds.add(r.id);
                                        return true;
                                    })
                                    .slice(0, MAX_RESOURCES_PER_WEAK_SUBTOPIC);
                            }
                        }
                    } catch {
                        // swallow — we'll use dummy fallback
                    }

                    if (!resources || resources.length === 0) {
                        resources = pickFallbackForSubtopic(subject, isAll ? undefined : target);
                    }

                    if (cancelled) return;

                    // Label must be the actual weak subtopic requested (avoid accidental repeats).
                    const label = isAll ? 'All topics' : humanizeSubtopic(target);

                    collected.push({ subtopicLabel: label, resources });
                    totalCount += resources.length;
                }

                setSections(collected);
                trackMetadataFetch(totalCount);
            } catch (e: unknown) {
                if (cancelled) return;
                const err = e as { message?: string };
                setError(err?.message || 'Unable to load resources. Showing sample materials.');
                const fallbackTargets = weakSubtopics.length
                    ? weakSubtopics
                    : ['All topics'];
                const fallbackSections: ResourceSection[] = fallbackTargets.map(st => ({
                    subtopicLabel: st === 'All topics' ? st : st.replace(/_/g, ' '),
                    resources: pickFallbackForSubtopic(
                        subject,
                        st === 'All topics' ? undefined : st,
                    ),
                }));
                setSections(fallbackSections);
                trackMetadataFetch(
                    fallbackSections.reduce((sum, s) => sum + s.resources.length, 0),
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchResources();

        return () => {
            cancelled = true;
        };
    }, [subject, gradeBand, weakSubtopics.join(',')]);

    const prettySubject = subject.charAt(0).toUpperCase() + subject.slice(1);

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-4xl px-4 py-8">
                <div className="animate-fade-in space-y-6">
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.back()}
                            className="gap-1.5"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                        {weakSubtopics.length > 0 && (
                            <div className="flex flex-wrap justify-end gap-1">
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Focusing on weaker subtopics:
                                </span>
                                {weakSubtopics.map(st => (
                                    <Badge
                                        key={st}
                                        variant="outline"
                                        className="text-[10px] font-brand capitalize"
                                    >
                                        {st.replace(/_/g, ' ')}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h1 className="font-brand text-2xl font-bold text-foreground">
                            {prettySubject} Resources
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Curated materials based on your recent quiz performance. Tap a
                            resource to open it in a low-data friendly viewer.
                        </p>
                    </div>

                    {loading && (
                        <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                            <BookOpen className="h-6 w-6 animate-pulse text-primary" />
                            Loading resources…
                        </div>
                    )}

                    {!loading && error && (
                        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    {!loading && sections.length === 0 && (
                        <p className="rounded-md border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                            No resources available yet for this subject and level. Try another
                            quiz to refresh your recommendations.
                        </p>
                    )}

                    {!loading && sections.length > 0 && (
                        <div className="space-y-3">
                            {sections.flatMap((section, sectionIndex) =>
                                section.resources.map((r, resourceIndex) => (
                                    <div
                                        key={`${sectionIndex}_${resourceIndex}_${r.id}`}
                                        className="rounded-lg border border-border bg-card/80 px-4 py-3 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-brand text-sm font-semibold text-foreground truncate">
                                                {r.title}
                                            </p>
                                            {section.subtopicLabel && (
                                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-brand uppercase tracking-wide text-muted-foreground">
                                                    {section.subtopicLabel}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="uppercase tracking-wide">{r.type}</span>
                                            <span>· {formatSize(r.size_kb)}</span>
                                        </div>
                                    </div>
                                )),
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

