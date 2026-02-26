'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLocalProfile, saveLocalProfile } from '@/lib/indexeddb';
import { Sigma, FlaskConical, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchSubjects, type SubjectOption } from '@/lib/subjects';

const SUBJECT_DESCRIPTIONS: Record<string, string> = {
    math: 'Arithmetic · Algebra · Geometry · Calculus',
    science: 'Biology · Chemistry · Physics · Microbiology',
    english: 'Grammar · Literature · Writing · Linguistics',
};
const SUBJECT_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    math: Sigma,
    science: FlaskConical,
    english: Languages,
};

export default function SubjectSelectionPage() {
    const router = useRouter();
    const [selected, setSelected] = useState<string[]>([]);
    const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const list = await fetchSubjects();
            if (cancelled) return;
            setSubjectOptions(list);
            const profile = await getLocalProfile();
            if (cancelled || !profile) {
                if (!cancelled) setLoading(false);
                return;
            }
            if (profile.subjects?.length) {
                const validIds = list.map(s => s.id);
                const valid = profile.subjects.filter(s => validIds.includes(s));
                setSelected(valid);
            }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    const toggleSubject = (id: string) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
        );
    };

    const handleSelectAll = () => {
        if (selected.length === subjectOptions.length) {
            setSelected([]);
        } else {
            setSelected(subjectOptions.map((s) => s.id));
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
                            {selected.length === subjectOptions.length ? 'Clear All' : 'Select All'}
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
                        {subjectOptions.map(({ id, label }) => {
                            const active = selected.includes(id);
                            const Icon = SUBJECT_ICONS[id] ?? Sigma;
                            const description = SUBJECT_DESCRIPTIONS[id] ?? '';
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
                                                {description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {description}
                                                    </p>
                                                )}
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

