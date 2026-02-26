'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import CapsuleCard from '@/components/CapsuleCard';
import { supabase } from '@/lib/supabase/client';
import { cacheCapsules, getCachedCapsulesBySubject } from '@/lib/indexeddb';
import type { CapsuleData } from '@/lib/indexeddb';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CapsuleView() {
    const params = useParams<{ subject: string }>();
    const subject = params?.subject;
    const { user, loading } = useAuth();
    const router = useRouter();
    const [capsules, setCapsules] = useState<CapsuleData[]>([]);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }
        if (!subject) return;

        const load = async () => {
            // Try cache first
            const cached = await getCachedCapsulesBySubject(subject);
            if (cached.length > 0) {
                setCapsules(cached);
                setFetching(false);
            }

            // Fetch from server
            try {
                const { data, error } = await supabase
                    .from('capsules')
                    .select('*')
                    .eq('subject', subject);

                if (!error && data) {
                    const mapped: Omit<CapsuleData, 'cachedAt'>[] = data.map((c) => ({
                        id: c.id,
                        concept: c.concept,
                        grade: c.grade,
                        difficulty: c.difficulty,
                        coreIdea: c.core_idea,
                        rule: c.rule,
                        example: c.example,
                        pattern: c.pattern,
                        practice: c.practice,
                        practiceAnswer: c.practice_answer,
                        subject: c.subject,
                    }));
                    await cacheCapsules(mapped);
                    setCapsules(mapped as CapsuleData[]);
                }
            } catch {
                // Offline - use cache
            }
            setFetching(false);
        };

        load();
    }, [subject, user, loading, router]);

    const handleErrorDetected = (capsuleId: string) => {
        const el = document.getElementById(`capsule-${capsuleId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    if (loading || fetching) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading capsules...</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="animate-fade-in">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="mb-4">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>

                    <h1 className="font-brand text-xl font-bold capitalize text-foreground">{subject} Capsules</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {capsules.length} capsule{capsules.length !== 1 ? 's' : ''} loaded
                    </p>

                    <div className="mt-6 space-y-4">
                        {capsules.map((c) => (
                            <div key={c.id} id={`capsule-${c.id}`}>
                                <CapsuleCard capsule={c} onErrorDetected={handleErrorDetected} />
                            </div>
                        ))}
                        {capsules.length === 0 && (
                            <p className="text-center text-sm text-muted-foreground">No capsules available for this subject yet.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
