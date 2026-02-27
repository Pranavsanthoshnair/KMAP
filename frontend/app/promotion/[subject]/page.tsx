'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EngineQuestion } from '@/components/QuizSession';
import WhyBox from '@/components/quiz/WhyBox';
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

function PromotionContent() {
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
    const [selected, setSelected] = useState<string | null>(null);
    const [isFinished, setIsFinished] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadQuestions = useCallback(async (gb: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/questions?subject=${subject}&grade_band=${gb}&level=${targetLevel}&count=5&mode=promotion`);
            const data = await res.json();
            setQuestions(data.questions || []);
        } catch {
            // fallback
        } finally {
            setLoading(false);
        }
    }, [subject, targetLevel]);

    useEffect(() => {
        getLocalProfile().then(p => {
            const gb = p?.gradeBand ?? 2;
            setGradeBand(gb);
            loadQuestions(gb);
        });
    }, [loadQuestions]);

    const handleAnswer = (choice: string) => {
        if (selected) return;
        setSelected(choice);
        setAnswers(prev => new Map(prev).set(currentIdx, choice));
    };

    const handleNext = () => {
        if (currentIdx + 1 < questions.length) {
            setCurrentIdx(currentIdx + 1);
            setSelected(null);
        } else {
            setIsFinished(true);
        }
    };

    const handleFinish = async () => {
        const correct = questions.filter((q, i) => answers.get(i) === q.answer).length;
        const pct = Math.round((correct / questions.length) * 100);
        const currentSkill = getSkill(subject);
        const currentLevel = (currentSkill?.level || 1) as 1 | 2 | 3;
        const outcome = promotionOutcome(currentLevel, targetLevel as 1 | 2 | 3, pct);

        await updateSkill(subject, outcome.newLevel);
        router.replace(`/dashboard?outcome=${outcome.status}&level=${outcome.newLevel}`);
    };

    if (loading) {
        return (
            <main className="container mx-auto max-w-xl px-4 py-10">
                <p className="text-center text-sm text-muted-foreground animate-pulse">Loading promotion test...</p>
            </main>
        );
    }

    if (isFinished) {
        const correct = questions.filter((q, i) => answers.get(i) === q.answer).length;
        const pct = Math.round((correct / questions.length) * 100);
        return (
            <main className="container mx-auto max-w-xl px-4 py-10 text-center">
                <Card className="p-8">
                    <CheckCircle className="mx-auto h-12 w-12 text-primary mb-4" />
                    <h2 className="font-brand text-2xl font-bold mb-2">Test Completed</h2>
                    <p className="text-muted-foreground mb-6">You scored {pct}% ({correct}/{questions.length} correct)</p>
                    <Button onClick={handleFinish} className="w-full">See Results</Button>
                </Card>
            </main>
        );
    }

    const currentQuestion = questions[currentIdx];
    if (!currentQuestion) return null;

    return (
        <main className="container mx-auto max-w-xl px-4 py-10">
            <div className="mb-6 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Exit
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                    Question {currentIdx + 1} of {questions.length}
                </span>
            </div>

            <Progress value={((currentIdx + 1) / questions.length) * 100} className="mb-8 h-2" />

            <div className="space-y-6">
                <Card className="p-6">
                    <h2 className="font-brand text-lg font-semibold leading-tight mb-4">
                        {currentQuestion.question}
                    </h2>
                    <div className="grid gap-3">
                        {currentQuestion.choices.map((choice) => (
                            <Button
                                key={choice}
                                variant={selected === choice ? "default" : "outline"}
                                className={cn(
                                    "justify-start text-left h-auto py-4 px-4 whitespace-normal",
                                    selected && choice === currentQuestion.answer && "border-green-500 bg-green-50 dark:bg-green-950/20",
                                    selected === choice && choice !== currentQuestion.answer && "border-red-500 bg-red-50 dark:bg-red-950/20"
                                )}
                                onClick={() => handleAnswer(choice)}
                                disabled={!!selected}
                            >
                                {choice}
                            </Button>
                        ))}
                    </div>
                </Card>

                {selected && (
                    <div className="animate-in fade-in slide-in-from-bottom-2">
                        <WhyBox explanation={currentQuestion.explanation} />
                        <Button onClick={handleNext} className="w-full mt-6">
                            {currentIdx + 1 === questions.length ? 'Finish Test' : 'Next Question'}
                        </Button>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function PromotionPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <Suspense fallback={
                <main className="container mx-auto max-w-xl px-4 py-10">
                    <p className="text-center text-sm text-muted-foreground animate-pulse">Loading...</p>
                </main>
            }>
                <PromotionContent />
            </Suspense>
        </div>
    );
}

