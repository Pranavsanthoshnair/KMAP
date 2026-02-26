'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { getLocalProfile } from '@/lib/indexeddb';
import { trackMetadataFetch } from '@/lib/data-tracker';
import { ArrowLeft, CheckCircle2, XCircle, BarChart3, RefreshCw, BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EngineQuestion } from '@/components/QuizSession';

interface QuizItem {
    topic: string;
    label: string;
    question: EngineQuestion | null;
    result: 'correct' | 'incorrect' | null;
}

interface Resource {
    id: string;
    title: string;
    type: string;
    size_kb: number;
    preview_text: string;
    thumbnail_url: string | null;
    subject: string;
    grade: number;
    subtopic: string;
    difficulty: string;
}

function gradeBandToLevel(gb: number) {
    if (gb <= 1) return 1;
    if (gb <= 3) return 2;
    return 3;
}

export default function CapsuleView() {
    const params = useParams<{ subject: string }>();
    const subject = params?.subject ?? '';
    const { ready } = useAuth();
    const router = useRouter();

    const [gradeBand, setGradeBand] = useState(2);
    const [items, setItems] = useState<QuizItem[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [phase, setPhase] = useState<'loading' | 'quiz' | 'results'>('loading');
    const [initialized, setInitialized] = useState(false);
    const [resources, setResources] = useState<Resource[]>([]);
    const [resLoading, setResLoading] = useState(false);
    const [showResources, setShowResources] = useState(false);

    // ── Load all topics then pre-fetch 1 question per topic ───────────────────
    const runSession = useCallback(async (gb: number) => {
        setPhase('loading');
        setCurrentIdx(0);
        setSelected(null);

        try {
            const topicsRes = await fetch(`/api/topics?subject=${subject}&grade_band=${gb}`);
            const topicsData = await topicsRes.json();
            const topics: { topic: string; label: string }[] = topicsData.topics ?? [];

            if (topics.length === 0) {
                setItems([]);
                setPhase('results');
                return;
            }

            // Placeholder items while questions load
            setItems(topics.map(t => ({ topic: t.topic, label: t.label, question: null, result: null })));

            // Fetch 1 question per topic in parallel
            const level = gradeBandToLevel(gb);
            const fetched = await Promise.all(
                topics.map(t =>
                    fetch(`/api/questions?topic=${t.topic}&subject=${subject}&grade_band=${gb}&level=${level}&count=1`)
                        .then(r => r.json())
                        .then(d => (d.questions?.[0] ?? null) as EngineQuestion | null)
                        .catch(() => null)
                )
            );

            setItems(topics.map((t, i) => ({
                topic: t.topic,
                label: t.label,
                question: fetched[i],
                result: null,
            })));
            setPhase('quiz');
        } catch {
            setPhase('results');
        }
    }, [subject]);

    useEffect(() => {
        if (!ready) return;
        getLocalProfile().then(p => {
            const gb = p?.gradeBand ?? 2;
            setGradeBand(gb);
            runSession(gb).finally(() => setInitialized(true));
        });
    }, [ready, runSession]);

    // ── Answer handler — record result then auto-advance ──────────────────────
    const handleAnswer = useCallback((choice: string) => {
        if (selected !== null) return;
        const item = items[currentIdx];
        if (!item?.question) return;

        setSelected(choice);
        const isCorrect = choice === item.question.answer;

        setItems(prev => prev.map((it, i) =>
            i === currentIdx ? { ...it, result: isCorrect ? 'correct' : 'incorrect' } : it
        ));

        // Auto-advance after feedback delay
        setTimeout(() => {
            const next = currentIdx + 1;
            if (next >= items.length) {
                setPhase('results');
            } else {
                setCurrentIdx(next);
                setSelected(null);
            }
        }, 1300);
    }, [selected, items, currentIdx]);

    // ── Retry — reset results and replay same questions ───────────────────────
    const handleRetry = useCallback(() => {
        setItems(prev => prev.map(it => ({ ...it, result: null })));
        setCurrentIdx(0);
        setSelected(null);
        setShowResources(false);
        setResources([]);
        setPhase('quiz');
    }, []);

    // ── View Resources — fetch from Supabase ────────────────────────────────
    const handleViewResources = useCallback(async () => {
        if (resources.length > 0) { setShowResources(s => !s); return; }
        setResLoading(true);
        try {
            const res = await fetch(
                `/api/resources/browse?subject=${subject}&grade_band=${gradeBand}`
            );
            const data = await res.json();
            setResources(data.resources ?? []);
            trackMetadataFetch(Array.isArray(data.resources) ? data.resources.length : 0);
            setShowResources(true);
        } catch {
            setResources([]);
            setShowResources(true);
        } finally {
            setResLoading(false);
        }
    }, [subject, gradeBand, resources.length]);

    // ── Loading ───────────────────────────────────────────────────────────────
    if (!ready || !initialized) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground animate-pulse">Preparing questions…</p>
                </main>
            </div>
        );
    }

    const currentItem = items[currentIdx];
    const answeredItems = items.filter(i => i.result !== null);
    const correctCount = answeredItems.filter(i => i.result === 'correct').length;
    const overallPct = answeredItems.length > 0
        ? Math.round((correctCount / answeredItems.length) * 100)
        : 0;

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-xl px-4 py-10">
                <div className="animate-fade-in">

                    {/* Back */}
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="mb-6">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>

                    {/* Subject title + progress counter */}
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="font-brand text-xl font-bold capitalize text-foreground">{subject}</h1>
                        {phase === 'quiz' && (
                            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-brand text-muted-foreground">
                                {currentIdx + 1} / {items.length}
                            </span>
                        )}
                    </div>

                    {/* ── Quiz Phase ────────────────────────────────────────────────────── */}
                    {phase === 'loading' && (
                        <div className="space-y-3 mt-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-secondary/30" />
                            ))}
                        </div>
                    )}

                    {phase === 'quiz' && currentItem && (
                        <div className="space-y-5">
                            {/* Progress bar */}
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${(currentIdx / items.length) * 100}%` }}
                                />
                            </div>

                            {/* Subtopic pill */}
                            <div>
                                <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-brand text-primary">
                                    {currentItem.label}
                                </span>
                            </div>

                            {/* Question card */}
                            {!currentItem.question ? (
                                <div className="h-48 animate-pulse rounded-xl border border-border bg-secondary/20" />
                            ) : (
                                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
                                    <p className="text-base font-medium leading-relaxed text-foreground">
                                        {currentItem.question.question}
                                    </p>

                                    <div className="grid grid-cols-1 gap-2">
                                        {currentItem.question.choices.map(choice => {
                                            const isSelected = selected === choice;
                                            const correctAnswer = currentItem.question!.answer;
                                            const isCorrectOpt = choice === correctAnswer;
                                            const showFeedback = selected !== null;

                                            return (
                                                <button
                                                    key={choice}
                                                    disabled={selected !== null}
                                                    onClick={() => handleAnswer(choice)}
                                                    className={cn(
                                                        'w-full rounded-lg border px-4 py-3 text-left text-sm font-brand transition-all duration-200',
                                                        !showFeedback && 'border-border hover:border-primary/60 hover:bg-primary/5',
                                                        showFeedback && isCorrectOpt &&
                                                        'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400',
                                                        showFeedback && isSelected && !isCorrectOpt &&
                                                        'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400',
                                                        showFeedback && !isSelected && !isCorrectOpt &&
                                                        'border-border opacity-40',
                                                    )}
                                                >
                                                    {choice}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Results Phase ──────────────────────────────────────────────────── */}
                    {phase === 'results' && (
                        <div className="space-y-5">

                            {/* Overall score card */}
                            <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                                <BarChart3 className="mx-auto mb-3 h-8 w-8 text-primary" />
                                <p className="font-brand text-4xl font-bold text-foreground">{overallPct}%</p>
                                <p className="mt-1 text-sm text-muted-foreground font-brand">
                                    {correctCount} of {answeredItems.length} correct
                                </p>
                            </div>

                            {/* Per-subtopic breakdown */}
                            {items.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-brand uppercase tracking-wider text-muted-foreground">
                                        Subtopic Breakdown
                                    </p>
                                    {items.map(item => (
                                        <div
                                            key={item.topic}
                                            className={cn(
                                                'flex items-center justify-between rounded-lg border px-4 py-3',
                                                item.result === 'correct' && 'border-green-500/30 bg-green-500/5',
                                                item.result === 'incorrect' && 'border-red-500/30   bg-red-500/5',
                                                item.result === null && 'border-border       bg-secondary/20',
                                            )}
                                        >
                                            <span className="text-sm font-brand text-foreground">{item.label}</span>
                                            {item.result === 'correct' && (
                                                <span className="flex items-center gap-1 text-xs font-brand text-green-600 dark:text-green-400">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> 100%
                                                </span>
                                            )}
                                            {item.result === 'incorrect' && (
                                                <span className="flex items-center gap-1 text-xs font-brand text-red-600 dark:text-red-400">
                                                    <XCircle className="h-3.5 w-3.5" /> 0%
                                                </span>
                                            )}
                                            {item.result === null && (
                                                <span className="text-xs text-muted-foreground font-brand">Skipped</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-2">
                                <Button onClick={() => router.push('/dashboard')} className="flex-1 font-brand">
                                    Proceed to Dashboard
                                </Button>
                                <Button variant="outline" onClick={handleRetry} className="font-brand gap-1.5">
                                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleViewResources}
                                    disabled={resLoading}
                                    className="font-brand gap-1.5"
                                >
                                    <BookOpen className={cn('h-3.5 w-3.5', resLoading && 'animate-spin')} />
                                    {resLoading ? 'Loading…' : 'View Resources'}
                                </Button>
                            </div>

                            {/* Resources panel */}
                            {showResources && (
                                <div className="space-y-3 pt-3">
                                    <p className="text-xs font-brand uppercase tracking-wider text-muted-foreground">
                                        Study Resources
                                    </p>
                                    {resources.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            No resources available for this subject and grade yet.
                                        </p>
                                    ) : (
                                        resources.map(r => (
                                            <div
                                                key={r.id}
                                                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-secondary/30 transition-colors"
                                            >
                                                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium font-brand text-foreground truncate">
                                                        {r.title}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                                                        {r.preview_text || `${r.type} · ${r.difficulty}`}
                                                    </p>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-brand uppercase text-muted-foreground">
                                                            {r.type}
                                                        </span>
                                                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-brand uppercase text-muted-foreground">
                                                            {r.difficulty}
                                                        </span>
                                                        {r.subtopic && (
                                                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-brand text-primary">
                                                                {r.subtopic.replace(/_/g, ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
