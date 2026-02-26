'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLocalProfile, saveLocalProfile } from '@/lib/indexeddb';
import { Sigma, FlaskConical, Languages, Clock, Laptop } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubjectId = 'math' | 'science' | 'english';

interface SubjectOption {
    id: SubjectId;
    label: string;
    description: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const SUBJECT_OPTIONS: SubjectOption[] = [
    {
        id: 'math',
        label: 'Math',
        description: 'Arithmetic · Algebra · Geometry · Calculus',
        icon: Sigma,
    },
    {
        id: 'science',
        label: 'Science',
        description: 'Biology · Chemistry · Physics · Microbiology',
        icon: FlaskConical,
    },
    {
        id: 'english',
        label: 'English',
        description: 'Grammar · Literature · Writing · Linguistics',
        icon: Languages,
    },
];

export default function SubjectSelectionPage() {
    const router = useRouter();
    const [selected, setSelected] = useState<SubjectId[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getLocalProfile()
            .then((p) => {
                if (cancelled || !p) return;
                if (p.subjects && p.subjects.length > 0) {
                    const valid = p.subjects.filter((s): s is SubjectId =>
                        ['math', 'science', 'english'].includes(s),
                    );
                    setSelected(valid);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const toggleSubject = (id: SubjectId) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
        );
    };

    const handleSelectAll = () => {
        if (selected.length === SUBJECT_OPTIONS.length) {
            setSelected([]);
        } else {
            setSelected(SUBJECT_OPTIONS.map((s) => s.id));
        }
    };

    const handleConfirm = async () => {
        if (selected.length === 0) return;
        const profile = await getLocalProfile();
        if (!profile) {
            router.replace('/login');
            return;
        }
        await saveLocalProfile({ ...profile, subjects: selected });
        router.replace('/dashboard');
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center px-4">
                    <p className="text-sm text-muted-foreground animate-pulse">
                        Loading subjects…
                    </p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto flex-1 px-4 py-10 max-w-3xl">
                <div className="animate-fade-in space-y-8">
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span />
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-primary hover:underline"
                        >
                            {selected.length === SUBJECT_OPTIONS.length ? 'Clear All' : 'Select All'}
                        </button>
                    </div>

                    <div>
                        <h1 className="font-brand text-2xl font-bold text-foreground">
                            Choose Subjects
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Pick the subjects you want KMAP to focus on. You can change this later
                            from your profile.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {SUBJECT_OPTIONS.map(({ id, label, description, icon: Icon }) => {
                            const active = selected.includes(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleSubject(id)}
                                    className="text-left"
                                >
                                    <Card
                                        className={cn(
                                            'flex h-full flex-col justify-between border border-border bg-card/60 px-6 py-5 transition-all',
                                            'hover:border-primary/60 hover:bg-primary/5',
                                            active && 'border-primary bg-primary/10 shadow-sm',
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                                                <Icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-brand text-sm font-semibold text-foreground">
                                                    {label}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {description}
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </button>
                            );
                        })}
                    </div>

                    <div className="pt-2">
                        <Button
                            className="w-full font-brand"
                            size="lg"
                            disabled={selected.length === 0}
                            onClick={handleConfirm}
                        >
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}

