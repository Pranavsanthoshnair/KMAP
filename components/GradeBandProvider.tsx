'use client';

import { useState, useEffect, ReactNode } from 'react';

export function GradeBandProvider({ children }: { children: ReactNode }) {
    const [gradeBand, setGradeBand] = useState<number | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem('grade_band');
        if (stored) {
            setGradeBand(parseInt(stored, 10));
        }
    }, []);

    const handleSelect = (band: number) => {
        localStorage.setItem('grade_band', band.toString());
        setGradeBand(band);
    };

    return (
        <>
            {children}
            {isMounted && gradeBand === null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
                        <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground text-center">
                            Select your class
                        </h2>
                        <p className="mb-6 text-sm text-muted-foreground text-center">
                            This helps us personalize your learning experience. You can change this later.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleSelect(1)}
                                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary"
                            >
                                <span className="font-medium text-foreground">Class 1–4</span>
                                <span className="text-sm text-muted-foreground">Primary</span>
                            </button>
                            <button
                                onClick={() => handleSelect(2)}
                                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary"
                            >
                                <span className="font-medium text-foreground">Class 5–8</span>
                                <span className="text-sm text-muted-foreground">Middle School</span>
                            </button>
                            <button
                                onClick={() => handleSelect(3)}
                                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary"
                            >
                                <span className="font-medium text-foreground">Class 9–10</span>
                                <span className="text-sm text-muted-foreground">Secondary</span>
                            </button>
                            <button
                                onClick={() => handleSelect(4)}
                                className="flex items-center justify-between rounded-lg border border-border bg-background p-4 transition-colors hover:bg-secondary"
                            >
                                <span className="font-medium text-foreground">Class 11–12</span>
                                <span className="text-sm text-muted-foreground">Senior Secondary</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
