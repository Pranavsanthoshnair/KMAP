'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getLocalProfile } from '@/lib/indexeddb';
import { BookOpen, FlaskConical, Languages, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUBJECTS = [
    {
        id: 'math',
        label: 'Mathematics',
        icon: BookOpen,
        description: 'Arithmetic · Algebra · Geometry · Calculus',
        color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/50',
        iconColor: 'text-blue-500',
    },
    {
        id: 'science',
        label: 'Science',
        icon: FlaskConical,
        description: 'Biology · Chemistry · Physics · Microbiology',
        color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50',
        iconColor: 'text-emerald-500',
    },
    {
        id: 'english',
        label: 'English',
        icon: Languages,
        description: 'Grammar · Literature · Writing · Linguistics',
        color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:border-purple-500/50',
        iconColor: 'text-purple-500',
    },
];

const GRADE_BAND_LABELS: Record<number, string> = {
    1: 'Classes 1–4',
    2: 'Classes 5–8',
    3: 'Classes 9–10',
    4: 'Classes 11–12',
    5: 'College',
};

export default function Dashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [name, setName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!loading && !user) { router.push('/login'); return; }
        getLocalProfile().then((p) => {
            if (p) {
                setName(p.name);
                setGradeBand(p.gradeBand ?? 2);
            }
            setInitialized(true);
        });
    }, [user, loading, router]);

    if (loading || !initialized) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="animate-fade-in">

                    {/* Greeting */}
                    <div className="mb-8">
                        <h1 className="font-brand text-2xl font-bold text-foreground">
                            Hello, {name || 'Learner'} 👋
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {GRADE_BAND_LABELS[gradeBand]} · Pick a subject to start
                        </p>
                    </div>

                    {/* Subject cards — single click goes directly to capsule view */}
                    <div className="space-y-3">
                        {SUBJECTS.map(({ id, label, icon: Icon, description, color, iconColor }) => (
                            <Card
                                key={id}
                                onClick={() => router.push(`/capsules/${id}`)}
                                className={cn(
                                    'group flex cursor-pointer items-center gap-4 bg-gradient-to-r p-5 transition-all',
                                    color,
                                )}
                            >
                                <div className={cn('rounded-lg p-2.5 bg-background/60', iconColor)}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-brand font-semibold text-foreground">{label}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Card>
                        ))}
                    </div>

                    {/* Grade band badge */}
                    <div className="mt-8 flex items-center gap-2">
                        <Badge variant="outline" className="font-brand text-xs">
                            Grade Band {gradeBand} · {GRADE_BAND_LABELS[gradeBand]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            Questions are personalised to your level
                        </span>
                    </div>

                </div>
            </main>
        </div>
    );
}
