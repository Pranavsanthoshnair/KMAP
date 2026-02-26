'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getLocalProfile, getAllCachedCapsules } from '@/lib/indexeddb';
import { BookOpen, FlaskConical, Languages, ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubjectId = 'math' | 'science' | 'english';

const SUBJECTS: {
    id: SubjectId;
    label: string;
    tag: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
    {
        id: 'math',
        label: 'Mathematics',
        tag: 'STEM',
        icon: BookOpen,
    },
    {
        id: 'science',
        label: 'Science',
        tag: 'SCIENCE',
        icon: FlaskConical,
    },
    {
        id: 'english',
        label: 'English',
        tag: 'LANGUAGE',
        icon: Languages,
    },
];

const GRADE_BAND_LABELS: Record<number, string> = {
    1: 'Classes 1–4',
    2: 'Classes 5–8',
    3: 'Classes 9–10',
    4: 'Classes 11–12',
    5: 'College',
};

export default function Dashboard() {
    const { ready } = useAuth();
    const router = useRouter();
    const [name, setName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);
    const [initialized, setInitialized] = useState(false);
    const [subjects, setSubjects] = useState<SubjectId[]>([]);
    const [cacheCounts, setCacheCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!ready) return;
        (async () => {
            const profile = await getLocalProfile();
            if (profile) {
                setName(profile.name);
                setGradeBand(profile.gradeBand ?? 2);
                const validSubjects =
                    profile.subjects?.filter((s): s is SubjectId =>
                        ['math', 'science', 'english'].includes(s),
                    ) || [];
                setSubjects(validSubjects.length ? validSubjects : SUBJECTS.map((s) => s.id));
            } else {
                setSubjects(SUBJECTS.map((s) => s.id));
            }

            const capsules = await getAllCachedCapsules();
            const bySubject: Record<string, number> = {};
            for (const c of capsules) {
                bySubject[c.subject] = (bySubject[c.subject] || 0) + 1;
            }
            setCacheCounts(bySubject);
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
                                {GRADE_BAND_LABELS[gradeBand]} · Tap a subject to open your capsule session.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-brand text-xs">
                                Grade Band {gradeBand}
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
                            {SUBJECTS.filter((s) => subjects.includes(s.id)).map(
                                ({ id, label, tag, icon: Icon }) => {
                                    const cacheCount = cacheCounts[id] ?? 0;
                                    const approxKb = cacheCount * 4; // rough estimate
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
                                                            <h3 className="mt-1 font-brand text-base font-semibold text-foreground">
                                                                {label}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    <Badge className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-brand text-primary">
                                                        <Trophy className="h-3 w-3" />
                                                        Level {gradeBand}
                                                    </Badge>
                                                </div>

                                                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                                    <div className="flex flex-col">
                                                        <span className="font-brand text-[11px] uppercase tracking-wide">
                                                            Cache
                                                        </span>
                                                        <span className="font-medium text-foreground">
                                                            {approxKb} KB
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(`/capsules/${id}`)}
                                                        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                                                    >
                                                        Open Lesson
                                                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                },
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
