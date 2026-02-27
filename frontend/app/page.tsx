'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { ShieldCheck, WifiOff, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Landing() {
    return (
        <div className="relative flex min-h-screen flex-col bg-primary/5">
            {/* Subtle background accent */}
            <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto h-80 max-w-2xl rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5" />

            <Navbar />
            <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
                <Card className="w-full max-w-xl rounded-2xl border border-primary/20 bg-background px-4 py-6 shadow-lg shadow-primary/15 sm:px-8 sm:py-8">
                    <div className="animate-fade-in text-center rounded-xl bg-primary/5 px-4 py-5 sm:px-6 sm:py-6">
                        <h1 className="font-brand text-5xl font-bold tracking-tighter text-foreground sm:text-7xl">
                            KMAP
                        </h1>
                        <p className="mt-3 font-brand text-xs tracking-[0.25em] text-muted-foreground uppercase">
                            Knowledge Mapping Adaptive Platform
                        </p>
                        <div className="mt-8 flex justify-center gap-3">
                            <Link
                                href="/signup"
                                className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                Get Started
                            </Link>
                            <Link
                                href="/login"
                                className="inline-flex h-10 items-center rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                            >
                                Login
                            </Link>
                        </div>
                        <p className="mt-8 max-w-md text-xs leading-relaxed text-muted-foreground mx-auto">
                            Privacy-first adaptive learning through Knowledge Capsules.
                            Minimal bandwidth. Offline capable.
                        </p>

                        {/* Lightweight feature strip */}
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                <span className="font-brand">Private on-device profile</span>
                            </div>
                            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1">
                                <WifiOff className="h-3.5 w-3.5 text-primary" />
                                <span className="font-brand">Works offline after sync</span>
                            </div>
                            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-3 py-1">
                                <Activity className="h-3.5 w-3.5 text-primary" />
                                <span className="font-brand">Adaptive by subtopic</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    );
}
