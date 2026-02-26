'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { updateSkill } from '@/lib/indexeddb';
import { cn } from '@/lib/utils';

export interface EngineQuestion {
    id: string;
    form: string | number;
    question: string;
    choices: string[];
    answer: string;
}

const FORM_LABELS: Record<number, string> = {
    1: 'Direct',
    2: 'Reverse',
    3: 'True / False',
    4: 'Fill Blank',
    5: 'Category',
    6: 'Negative',
};

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

interface QuestionCardProps {
    question: EngineQuestion;
    index: number;
    /** Topic slug used as the IndexedDB skill key (e.g. "cell_structure"). Falls back to fact id. */
    topic?: string;
}

export default function QuestionCard({ question, index, topic }: QuestionCardProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSelect = async (choice: string) => {
        if (submitted) return;
        setSelected(choice);
        setSubmitted(true);
        // Track skill using topic slug (shows better labels on Profile page)
        try {
            await updateSkill(topic ?? question.id, choice === question.answer);
        } catch {
            // IndexedDB may not be available — silently ignore
        }
    };

    const handleReset = () => {
        setSelected(null);
        setSubmitted(false);
    };

    const isCorrect = submitted && selected === question.answer;

    return (
        <Card className="animate-fade-in overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-5 py-3">
                <div className="flex items-center gap-2">
                    <span className="font-brand text-xs text-muted-foreground">Q{index + 1}</span>
                    <Badge variant="outline" className="font-brand text-xs">
                        {typeof question.form === 'number'
                            ? (FORM_LABELS[question.form] ?? `Form ${question.form}`)
                            : question.form}
                    </Badge>
                </div>
                {submitted && (
                    <button
                        onClick={handleReset}
                        title="Try again"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            <div className="space-y-4 p-5">
                {/* Question text */}
                <p className="font-brand text-sm font-medium leading-relaxed text-foreground">
                    {question.question}
                </p>

                {/* Answer choices */}
                <div className="grid grid-cols-1 gap-2">
                    {question.choices.map((choice, i) => {
                        const isThisChoice = selected === choice;
                        const isAnswer = choice === question.answer;

                        return (
                            <button
                                key={i}
                                onClick={() => handleSelect(choice)}
                                disabled={submitted}
                                className={cn(
                                    'flex w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left text-sm font-brand transition-all',
                                    // Default (unanswered)
                                    !submitted && 'cursor-pointer border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent/30',
                                    // Correct answer highlight
                                    submitted && isAnswer && 'border-primary bg-accent text-accent-foreground',
                                    // Wrong selection highlight
                                    submitted && isThisChoice && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                                    // Unselected, unsubmitted dimmed
                                    submitted && !isThisChoice && !isAnswer && 'border-border bg-muted/20 text-muted-foreground opacity-60',
                                )}
                            >
                                {/* Letter badge */}
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                                    {CHOICE_LETTERS[i]}
                                </span>
                                <span className="flex-1">{choice}</span>
                                {submitted && isAnswer && <CheckCircle className="ml-auto h-4 w-4 shrink-0" />}
                                {submitted && isThisChoice && !isAnswer && <XCircle className="ml-auto h-4 w-4 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback message */}
                {submitted && (
                    <div
                        className={cn(
                            'flex items-center gap-2 font-brand text-sm',
                            isCorrect ? 'text-primary' : 'text-destructive',
                        )}
                    >
                        {isCorrect ? (
                            <><CheckCircle className="h-4 w-4" /> Correct! Well done.</>
                        ) : (
                            <><XCircle className="h-4 w-4" /> Correct answer: <strong>{question.answer}</strong></>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
