'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Award, Lock, Flame, BookOpen, Star } from 'lucide-react';
import { getEarnedBadges, getActivityStats } from '@/lib/indexeddb';
import { ALL_BADGES, BADGE_MAP } from '@/lib/badges';
import { cn } from '@/lib/utils';
import type { EarnedBadge, ActivityStats } from '@/lib/indexeddb';

export default function BadgesPage() {
    const router = useRouter();
    const [earned, setEarned] = useState<EarnedBadge[]>([]);
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            const [badges, activity] = await Promise.all([
                getEarnedBadges(),
                getActivityStats(),
            ]);
            setEarned(badges);
            setStats(activity);
            setLoaded(true);
        })();
    }, []);

    const earnedIds = new Set(earned.map(b => b.id));

    if (!loaded) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-muted-foreground animate-pulse">Loading badges…</p>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-2xl px-4 py-10">
                <div className="animate-fade-in space-y-8">

                    {/* Back */}
                    <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="font-brand -ml-2">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>

                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Award className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-brand text-2xl font-bold text-foreground">Badges</h1>
                            <p className="text-sm text-muted-foreground">
                                {earnedIds.size} / {ALL_BADGES.length} unlocked
                            </p>
                        </div>
                    </div>

                    {/* ── Stats strip ──────────────────────────────────────────────────── */}
                    {stats && (
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { icon: BookOpen, label: 'Questions', value: stats.totalQuestionsAnswered },
                                { icon: Flame, label: 'Streak', value: `${stats.currentStreak}d` },
                                { icon: Star, label: 'Perfect Quizzes', value: stats.perfectQuizzes },
                            ].map(({ icon: Icon, label, value }) => (
                                <div
                                    key={label}
                                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-3 py-4 text-center shadow-sm"
                                >
                                    <Icon className="h-4 w-4 text-primary" />
                                    <span className="font-brand text-xl font-bold text-foreground">{value}</span>
                                    <span className="font-brand text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Badge grid ───────────────────────────────────────────────────── */}
                    <div>
                        <p className="mb-4 font-brand text-xs uppercase tracking-widest text-muted-foreground">
                            All Badges
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {ALL_BADGES.map(badge => {
                                const isEarned = earnedIds.has(badge.id);
                                const earnedEntry = earned.find(e => e.id === badge.id);
                                const earnedDate = earnedEntry
                                    ? new Date(earnedEntry.earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                    : null;

                                return (
                                    <div
                                        key={badge.id}
                                        className={cn(
                                            'relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all',
                                            isEarned
                                                ? 'border-primary/40 bg-primary/5 shadow-sm'
                                                : 'border-border bg-muted/20 opacity-60',
                                        )}
                                    >
                                        {/* Emoji / lock */}
                                        <div className={cn(
                                            'flex h-14 w-14 items-center justify-center rounded-full text-3xl',
                                            isEarned ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-secondary',
                                        )}>
                                            {isEarned
                                                ? <span role="img" aria-label={badge.name}>{badge.emoji}</span>
                                                : <Lock className="h-6 w-6 text-muted-foreground" />
                                            }
                                        </div>

                                        <div>
                                            <p className="font-brand text-sm font-semibold text-foreground leading-snug">
                                                {badge.name}
                                            </p>
                                            <p className="mt-0.5 font-brand text-[11px] text-muted-foreground leading-snug">
                                                {isEarned ? badge.description : badge.hint}
                                            </p>
                                            {isEarned && earnedDate && (
                                                <p className="mt-1.5 font-brand text-[10px] text-primary font-medium">
                                                    Earned {earnedDate}
                                                </p>
                                            )}
                                        </div>

                                        {/* Earned checkmark */}
                                        {isEarned && (
                                            <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}
