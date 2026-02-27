'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AssessmentSession from '@/components/AssessmentSession';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import type { EngineQuestion } from '@/components/QuizSession';

function AssessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const subject = searchParams.get('subject') || '';
    const topic = searchParams.get('topic') || '';
    const level = parseInt(searchParams.get('level') || '2', 10);
    const title = searchParams.get('title') || 'Resource Assessment';

    const [questions, setQuestions] = useState<EngineQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!subject || !topic) {
            setError('Missing subject or topic parameters.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadQuestions = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch 4 questions specific to the topic and difficulty level
                const res = await fetch(`/api/questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&level=${level}&count=4&mode=subtopic`);
                const data = await res.json();

                if (cancelled) return;

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load questions');
                }

                if (!data.questions || data.questions.length === 0) {
                    setError('No questions available for this level yet.');
                } else {
                    setQuestions(data.questions);
                }
            } catch (err: unknown) {
                if (cancelled) return;
                const e = err as { message?: string };
                setError(e?.message || 'Error connecting to assessment engine.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadQuestions();

        return () => {
            cancelled = true;
        };
    }, [subject, topic, level]);

    return (
        <main className="container mx-auto px-4 py-8 max-w-4xl flex-1 flex flex-col">
            <div className="mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="gap-1.5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
            </div>

            {loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="font-brand">Generating your assessment...</p>
                </div>
            )}

            {!loading && error && (
                <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <h2 className="font-brand text-xl font-bold text-foreground">Assessment Unavailable</h2>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={() => router.back()}>
                        Return to Resources
                    </Button>
                </div>
            )}

            {!loading && !error && questions.length > 0 && (
                <div className="flex-1">
                    <AssessmentSession
                        questions={questions}
                        subject={subject}
                        topic={topic}
                        level={level}
                        resourceTitle={title}
                    />
                </div>
            )}
        </main>
    );
}

export default function AssessPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <Suspense fallback={
                <main className="container mx-auto px-4 py-8 max-w-4xl flex-1 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="font-brand mt-4 text-muted-foreground">Loading...</p>
                </main>
            }>
                <AssessContent />
            </Suspense>
        </div>
    );
}

