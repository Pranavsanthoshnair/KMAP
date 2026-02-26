'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { getLocalProfile, getSkillProfile } from '@/lib/indexeddb';
import type { SkillData } from '@/lib/indexeddb';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

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
        getSkillProfile().then(setSkills);
    }, [user, loading, router]);

    const gradeBandLabel = ['', 'Classes 1–4', 'Classes 5–8', 'Classes 9–10', 'Classes 11–12', 'College'][gradeBand] || '';

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-lg px-4 py-10">
                <div className="animate-fade-in">
                    <h1 className="font-brand text-xl font-bold text-foreground">Profile</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Your local learning data</p>

                    <Card className="mt-6 p-5">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Name</span>
                                <span className="font-medium text-foreground">{profileName || user?.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Grade Band</span>
                                <span className="font-medium text-foreground">{gradeBandLabel}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Email</span>
                                <span className="font-medium text-foreground">{user?.email}</span>
                            </div>
                        </div>
                    </Card>

                    {skills.length > 0 && (
                        <div className="mt-8">
                            <h2 className="font-brand text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Skill Profile
                            </h2>
                            <div className="mt-3 space-y-3">
                                {skills.map((s) => (
                                    <Card key={s.concept} className="p-4">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-brand capitalize text-foreground">{s.concept}</span>
                                            <span className="text-muted-foreground">{s.mastery}%</span>
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

                    <p className="mt-8 text-xs text-muted-foreground">
                        All learning data is stored locally on your device. Nothing is sent to the server.
                    </p>
                </div>
            </main>
        </div>
    );
}
