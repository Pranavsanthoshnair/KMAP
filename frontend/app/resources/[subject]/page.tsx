'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ResourceCard from '@/components/ResourceCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { trackMetadataFetch } from '@/lib/data-tracker';
import { formatSubjectId } from '@/lib/subjects';
import { getLocalProfile } from '@/lib/indexeddb';

type SimpleResource = {
    id: string;
    title: string;
    type: string;
    size_kb: number;
    subtopic?: string;
    preview_text?: string;
    thumbnail_url?: string | null;
    subject?: string;
    grade?: number;
    difficulty?: number;
};

type ResourceSection = {
    subtopicLabel: string;
    resources: SimpleResource[];
};

function humanizeSubtopic(st: string): string {
    return (st || '').replace(/_/g, ' ').trim();
}

/** Map grade_band to skill_level 1–3 for allocate API. */
function gradeBandToSkillLevel(gradeBand: number): number {
    if (gradeBand <= 1) return 1;
    if (gradeBand <= 3) return 2;
    return 3;
}

function ResourcesContent() {
    const params = useParams<{ subject: string }>();
    const search = useSearchParams();
    const router = useRouter();

    const subject = (params?.subject ?? '').toLowerCase();
    const gradeFromUrl = search.get('grade_band');
    const [gradeBand, setGradeBand] = useState(() => parseInt(gradeFromUrl || '2', 10) || 2);
    const weakParam = search.get('weak') || '';
    const weakSubtopics = Array.from(
        new Set(
            weakParam
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
        ),
    );
    // skill_level from URL takes priority; fall back to grade-band-derived level
    const urlSkillLevel = parseInt(search.get('skill_level') || '0', 10);


    const [sections, setSections] = useState<ResourceSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lowDataMode = typeof window !== 'undefined' && localStorage.getItem('kmap_low_data') === 'true';

    // Sync grade from profile when URL has no grade_band so dropdown drives content everywhere
    useEffect(() => {
        if (gradeFromUrl != null && gradeFromUrl !== '') return;
        getLocalProfile().then(p => {
            const gb = p?.gradeBand ?? 2;
            setGradeBand(gb);
            const url = new URL(window.location.href);
            url.searchParams.set('grade_band', String(gb));
            router.replace(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
        }).catch(() => {});
    }, [gradeFromUrl, router]);

    useEffect(() => {
        let cancelled = false;

        const fetchResources = async () => {
            setLoading(true);
            setError(null);
            try {
                const skillLevel = (urlSkillLevel >= 1 && urlSkillLevel <= 3)
                    ? urlSkillLevel
                    : gradeBandToSkillLevel(gradeBand);

                const lowDataMode = typeof window !== 'undefined' && localStorage.getItem('kmap_low_data') === 'true';

                let subtopicIds: string[] = weakSubtopics;
                if (subtopicIds.length === 0) {
                    const topicsRes = await fetch(`/api/topics?subject=${encodeURIComponent(subject)}&grade_band=${gradeBand}`);
                    if (topicsRes.status === 503) {
                        setError('Topics service unavailable.');
                        setSections([]);
                        return;
                    }
                    const topicsData = await topicsRes.json();
                    const topics = (topicsData.topics ?? []) as { topic: string; label: string }[];
                    subtopicIds = topics.slice(0, 8).map(t => t.topic);
                }

                if (subtopicIds.length === 0) {
                    setSections([]);
                    return;
                }

                const requests = subtopicIds.map(subtopic_id => ({
                    subject_id: subject,
                    subtopic_id,
                    skill_level: skillLevel,
                }));

                const allocRes = await fetch('/api/resources/allocate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requests, low_data_mode: lowDataMode }),
                });

                if (!allocRes.ok) {
                    setError(allocRes.status === 503 ? 'Resources service unavailable.' : 'Could not load recommended resources.');
                    setSections([]);
                    return;
                }

                const allocData = (await allocRes.json()) as { resources?: Array<{ id: string; title: string }> };
                const allocated = allocData.resources ?? [];
                if (cancelled) return;
                if (allocated.length === 0) {
                    setSections([]);
                    return;
                }

                const ids = allocated.map(r => r.id).join(',');
                const metaRes = await fetch(`/api/resources?ids=${encodeURIComponent(ids)}&low_data=${lowDataMode}`);
                if (metaRes.status === 503) {
                    setError('Resources service unavailable.');
                    setSections([]);
                    return;
                }
                const metaJson = await metaRes.json();
                if (cancelled) return;

                const list: SimpleResource[] = Array.isArray(metaJson) && metaJson.length > 0
                    ? metaJson.map((r: { id: string; title: string; type?: string; size_kb?: number; subtopic?: string; preview_text?: string; thumbnail_url?: string | null; subject?: string; grade?: number; difficulty?: number }) => ({
                        id: r.id,
                        title: r.title,
                        type: r.type ?? 'pdf',
                        size_kb: r.size_kb ?? 0,
                        subtopic: r.subtopic,
                        preview_text: r.preview_text,
                        thumbnail_url: r.thumbnail_url,
                        subject: r.subject,
                        grade: r.grade,
                        difficulty: r.difficulty,
                    }))
                    : allocated.map(r => ({ id: r.id, title: r.title, type: 'pdf', size_kb: 0, subtopic: undefined as string | undefined }));

                const bySubtopic = new Map<string, SimpleResource[]>();
                for (const r of list) {
                    const key = r.subtopic ?? 'general';
                    if (!bySubtopic.has(key)) bySubtopic.set(key, []);
                    bySubtopic.get(key)!.push(r);
                }
                const collected: ResourceSection[] = Array.from(bySubtopic.entries()).map(([st, resources]) => ({
                    subtopicLabel: humanizeSubtopic(st === 'general' ? 'Recommended' : st),
                    resources,
                }));

                setSections(collected);
                trackMetadataFetch(list.length);
            } catch (e: unknown) {
                if (cancelled) return;
                const err = e as { message?: string };
                setError(err?.message || 'Unable to load resources.');
                setSections([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchResources();

        return () => {
            cancelled = true;
        };
    }, [subject, gradeBand, weakSubtopics.join(',')]);

    const prettySubject = formatSubjectId(subject);

    return (
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
                        {sections.flatMap((section) =>
                            section.resources.map((r) => (
                                <div key={r.id} className="flex flex-col gap-1">
                                    {section.subtopicLabel && section.subtopicLabel !== 'Recommended' && (
                                        <span className="text-[10px] font-brand uppercase tracking-wide text-muted-foreground">
                                            {section.subtopicLabel}
                                        </span>
                                    )}
                                    <ResourceCard
                                        resource={{
                                            id: r.id,
                                            title: r.title,
                                            type: r.type,
                                            size_kb: r.size_kb,
                                            subtopic: r.subtopic,
                                            preview_text: r.preview_text,
                                            thumbnail_url: r.thumbnail_url,
                                            subject: r.subject,
                                            grade: r.grade,
                                            difficulty: r.difficulty,
                                        }}
                                        lowDataMode={lowDataMode}
                                    />
                                </div>
                            )),
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}

export default function ResourcesPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <Suspense fallback={
                <main className="container mx-auto max-w-4xl px-4 py-8">
                    <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                        <BookOpen className="h-6 w-6 animate-pulse text-primary" />
                        Loading resources…
                    </div>
                </main>
            }>
                <ResourcesContent />
            </Suspense>
        </div>
    );
}

