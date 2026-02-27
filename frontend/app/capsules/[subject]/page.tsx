'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { getLocalProfile } from '@/lib/indexeddb';
import { ArrowLeft, CheckCircle2, XCircle, BarChart3, BookOpen, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EngineQuestion } from '@/components/QuizSession';
import { formatSubjectId } from '@/lib/subjects';
import WhyBox from '@/components/quiz/WhyBox';
import { getCapsuleDone, setCapsuleDone } from '@/lib/capsule';
import { useSkillContext } from '@/contexts/SkillContext';

const SEEN_KEY = 'kmap_seen_questions';

function getSeen(): Record<string, string[]> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, string[]>;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
}

function setSeen(seen: Record<string, string[]>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
        // ignore
    }
}

function isSeen(seen: Record<string, string[]>, q: EngineQuestion): boolean {
    const id = q.id;
    const form = String(q.form ?? '');
    return Boolean(id && form && Array.isArray(seen[id]) && seen[id].includes(form));
}

function markSeen(seen: Record<string, string[]>, q: EngineQuestion) {
    const id = q.id;
    const form = String(q.form ?? '');
    if (!id || !form) return;
    const existing = seen[id] ?? [];
    if (!existing.includes(form)) seen[id] = [...existing, form];
}

interface QuizItem {
    topic: string;
    label: string;
    question: EngineQuestion | null;
    result: 'correct' | 'incorrect' | null;
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
    const { touchSubjectAttendance } = useSkillContext();
    const router = useRouter();

    const [gradeBand, setGradeBand] = useState(2);
    const [items, setItems] = useState<QuizItem[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [phase, setPhase] = useState<'loading' | 'quiz' | 'results'>('loading');
    const [initialized, setInitialized] = useState(false);

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

            // Fetch all questions first; stay on full-screen loading until done
            const level = gradeBandToLevel(gb);
            const seen = getSeen();
            const fetched = await Promise.all(
                topics.map(t =>
                    fetch(`/api/questions?topic=${t.topic}&subject=${subject}&grade_band=${gb}&level=${level}&count=1`)
                        .then(r => r.json())
                        .then(d => {
                            const qs = (d.questions ?? []) as EngineQuestion[];
                            if (!Array.isArray(qs) || qs.length === 0) return null;
                            const pick = qs.find(q => !isSeen(seen, q)) ?? qs[0];
                            return (pick ?? null) as EngineQuestion | null;
                        })
                        .catch(() => null)
                )
            );

            // Persist seen-set after we decide picks (single write avoids races)
            for (const q of fetched) {
                if (q) markSeen(seen, q);
            }
            setSeen(seen);

            const newItems = topics.map((t, i) => ({
                topic: t.topic,
                label: t.label,
                question: fetched[i],
                result: null,
            }));
            setItems(newItems);
            const firstValidIdx = newItems.findIndex(it => it.question != null);
            setCurrentIdx(firstValidIdx >= 0 ? firstValidIdx : 0);
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
            const done = getCapsuleDone(subject, gb);
            if (done) {
                router.replace('/dashboard');
                return;
            }
            runSession(gb).finally(() => setInitialized(true));
        });
    }, [ready, runSession, subject, router]);

    // ── Answer handler — record result only; advance via Next/Submit ─────────────
    const handleAnswer = useCallback((choice: string) => {
        if (selected !== null) return;
        const item = items[currentIdx];
        if (!item?.question) return;

        setSelected(choice);
        const isCorrect = choice === item.question.answer;

        setItems(prev => prev.map((it, i) =>
            i === currentIdx ? { ...it, result: isCorrect ? 'correct' : 'incorrect' } : it
        ));
    }, [selected, items, currentIdx]);

    // ── Next / Submit — advance after user has read feedback (and Why box) ──────
    const handleNextOrSubmit = useCallback(() => {
        if (selected === null) return;
        const next = currentIdx + 1;
        if (next >= items.length) {
            setPhase('results');
        } else {
            setCurrentIdx(next);
            setSelected(null);
        }
    }, [selected, currentIdx, items.length]);

    // ── Persist completed state when entering results ─────────────────────────
    useEffect(() => {
        if (phase !== 'results' || items.length === 0) return;
        const correctCount = items.filter(i => i.result === 'correct').length;
        setCapsuleDone(subject, gradeBand, correctCount, items.length);
        touchSubjectAttendance(subject);
    }, [phase, items, subject, gradeBand, touchSubjectAttendance]);

    // ── Retry — reset results and replay same questions ───────────────────────
    const handleRetry = useCallback(() => {
        setItems(prev => prev.map(it => ({ ...it, result: null })));
        setCurrentIdx(0);
        setSelected(null);
        setPhase('quiz');
    }, []);

    // ── View Resources — navigate to dedicated resources page ───────────────
    const handleViewResources = useCallback(() => {
        const weak = items
            .filter(it => it.result === 'incorrect')
            .map(it => it.topic);
        const params = new URLSearchParams({ grade_band: String(gradeBand) });
        if (weak.length > 0) params.set('weak', weak.join(','));
        router.push(`/resources/${subject}?${params.toString()}`);
    }, [items, gradeBand, router, subject]);

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
    const totalItems = items.length;
    const correctCount = items.filter(i => i.result === 'correct').length;
    const overallPct = totalItems > 0
        ? Math.round((correctCount / totalItems) * 100)
        : 0;

    const prettySubject = formatSubjectId(subject);

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
                        <h1 className="font-brand text-xl font-bold text-foreground">{prettySubject}</h1>
                        {phase === 'quiz' && (
                            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-brand text-muted-foreground">
                                {currentIdx + 1} / {items.length}
                            </span>
                        )}
                    </div>

                    {/* ── Loading: full-screen style until questions are ready ─────────── */}
                    {(phase === 'loading' || (phase === 'quiz' && (!currentItem || !currentItem.question))) && (
                        <div className="space-y-3 mt-6">
                            <p className="text-sm text-muted-foreground font-brand">Preparing…</p>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-14 animate-pulse rounded-lg border border-border bg-secondary/30" />
                            ))}
                        </div>
                    )}

                    {phase === 'quiz' && currentItem && currentItem.question && (
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

                            {/* Question box: empty/retry state or full question + options */}
                            {!currentItem.question.question?.trim() || !Array.isArray(currentItem.question.choices) || currentItem.question.choices.length === 0 ? (
                                <div className="min-w-[280px] flex-1 rounded-xl border-2 border-border bg-card p-5 shadow-md space-y-5">
                                    <p className="text-sm text-muted-foreground font-brand">No question available for this topic.</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="font-brand"
                                            onClick={() => {
                                                setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, question: null } : it));
                                                const gb = gradeBand;
                                                fetch(`/api/questions?topic=${currentItem.topic}&subject=${subject}&grade_band=${gb}&level=${gradeBandToLevel(gb)}&count=1`)
                                                    .then(r => r.json())
                                                    .then(d => {
                                                        const qs = (d.questions ?? []) as EngineQuestion[];
                                                        const pick = qs?.[0] ?? null;
                                                        setItems(prev => prev.map((it, i) => i === currentIdx ? { ...it, question: pick } : it));
                                                    })
                                                    .catch(() => {});
                                            }}
                                        >
                                            Try again
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="font-brand"
                                            onClick={() => {
                                                if (currentIdx >= items.length - 1) setPhase('results');
                                                else setCurrentIdx(i => i + 1);
                                            }}
                                        >
                                            Skip
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-row gap-4 items-stretch">
                                    {/* Left: question card (question + options + Next/Submit) */}
                                    <div className="min-w-[280px] flex-1 rounded-xl border-2 border-border bg-card p-5 shadow-md space-y-5">
                                        <p className="text-base font-medium leading-relaxed text-foreground">
                                            {currentItem.question.question}
                                        </p>

                                        <div className="grid grid-cols-1 gap-2">
                                            {currentItem.question.choices.map((choice, idx) => {
                                                const isSelected = selected === choice;
                                                const correctAnswer = currentItem.question!.answer;
                                                const isCorrectOpt = choice === correctAnswer;
                                                const showFeedback = selected !== null;

                                                return (
                                                    <button
                                                        key={idx}
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
                                        {selected !== null && (
                                            <Button
                                                className="w-full font-brand mt-2"
                                                onClick={handleNextOrSubmit}
                                            >
                                                {currentIdx >= items.length - 1 ? 'Submit' : 'Next'}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Right: Why box (only when wrong answer) */}
                                    {selected !== null && selected !== currentItem.question!.answer && currentItem.question!.explanations && (
                                        <div className="w-52 sm:w-64 shrink-0 flex flex-col">
                                            <WhyBox
                                                explanation={currentItem.question!.explanations[String(currentItem.question!.choices.indexOf(selected))] ?? `The right answer is: ${currentItem.question!.answer}.`}
                                            />
                                        </div>
                                    )}
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
                                    {correctCount} of {totalItems} correct
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
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Right
                                                </span>
                                            )}
                                            {item.result === 'incorrect' && (
                                                <span className="flex items-center gap-1 text-xs font-brand text-red-600 dark:text-red-400">
                                                    <XCircle className="h-3.5 w-3.5" /> Wrong
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
                                <Button variant="outline" onClick={handleViewResources} className="font-brand gap-1.5">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    View Resources
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
