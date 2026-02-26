'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { getLocalProfile, getSkillProfile } from '@/lib/indexeddb';
import type { SkillData } from '@/lib/indexeddb';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { User, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRADE_BAND_LABELS: Record<number, string> = {
    1: 'Classes 1–4',
    2: 'Classes 5–8',
    3: 'Classes 9–10',
    4: 'Classes 11–12',
    5: 'College',
};

function masteryColor(mastery: number) {
    if (mastery >= 80) return 'text-emerald-500';
    if (mastery >= 50) return 'text-amber-500';
    return 'text-red-500';
}

function masteryLabel(mastery: number) {
    if (mastery >= 80) return 'Mastered';
    if (mastery >= 50) return 'Progressing';
    return 'Needs Work';
}

/** Format a raw skill concept key for readable display.
 *  e.g. "sci_cell_001" → "sci_cell_001", "cell_structure" → "Cell Structure"
 */
function formatConcept(concept: string) {
    return concept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function Profile() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [profileName, setProfileName] = useState('');
    const [gradeBand, setGradeBand] = useState(1);
    const [skills, setSkills] = useState<SkillData[]>([]);

    useEffect(() => {
        if (!loading && !user) { router.push('/login'); return; }
        getLocalProfile().then((p) => {
            if (p) { setProfileName(p.name); setGradeBand(p.gradeBand); }
        });
        getSkillProfile().then(data => {
            // Sort by most-recently attempted first
            setSkills([...data].sort((a, b) => b.lastAttempt - a.lastAttempt));
        });
    }, [user, loading, router]);

    const totalCorrect = skills.reduce((s, k) => s + k.correct, 0);
    const totalAttempts = skills.reduce((s, k) => s + k.correct + k.incorrect, 0);
    const overallMastery = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-lg px-4 py-10">
                <div className="animate-fade-in">
                    <h1 className="font-brand text-xl font-bold text-foreground">Profile</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Your local learning progress</p>

                    {/* Account card */}
                    <Card className="mt-6 p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                                <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-brand font-semibold text-foreground">{profileName || user?.email}</p>
                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                            </div>
                            <Badge variant="outline" className="ml-auto font-brand text-xs">
                                {GRADE_BAND_LABELS[gradeBand] ?? `Band ${gradeBand}`}
                            </Badge>
                        </div>
                    </Card>

                    {/* Overall mastery */}
                    {totalAttempts > 0 && (
                        <Card className="mt-4 p-5">
                            <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-muted-foreground" />
                                <span className="font-brand text-sm font-semibold text-foreground">Overall Mastery</span>
                                <span className={cn('ml-auto font-brand text-sm font-bold', masteryColor(overallMastery))}>
                                    {overallMastery}%
                                </span>
                            </div>
                            <Progress value={overallMastery} className="mt-2 h-2" />
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                {totalCorrect} correct out of {totalAttempts} attempts across {skills.length} concept{skills.length !== 1 ? 's' : ''}
                            </p>
                        </Card>
                    )}

                    {/* Per-concept skill cards */}
                    {skills.length > 0 && (
                        <div className="mt-6">
                            <h2 className="font-brand text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Skill Breakdown
                            </h2>
                            <div className="mt-3 space-y-2.5">
                                {skills.map((s) => (
                                    <Card key={s.concept} className="p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="font-brand text-sm font-medium text-foreground">
                                                {formatConcept(s.concept)}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={cn('font-brand text-xs font-semibold', masteryColor(s.mastery))}>
                                                    {masteryLabel(s.mastery)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{s.mastery}%</span>
                                            </div>
                                        </div>
                                        <Progress value={s.mastery} className="mt-2 h-1.5" />
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {s.correct} correct · {s.incorrect} incorrect
                                        </p>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {skills.length === 0 && (
                        <div className="mt-10 text-center">
                            <p className="text-sm text-muted-foreground">No skill data yet.</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Answer questions in your subjects to track your progress here.
                            </p>
                        </div>
                    )}

                    <p className="mt-8 text-xs text-muted-foreground">
                        All learning data is stored locally on your device — nothing is sent to any server.
                    </p>
                </div>
            </main>
        </div>
    );
}
