'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getLocalProfile, saveLocalProfile, generateRecoveryKey } from '@/lib/indexeddb';
import { GRADE_BAND_OPTIONS } from '@/lib/grades';

export default function LoginPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [existingName, setExistingName] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);
    const [nameError, setNameError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        getLocalProfile().then((p) => {
            if (cancelled) return;
            if (p) {
                setExistingName(p.name);
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const handleContinue = async () => {
        const profile = await getLocalProfile();
        const hasSubjects = profile?.subjects && profile.subjects.length > 0;
        router.replace(hasSubjects ? '/dashboard' : '/subjects');
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setNameError('Please enter your name to continue.');
            return;
        }
        setNameError(null);
        const profileName = trimmed;
        const profile = {
            id: crypto.randomUUID(),
            name: profileName,
            gradeBand,
            subjects: [] as string[],
            recoveryKey: generateRecoveryKey(),
        };
        await saveLocalProfile(profile);
        router.replace('/subjects');
    };

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center px-4">
                    <p className="text-sm text-muted-foreground animate-pulse">Preparing your profile…</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex flex-1 items-center justify-center px-4">
                <Card className="w-full max-w-md p-6 space-y-4">
                    {existingName ? (
                        <>
                            <h1 className="font-brand text-lg font-bold text-foreground">Welcome back</h1>
                            <p className="text-sm text-muted-foreground">
                                Continue as <span className="font-semibold">{existingName}</span>. Your progress is
                                stored locally on this device.
                            </p>
                            <Button className="w-full mt-2" onClick={handleContinue}>
                                Continue to Subjects
                            </Button>
                        </>
                    ) : (
                        <>
                            <h1 className="font-brand text-lg font-bold text-foreground">Create your local profile</h1>
                            <p className="text-sm text-muted-foreground">
                                No account. No signup. Everything is saved privately on this device.
                            </p>
                            <div className="space-y-3 mt-2">
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-muted-foreground">
                                        Name
                                    </label>
                                    <Input
                                        placeholder="Enter your name"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            if (nameError && e.target.value.trim()) {
                                                setNameError(null);
                                            }
                                        }}
                                    />
                                    {nameError && (
                                        <p className="mt-1 text-[11px] text-destructive">
                                            {nameError}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-muted-foreground">
                                        Grade
                                    </label>
                                    <Select
                                        value={String(gradeBand)}
                                        onValueChange={(v) => setGradeBand(Number(v) as 1 | 2 | 3 | 4 | 5)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GRADE_BAND_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={String(opt.value)}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button
                                className="w-full mt-3"
                                onClick={handleCreate}
                                disabled={!name.trim()}
                            >
                                Get Started
                            </Button>
                        </>
                    )}
                </Card>
            </main>
        </div>
    );
}
