'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getLocalProfile, saveLocalProfile, generateRecoveryKey } from '@/lib/indexeddb';

export default function LoginPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [existingName, setExistingName] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);

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

    const handleContinue = () => {
        router.replace('/dashboard');
    };

    const handleCreate = async () => {
        const profileName = name.trim() || 'Learner';
        const profile = {
            id: crypto.randomUUID(),
            name: profileName,
            gradeBand,
            subjects: [] as string[],
            recoveryKey: generateRecoveryKey(),
        };
        await saveLocalProfile(profile);
        router.replace('/dashboard');
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
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-muted-foreground">
                                        Grade band (1–5)
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={gradeBand}
                                        onChange={(e) => {
                                            const v = Number(e.target.value) || 2;
                                            const clamped = Math.min(5, Math.max(1, v));
                                            setGradeBand(clamped);
                                        }}
                                    />
                                </div>
                            </div>
                            <Button className="w-full mt-3" onClick={handleCreate}>
                                Get Started
                            </Button>
                        </>
                    )}
                </Card>
            </main>
        </div>
    );
}
