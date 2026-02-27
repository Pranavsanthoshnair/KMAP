'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EngineQuestion } from '@/components/QuizSession';
import { getLocalProfile } from '@/lib/indexeddb';
import { useSkillContext } from '@/contexts/SkillContext';
import { formatSubjectId, type SubjectId } from '@/lib/subjects';

function promotionOutcome(
    currentLevel: 1 | 2 | 3,
    targetLevel: 1 | 2 | 3,
    percentage: number,
): { newLevel: 1 | 2 | 3; status: 'promoted' | 'demoted' | 'same' } {
    if (percentage >= 80) {
        const clamped = Math.min(3, Math.max(1, targetLevel));
        const lvl = clamped as 1 | 2 | 3;
        if (lvl > currentLevel) return { newLevel: lvl, status: 'promoted' };
        return { newLevel: currentLevel, status: 'same' };
    }
    if (percentage < 50) {
        const demoted = (currentLevel - 1) as 1 | 2 | 3;
        const lvl = demoted < 1 ? 1 : demoted;
        if (lvl < currentLevel) return { newLevel: lvl, status: 'demoted' };
        return { newLevel: currentLevel, status: 'same' };
    }
    return { newLevel: currentLevel, status: 'same' };
}

export default function PromotionPage() {
    const params = useParams<{ subject: SubjectId }>();
    const search = useSearchParams();
    const router = useRouter();
    const { getSkill, updateSkill } = useSkillContext();

    const subject = params?.subject ?? 'math';
    const targetLevel = Number(search.get('target') || '2');

    const [gradeBand, setGradeBand] = useState(2);
    const [questions, setQuestions] = useState<EngineQuestion[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState<Map<number, string>>(new Map());
    const [loading, setLoading] = useState(true);
    const [finished, setFinished] = useState(false);
    const [percentage, setPercentage] = useState<number | null>(null);
    const [status, setStatus] = useState<'promoted' | 'demoted' | 'same' | null>(null);

    const current = questions[currentIdx];
    const selected = answers.get(currentIdx) ?? null;
    const isSubmitted = selected !== null;
    const isLast = currentIdx === questions.length - 1;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const profile = await getLocalProfile();
            if (profile && !cancelled) {
                setGradeBand(profile.gradeBand ?? 2);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const level = Math.max(1, Math.min(3, targetLevel || 2));
                const res = await fetch(
                    `/api/questions?subject=${subject}&grade_band=${gradeBand}&level=${level}&count=6&mode=subject`,
                );
                const data = await res.json();
                const qs: EngineQuestion[] = data.questions ?? [];
                if (!cancelled) {
                    setQuestions(qs);
                }
            } catch {
                if (!cancelled) setQuestions([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [subject, gradeBand, targetLevel]);

    const handleAnswer = useCallback(
        (choice: string) => {
            if (!current || isSubmitted) return;
            const next = new Map(answers);
            next.set(currentIdx, choice);
            setAnswers(next);

            if (isLast) {
                // Compute result
                const total = questions.length;
                const correctCount = questions.reduce((acc, q, idx) => {
                    const ans = next.get(idx);
                    return acc + (ans === q.answer ? 1 : 0);
                }, 0);
                const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
                const currentLevel = getSkill(subject) as 1 | 2 | 3;
                const outcome = promotionOutcome(currentLevel, targetLevel as 1 | 2 | 3, pct);
                updateSkill(subject, outcome.newLevel, pct);
                setPercentage(pct);
                setStatus(outcome.status);
                setFinished(true);
            } else {
                setTimeout(() => {
                    setCurrentIdx(i => i + 1);
                }, 800);
            }
        },
        [answers, current, currentIdx, getSkill, isLast, isSubmitted, questions, subject, targetLevel, updateSkill],
    );

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Preparing promotion test…</p>
                </main>
            </div>
        );
    }

    if (!questions.length) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Not enough questions available to run a promotion test for this subject yet.
                    </p>
                    <Button size="sm" onClick={() => router.push('/profile')}>
                        Back to Profile
                    </Button>
                </main>
            </div>
        );
    }

    if (finished && percentage != null && status) {
        const currentLevel = getSkill(subject);
        const prettySubject = formatSubjectId(subject);
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="container mx-auto max-w-lg px-4 py-10">
                    <div className="animate-fade-in space-y-5">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-2 gap-1.5"
                            onClick={() => router.push('/profile')}
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to Profile
                        </Button>
                        <Card className="p-5 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="font-brand text-sm font-semibold text-foreground">
                                        Promotion Result – {prettySubject}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Score: {percentage}% · New Level: {currentLevel}
                                    </p>
                                </div>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'font-brand text-[11px]',
                                        status === 'promoted' && 'border-emerald-500/40 text-emerald-500',
                                        status === 'demoted' && 'border-red-500/40 text-red-500',
                                        status === 'same' && 'border-amber-500/40 text-amber-500',
                                    )}
                                >
                                    {status === 'promoted'
                                        ? 'Promoted'
                                        : status === 'demoted'
                                        ? 'Demoted'
                                        : 'Unchanged'}
                                </Badge>
                            </div>
                            <Progress value={percentage} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                                Promotion rules: ≥ 80% → promote · &lt; 50% → demote one level · otherwise stay at the
                                same level (never below Level 1).
                            </p>
                            <Button className="w-full font-brand mt-2" onClick={() => router.push('/profile')}>
                                Done
                            </Button>
                        </Card>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-lg px-4 py-10">
                <div className="animate-fade-in space-y-5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-2 gap-1.5"
                        onClick={() => router.push('/profile')}
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to Profile
                    </Button>
                    <div>
                        <h1 className="font-brand text-lg font-bold text-foreground">
                            Promotion Test – {formatSubjectId(subject)}
                        </h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Answer a short set of harder questions. Score ≥ 80% to move up. If you score below 50% you
                            may be moved down one level.
                        </p>
                    </div>

                    <Card className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-brand text-muted-foreground">
                                Question {currentIdx + 1} / {questions.length}
                            </span>
                            <Progress
                                value={((currentIdx + 1) / questions.length) * 100}
                                className="h-1.5 w-32"
                            />
                        </div>

                        <p className="font-brand text-sm font-medium leading-relaxed text-foreground">
                            {current.question}
                        </p>

                        <div className="grid grid-cols-1 gap-2">
                            {current.choices.map(choice => {
                                const isThis = selected === choice;
                                const isAnswer = choice === current.answer;
                                return (
                                    <button
                                        key={choice}
                                        onClick={() => handleAnswer(choice)}
                                        disabled={isSubmitted}
                                        className={cn(
                                            'flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm font-brand transition-all',
                                            !isSubmitted &&
                                                'cursor-pointer border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/30',
                                            isSubmitted &&
                                                isAnswer &&
                                                'border-primary bg-accent text-accent-foreground',
                                            isSubmitted &&
                                                isThis &&
                                                !isAnswer &&
                                                'border-destructive bg-destructive/10 text-destructive',
                                            isSubmitted &&
                                                !isThis &&
                                                !isAnswer &&
                                                'border-border bg-muted/20 text-muted-foreground opacity-60',
                                        )}
                                    >
                                        <span className="flex-1">{choice}</span>
                                        {isSubmitted && isAnswer && (
                                            <CheckCircle className="ml-auto h-4 w-4 shrink-0" />
                                        )}
                                        {isSubmitted && isThis && !isAnswer && (
                                            <XCircle className="ml-auto h-4 w-4 shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}

