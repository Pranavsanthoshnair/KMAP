'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { detectMathError } from '@/lib/error-detection';
import { updateSkill, recordError } from '@/lib/indexeddb';
import type { CapsuleData } from '@/lib/indexeddb';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react';

interface CapsuleCardProps {
    capsule: CapsuleData;
    onErrorDetected?: (capsuleId: string) => void;
}

export default function CapsuleCard({ capsule, onErrorDetected }: CapsuleCardProps) {
    const [answer, setAnswer] = useState('');
    const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!answer.trim()) return;
        setSubmitted(true);

        const isCorrect = answer.trim() === capsule.practiceAnswer;
        await updateSkill(capsule.concept, isCorrect);

        if (isCorrect) {
            setFeedback({ correct: true, message: 'Correct!' });
        } else {
            const error = detectMathError(capsule.practice, answer.trim(), capsule.practiceAnswer);
            if (error && error.suggestedCapsule) {
                await recordError(capsule.concept, error.errorType, error.suggestedCapsule);
                onErrorDetected?.(error.suggestedCapsule);
            }
            setFeedback({
                correct: false,
                message: error?.message || `Not quite. The answer is ${capsule.practiceAnswer}.`,
            });
        }
    };

    const handleReset = () => {
        setAnswer('');
        setFeedback(null);
        setSubmitted(false);
    };

    return (
        <Card className="animate-fade-in overflow-hidden">
            <div className="border-b border-border bg-secondary/50 px-5 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-brand text-sm font-semibold uppercase tracking-wider text-foreground">
                        {capsule.concept}
                    </h3>
                    <Badge variant="outline" className="font-brand text-xs">
                        {capsule.id}
                    </Badge>
                </div>
            </div>

            <div className="space-y-4 p-5">
                <div>
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <Lightbulb className="h-3 w-3" /> Core Idea
                    </div>
                    <p className="mt-1 text-sm text-foreground">{capsule.coreIdea}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rule</div>
                        <p className="mt-1 font-brand text-sm text-primary">{capsule.rule}</p>
                    </div>
                    <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Example</div>
                        <p className="mt-1 font-brand text-sm text-foreground">{capsule.example}</p>
                    </div>
                </div>

                <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pattern</div>
                    <p className="mt-1 text-sm text-muted-foreground">{capsule.pattern}</p>
                </div>

                <div className="rounded-md border border-border bg-secondary/30 p-4">
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Practice</div>
                    <p className="mt-1 font-brand text-base font-medium text-foreground">{capsule.practice}</p>

                    <div className="mt-3 flex gap-2">
                        <Input
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Your answer"
                            disabled={submitted}
                            className="font-brand"
                            onKeyDown={(e) => e.key === 'Enter' && !submitted && handleSubmit()}
                        />
                        {!submitted ? (
                            <Button onClick={handleSubmit} size="sm">
                                Submit
                            </Button>
                        ) : (
                            <Button onClick={handleReset} variant="outline" size="sm">
                                Retry
                            </Button>
                        )}
                    </div>

                    {feedback && (
                        <div className={`mt-3 flex items-center gap-2 text-sm ${feedback.correct ? 'text-primary' : 'text-destructive'}`}>
                            {feedback.correct ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            {feedback.message}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
