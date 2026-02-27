'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FlaskConical, Languages, ChevronRight, Trophy, CheckCircle2, RefreshCw, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchSubjects, FALLBACK_SUBJECTS, type SubjectId } from '@/lib/subjects';
import { getLocalProfile, getAllCachedCapsules, getEarnedBadges } from '@/lib/indexeddb';
import { getGradeLabel } from '@/lib/grades';
import { ALL_BADGES } from '@/lib/badges';
import { getCapsuleDone, clearCapsuleDone } from '@/lib/capsule';

const SUBJECT_ICONS: Record<string, { tag: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = {
    math: { tag: 'STEM', icon: BookOpen },
    science: { tag: 'SCIENCE', icon: FlaskConical },
    english: { tag: 'LANGUAGE', icon: Languages },
};

export default function Dashboard() {
    const { ready } = useAuth();
    const router = useRouter();
    const [name, setName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);
    const [initialized, setInitialized] = useState(false);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [subjectOptions, setSubjectOptions] = useState<{ id: string; label: string }[]>([]);
    const [cacheCounts, setCacheCounts] = useState<Record<string, number>>({});
    const [earnedBadgeCount, setEarnedBadgeCount] = useState(0);

    useEffect(() => {
        if (!ready) return;
        (async () => {
            const list = await fetchSubjects();
            setSubjectOptions(list);

            const profile = await getLocalProfile();
            if (profile?.name) setName(profile.name);
            if (typeof profile?.gradeBand === 'number') setGradeBand(profile.gradeBand);
            const validIds = list.map(s => s.id);
            if (profile?.subjects?.length) {
                const valid = profile.subjects.filter((s): s is string => validIds.includes(s));
                setSubjects(valid.length ? valid : validIds);
            } else {
                setSubjects(validIds);
            }

            const capsules = await getAllCachedCapsules();
            const bySubject: Record<string, number> = {};
            for (const c of capsules) {
                bySubject[c.subject] = (bySubject[c.subject] || 0) + 1;
            }
            setCacheCounts(bySubject);

            const earnedBadges = await getEarnedBadges();
            setEarnedBadgeCount(earnedBadges.length);

            setInitialized(true);
        })();
    }, [ready]);

    if (!ready || !initialized) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-6xl px-4 py-8">
                <div className="animate-fade-in space-y-8">
                    {/* Header */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Welcome back
                            </p>
                            <h1 className="font-brand text-3xl font-bold text-foreground sm:text-4xl">
                                {name || 'Learner'}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {getGradeLabel(gradeBand)} · Tap a subject to open your capsule session.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-brand text-xs">
                                {getGradeLabel(gradeBand)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                Progress adapts automatically as you answer.
                            </span>
                        </div>
                    </div>

                    {/* Subject cards grid */}
                    <section>
                        <h2 className="font-brand text-lg font-semibold text-foreground mb-4">
                            Your Subjects
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {subjectOptions.filter((s) => subjects.includes(s.id)).map(({ id, label }) => {
                                const meta = SUBJECT_ICONS[id] ?? { tag: id.toUpperCase(), icon: BookOpen };
                                const Icon = meta.icon;
                                const tag = meta.tag;
                                const cacheCount = cacheCounts[id] ?? 0;
                                const approxKb = cacheCount * 4; // rough estimate
                                const capsuleDone = getCapsuleDone(id, gradeBand);
                                const handleReattempt = () => {
                                    clearCapsuleDone(id, gradeBand);
                                    router.push(`/capsules/${id}`);
                                };

                                return (
                                    <Card
                                        key={id}
                                        className="group flex h-full flex-col overflow-hidden border border-border bg-card/80 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                                    >
                                        <div className="relative h-24 bg-gradient-to-r from-primary/10 via-secondary/20 to-background" />
                                        <div className="-mt-8 flex flex-1 flex-col justify-between px-5 pb-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm">
                                                        <Icon className="h-5 w-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-brand uppercase tracking-wide text-muted-foreground">
                                                            {tag}
                                                        </span>
                                                        <div className="mt-1 flex items-center gap-2">
                                                            <h3 className="font-brand text-base font-semibold text-foreground">
                                                                {label}
                                                            </h3>
                                                            {capsuleDone && (
                                                                <span
                                                                    className="flex items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-brand text-green-600 dark:text-green-400"
                                                                    title="Completed"
                                                                >
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Badge className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-brand text-primary">
                                                    <Trophy className="h-3 w-3" />
                                                    {getGradeLabel(gradeBand)}
                                                </Badge>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                <div className="flex flex-col">
                                                    <span className="font-brand text-[11px] uppercase tracking-wide">
                                                        Cache
                                                    </span>
                                                    <span className="font-medium text-foreground">
                                                        {approxKb} KB
                                                    </span>
                                                </div>

                                                {capsuleDone ? (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={handleReattempt}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-brand text-foreground transition hover:bg-secondary"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" /> Reattempt
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => router.push(`/resources/${id}?grade_band=${gradeBand}`)}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-brand text-foreground transition hover:bg-secondary"
                                                        >
                                                            View Resources
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/capsules/${id}`)}
                                                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                                                    >
                                                        Open Lesson
                                                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── Badges ───────────────────────────────────────────────────── */}
                    <section>
                        <h2 className="font-brand text-lg font-semibold text-foreground mb-4">
                            Achievements
                        </h2>
                        <button
                            type="button"
                            onClick={() => router.push('/badges')}
                            className="group w-full flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md text-left"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                <Award className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="font-brand text-base font-semibold text-foreground">Badges &amp; Milestones</p>
                                <p className="text-sm text-muted-foreground">
                                    {earnedBadgeCount} / {ALL_BADGES.length} badges earned
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {earnedBadgeCount > 0 && (
                                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold font-brand text-primary-foreground">
                                        {earnedBadgeCount}
                                    </span>
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                        </button>
                    </section>

                </div>
            </main>
        </div>
    );
}
