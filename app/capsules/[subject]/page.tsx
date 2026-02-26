'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import QuestionCard, { type EngineQuestion } from '@/components/QuestionCard';
import { getLocalProfile } from '@/lib/indexeddb';
import { ArrowLeft, RefreshCw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Topic {
    topic: string;
    label: string;
}

/** Map a user's grade_band to a question difficulty level (1–3) */
function gradeBandToLevel(gb: number): number {
    if (gb <= 1) return 1;
    if (gb <= 3) return 2;
    return 3;
}

export default function CapsuleView() {
    const params = useParams<{ subject: string }>();
    const subject = params?.subject ?? '';
    const { user, loading } = useAuth();
    const router = useRouter();

    const [gradeBand, setGradeBand] = useState(2);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState('');
    const [questions, setQuestions] = useState<EngineQuestion[]>([]);
    const [fetching, setFetching] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState('');

    // ── 1. Redirect if unauthenticated, then load grade + topics ──────────────
    useEffect(() => {
        if (!loading && !user) { router.push('/login'); return; }
        if (!user) return;

        getLocalProfile().then(p => {
            const gb = p?.gradeBand ?? 2;
            setGradeBand(gb);

            fetch(`/api/topics?subject=${subject}&grade_band=${gb}`)
                .then(r => r.json())
                .then(data => {
                    const t: Topic[] = data.topics ?? [];
                    setTopics(t);
                    if (t.length > 0) setSelectedTopic(t[0].topic);
                })
                .catch(() => setError('Could not load topics.'))
                .finally(() => setInitialized(true));
        });
    }, [user, loading, router, subject]);

    // ── 2. Load questions whenever topic or grade changes ─────────────────────
    const loadQuestions = useCallback(async (topic: string, gb: number, reset = false) => {
        if (!topic) return;
        setFetching(true);
        setQuestions([]);
        setError('');
        setExhausted(false);

        try {
            const level = gradeBandToLevel(gb);
            const res = await fetch(
                `/api/questions?topic=${topic}&grade_band=${gb}&level=${level}&count=6${reset ? '&reset=true' : ''}`
            );
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            const data = await res.json();
            setQuestions(data.questions ?? []);
            setExhausted(data.exhausted ?? false);
        } catch {
            setError('Failed to generate questions. Make sure Python is available.');
        } finally {
            setFetching(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTopic) loadQuestions(selectedTopic, gradeBand);
    }, [selectedTopic, gradeBand, loadQuestions]);

    // ── Loading skeleton ───────────────────────────────────────────────────────
    if (loading || !initialized) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </main>
            </div>
        );
    }

    const topicLabel = topics.find(t => t.topic === selectedTopic)?.label ?? selectedTopic;

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />

            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="animate-fade-in">

                    {/* Back button */}
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="mb-6">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>

                    {/* Page header */}
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="font-brand text-xl font-bold capitalize text-foreground">
                                {subject}
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Grade Band {gradeBand} · Level {gradeBandToLevel(gradeBand)} questions
                            </p>
                        </div>
                        {/* Refresh button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadQuestions(selectedTopic, gradeBand, true)}
                            disabled={fetching}
                            className="font-brand"
                        >
                            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', fetching && 'animate-spin')} />
                            {fetching ? 'Loading…' : 'New Set'}
                        </Button>
                    </div>

                    {/* Topic pills */}
                    {topics.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {topics.map(t => (
                                <button
                                    key={t.topic}
                                    onClick={() => setSelectedTopic(t.topic)}
                                    className={cn(
                                        'rounded-full border px-4 py-1.5 font-brand text-xs transition-colors',
                                        selectedTopic === t.topic
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Divider + topic label */}
                    {selectedTopic && (
                        <div className="mt-6 flex items-center gap-3">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="font-brand text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                {topicLabel}
                            </span>
                            <div className="flex-1 border-t border-border" />
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Loading placeholder cards */}
                    {fetching && (
                        <div className="mt-4 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-secondary/30" />
                            ))}
                        </div>
                    )}

                    {/* Question cards */}
                    {!fetching && questions.length > 0 && (
                        <div className="mt-4 space-y-4">
                            {questions.map((q, i) => (
                                <QuestionCard key={`${q.id}-${q.form}`} question={q} index={i} topic={selectedTopic} />
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!fetching && questions.length === 0 && !error && (
                        <div className="mt-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                No questions available for this topic yet.
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Add facts to <code className="rounded bg-secondary px-1">question_engine/facts.json</code> to generate more.
                            </p>
                        </div>
                    )}

                    {/* Exhaustion notice */}
                    {exhausted && questions.length > 0 && (
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            You've seen all forms for this topic. Click <strong>New Set</strong> to start again.
                        </p>
                    )}

                </div>
            </main>
        </div>
    );
}
