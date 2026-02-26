'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Brain } from 'lucide-react';
import { updateSkill } from '@/lib/indexeddb';
import { saveMastery } from '@/lib/indexeddb';
import { trackQuestionsFetch } from '@/lib/data-tracker';
import { cn } from '@/lib/utils';
import ResourceCard, { ResourceMeta } from './ResourceCard';

export interface EngineQuestion {
    id: string;
    form: number;
    question: string;
    choices: string[];
    answer: string;
}

export interface QuizResult {
    subtopic: string;
    correct: boolean;
}

interface QuizSessionProps {
    questions: EngineQuestion[];
    topic: string;       // subtopic slug (e.g. "cell_structure")
    subject: string;
    gradeBand: number;
    /** Called when the user wants a brand-new set */
    onNewSet: () => void;
}

type Phase = 'quiz' | 'computing' | 'results';

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

const FORM_LABELS: Record<number, string> = {
    1: 'Direct', 2: 'Reverse', 3: 'True / False',
    4: 'Fill Blank', 5: 'Category', 6: 'Negative',
};


export default function QuizSession({
    questions,
    topic,
    subject,
    gradeBand,
    onNewSet,
}: QuizSessionProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answered, setAnswered] = useState<Map<number, string>>(new Map());
    const [phase, setPhase] = useState<Phase>('quiz');
    const [mastery, setMastery] = useState<Record<string, number>>({});
    const [classified, setClassified] = useState<Record<string, string>>({});
    const [resourceIds, setResourceIds] = useState<string[]>([]);
    const [resources, setResources] = useState<ResourceMeta[]>([]);
    const [computing, setComputing] = useState(false);
    const [lowDataMode] = useState(
        () => typeof window !== 'undefined' && localStorage.getItem('kmap_low_data') === 'true'
    );

    const current = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;
    const selectedChoice = answered.get(currentIndex) ?? null;
    const isSubmitted = selectedChoice !== null;

    // Track questions load
    trackQuestionsFetch(questions.length);

    const handleAnswer = useCallback(async (choice: string) => {
        if (answered.has(currentIndex)) return; // No reattempt

        const isCorrect = choice === current.answer;
        const next = new Map(answered);
        next.set(currentIndex, choice);
        setAnswered(next);

        // Update IndexedDB skill by topic
        try { await updateSkill(topic, isCorrect); } catch { }

        if (isLastQuestion) {
            // Build results list and submit
            const allResults: QuizResult[] = questions.map((q, i) => ({
                subtopic: topic,
                correct: (i === currentIndex ? isCorrect : next.get(i) === q.answer),
            }));
            submitQuiz(allResults);
        }
    }, [answered, currentIndex, current, isLastQuestion, questions, topic]);

    const submitQuiz = async (results: QuizResult[]) => {
        setPhase('computing');
        setComputing(true);

        try {
            const res = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    grade: gradeBand,
                    skill_level: Math.min(3, Math.ceil(gradeBand / 2)),
                    subtopic_results: results,
                    low_data_mode: lowDataMode,
                }),
            });

            const data = await res.json();
            const m: Record<string, number> = data.mastery ?? {};
            const c: Record<string, string> = data.classified ?? {};
            const ids: string[] = data.resource_ids ?? [];

            // Save mastery to IndexedDB (float 0–1, privacy-first)
            for (const [st, score] of Object.entries(m)) {
                await saveMastery(st, score);
            }

            setMastery(m);
            setClassified(c);
            setResourceIds(ids);

            // Fetch metadata for allocated resources (lazy loading phase 1)
            if (ids.length > 0) {
                const metaRes = await fetch(
                    `/api/resources?ids=${ids.join(',')}&low_data=${lowDataMode}`
                );
                const metaData: ResourceMeta[] = (await metaRes.json()) as ResourceMeta[];
                setResources(metaData);
            }

            setPhase('results');
        } catch {
            setPhase('results'); // show results even on error
        } finally {
            setComputing(false);
        }
    };

    const advance = () => {
        if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1);
    };

    // ── Computing phase ────────────────────────────────────────────────────────
    if (phase === 'computing') {
        return (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Brain className="h-10 w-10 animate-pulse text-primary" />
                <p className="font-brand text-sm text-muted-foreground">
                    Computing your mastery and finding resources…
                </p>
            </div>
        );
    }

    // ── Results phase ─────────────────────────────────────────────────────────
    if (phase === 'results') {
        const masteryEntries = Object.entries(mastery);
        const score = masteryEntries.length > 0
            ? Math.round((masteryEntries.reduce((s, [, v]) => s + v, 0) / masteryEntries.length) * 100)
            : 0;

        return (
            <div className="space-y-6">
                {/* Score summary */}
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <Brain className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                            <p className="font-brand font-semibold text-foreground">Quiz Complete</p>
                            <p className="text-xs text-muted-foreground">
                                {answered.size} questions answered
                            </p>
                        </div>
                        <span className={cn(
                            'font-brand text-2xl font-bold',
                            score >= 60 ? 'text-emerald-500' : score >= 30 ? 'text-amber-500' : 'text-red-500',
                        )}>
                            {score}%
                        </span>
                    </div>
                    <Progress value={score} className="mt-3 h-2" />
                </Card>

                {/* Per-subtopic mastery */}
                {masteryEntries.length > 0 && (
                    <div>
                        <h3 className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Mastery Breakdown
                        </h3>
                        <div className="space-y-2">
                            {masteryEntries.map(([st, score]) => {
                                const cls = classified[st] ?? 'medium';
                                return (
                                    <div key={st} className="flex items-center gap-3">
                                        <span className="font-brand text-xs capitalize text-foreground w-32 shrink-0">
                                            {st.replace(/_/g, ' ')}
                                        </span>
                                        <Progress value={score * 100} className="flex-1 h-1.5" />
                                        <Badge
                                            variant="outline"
                                            className={cn('text-xs font-brand shrink-0', {
                                                'border-red-500/40 text-red-500': cls === 'weak',
                                                'border-amber-500/40 text-amber-500': cls === 'medium',
                                                'border-emerald-500/40 text-emerald-500': cls === 'strong',
                                            })}
                                        >
                                            {cls}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Allocated resources */}
                {resources.length > 0 && (
                    <div>
                        <h3 className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Recommended Resources
                        </h3>
                        <div className="space-y-3">
                            {resources.map(r => (
                                <ResourceCard key={r.id} resource={r} lowDataMode={lowDataMode} />
                            ))}
                        </div>
                    </div>
                )}

                {/* New Set button */}
                <Button variant="outline" className="w-full font-brand" onClick={onNewSet}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> New Set
                </Button>
            </div>
        );
    }

    // ── Quiz phase ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
                <span className="font-brand text-xs text-muted-foreground shrink-0">
                    {currentIndex + 1} / {questions.length}
                </span>
                <Progress value={((currentIndex + 1) / questions.length) * 100} className="flex-1 h-1.5" />
            </div>

            {/* Question card — NO reattempt */}
            <Card className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-5 py-3">
                    <span className="font-brand text-xs text-muted-foreground">Q{currentIndex + 1}</span>
                    <Badge variant="outline" className="font-brand text-xs">
                        {FORM_LABELS[current.form] ?? `Form ${current.form}`}
                    </Badge>
                </div>

                <div className="space-y-4 p-5">
                    <p className="font-brand text-sm font-medium leading-relaxed text-foreground">
                        {current.question}
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                        {current.choices.map((choice, i) => {
                            const isThis = selectedChoice === choice;
                            const isAnswer = choice === current.answer;
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(choice)}
                                    disabled={isSubmitted}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm font-brand transition-all',
                                        !isSubmitted && 'cursor-pointer border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/30',
                                        isSubmitted && isAnswer && 'border-primary bg-accent text-accent-foreground',
                                        isSubmitted && isThis && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                                        isSubmitted && !isThis && !isAnswer && 'border-border bg-muted/20 text-muted-foreground opacity-60',
                                    )}
                                >
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                                        {CHOICE_LETTERS[i]}
                                    </span>
                                    <span className="flex-1">{choice}</span>
                                    {isSubmitted && isAnswer && <CheckCircle className="ml-auto h-4 w-4 shrink-0" />}
                                    {isSubmitted && isThis && !isAnswer && <XCircle className="ml-auto h-4 w-4 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Feedback — no reattempt, just show correct answer */}
                    {isSubmitted && (
                        <div className={cn(
                            'flex items-center gap-2 font-brand text-sm',
                            selectedChoice === current.answer ? 'text-primary' : 'text-destructive',
                        )}>
                            {selectedChoice === current.answer
                                ? <><CheckCircle className="h-4 w-4" /> Correct!</>
                                : <><XCircle className="h-4 w-4" /> Correct answer: <strong>{current.answer}</strong></>
                            }
                        </div>
                    )}
                </div>
            </Card>

            {/* Next button (appears after answering, hidden on last Q — auto-submits) */}
            {isSubmitted && !isLastQuestion && (
                <Button className="w-full font-brand" onClick={advance}>
                    Next Question <ChevronRight className="ml-1.5 h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
