'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, ChevronRight, Brain, ArrowLeft } from 'lucide-react';
import { useSkillContext } from '@/contexts/SkillContext';
import { cn } from '@/lib/utils';
import type { EngineQuestion } from './QuizSession';
import WhyBox from '@/components/quiz/WhyBox';
import { useRouter } from 'next/navigation';

interface AssessmentSessionProps {
    questions: EngineQuestion[];
    subject: string;
    topic: string;
    level: number;
    resourceTitle: string;
}

const FORM_LABELS: Record<number | string, string> = {
    1: 'Fact Recall', 2: 'MCQ', 3: 'True/False',
    4: 'Fill Blank', 5: 'Category', 6: 'Negative',
};

function determineLevelFromPercentage(percentage: number): 1 | 2 | 3 {
    if (percentage < 60) return 1;
    if (percentage < 90) return 2;
    return 3;
}

export default function AssessmentSession({
    questions,
    subject,
    topic,
    level,
    resourceTitle,
}: AssessmentSessionProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answered, setAnswered] = useState<Map<number, string>>(new Map());
    const [phase, setPhase] = useState<'quiz' | 'results'>('quiz');
    const [overallScore, setOverallScore] = useState<number | null>(null);

    const skillCtx = useSkillContext();
    const router = useRouter();

    const current = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;
    const selectedChoice = answered.get(currentIndex) ?? null;
    const isSubmitted = selectedChoice !== null;

    const handleAnswer = useCallback(async (choice: string) => {
        if (answered.has(currentIndex)) return;

        const isCorrect = choice === current.answer;
        const next = new Map(answered);
        next.set(currentIndex, choice);
        setAnswered(next);

        if (isLastQuestion) {
            // Compute score
            const total = questions.length;
            let correctCount = 0;
            questions.forEach((q, i) => {
                const ans = i === currentIndex ? choice : next.get(i);
                if (ans === q.answer) correctCount++;
            });
            const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
            setOverallScore(percentage);

            // Update skill based on assessment score
            const levelFromScore = determineLevelFromPercentage(percentage);
            skillCtx.updateSkill(subject, levelFromScore, percentage);

            setPhase('results');
        }
    }, [answered, currentIndex, current, isLastQuestion, questions, subject, skillCtx]);

    const handleNext = () => {
        if (!isLastQuestion) setCurrentIndex(i => i + 1);
    };

    if (phase === 'results') {
        const passed = (overallScore ?? 0) >= 60;
        return (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Brain className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="font-brand text-2xl font-bold text-foreground">
                        Assessment Complete
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        You&apos;ve completed the assessment for <span className="font-medium text-foreground">{resourceTitle}</span>.
                    </p>

                    <div className="mt-6 inline-flex flex-col items-center justify-center rounded-lg border border-border bg-background p-6 shadow-xs w-full max-w-xs">
                        <p className="font-brand text-5xl font-bold text-foreground">{overallScore}%</p>
                        <p className={cn("mt-2 text-sm font-medium", passed ? "text-green-600" : "text-amber-600")}>
                            {passed ? "Good job! You've grasped the concepts." : "Review the material and try again."}
                        </p>
                    </div>

                    <div className="mt-8 flex justify-center gap-4">
                        <Button variant="outline" onClick={() => router.back()} className="font-brand gap-1.5">
                            <ArrowLeft className="h-4 w-4" /> Back to Resources
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!current) return null;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-brand text-xl font-semibold text-foreground">Knowledge Check</h2>
                    <p className="text-sm text-muted-foreground line-clamp-1">{resourceTitle}</p>
                </div>
                <div className="text-right">
                    <p className="font-brand text-sm font-medium text-foreground">
                        Question {currentIndex + 1} <span className="text-muted-foreground">of {questions.length}</span>
                    </p>
                </div>
            </div>

            <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />

            {/* Question + Why side by side (Why on right when wrong) */}
            <div className="flex flex-row gap-4 items-stretch">
                <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-300">
                    <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-5 py-3">
                        <span className="font-brand text-xs text-muted-foreground">Level {level} Assessment</span>
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-brand uppercase text-muted-foreground border border-border">
                            {typeof current.form === 'number' ? (FORM_LABELS[current.form] ?? `Form ${current.form}`) : current.form}
                        </span>
                    </div>

                    <div className="p-5 md:p-6 space-y-6">
                        <p className="text-lg md:text-xl font-medium text-foreground leading-snug">
                            {current.question}
                        </p>

                        <div className="grid gap-2.5">
                            {current.choices.map(opt => {
                                const isSelected = selectedChoice === opt;
                                const isCorrectAns = opt === current.answer;

                                let stateClass = "border-border hover:border-primary/50 hover:bg-secondary/50 text-foreground";
                                if (isSubmitted) {
                                    if (isCorrectAns) {
                                        stateClass = "border-green-500 bg-green-500/10 text-green-900 dark:text-green-100 ring-1 ring-green-500/50";
                                    } else if (isSelected) {
                                        stateClass = "border-red-500/50 bg-red-500/10 text-red-900 dark:text-red-100";
                                    } else {
                                        stateClass = "border-border/50 text-muted-foreground opacity-60";
                                    }
                                }

                                return (
                                    <button
                                        key={opt}
                                        disabled={isSubmitted}
                                        onClick={() => handleAnswer(opt)}
                                        className={cn(
                                            "group relative flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all",
                                            stateClass
                                        )}
                                    >
                                        <span className="text-[15px] font-medium leading-tight">{opt}</span>
                                        {isSubmitted && isCorrectAns && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                                        {isSubmitted && isSelected && !isCorrectAns && <XCircle className="h-5 w-5 text-red-500 opacity-80 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {isSubmitted && (
                            <Button
                                onClick={handleNext}
                                className="w-full font-brand font-medium shadow-sm"
                                size="sm"
                            >
                                {isLastQuestion ? 'Finish Assessment' : 'Next Question'}
                                {!isLastQuestion && <ChevronRight className="ml-1.5 h-4 w-4" />}
                            </Button>
                        )}
                    </div>
                </div>

                {isSubmitted && selectedChoice !== null && selectedChoice !== current.answer && current.explanations && (
                    <div className="w-52 sm:w-64 shrink-0 flex flex-col">
                        <WhyBox
                            explanation={current.explanations[String(current.choices.indexOf(selectedChoice))] ?? `The right answer is: ${current.answer}.`}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
