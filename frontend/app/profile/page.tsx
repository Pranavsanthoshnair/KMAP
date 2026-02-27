'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { getLocalProfile, getSkillProfile, getMasteryMap } from '@/lib/indexeddb';
import { getDailyUsage, resetDailyUsage, getDailyLimitKb, setDailyLimitKb } from '@/lib/data-tracker';
import type { SkillData } from '@/lib/indexeddb';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Brain, Wifi, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SkillDashboard } from '@/components/profile/SkillDashboard';
import { type SubjectId } from '@/lib/subjects';
import { getGradeLabel, GRADE_BAND_OPTIONS } from '@/lib/grades';
import { saveLocalProfile } from '@/lib/indexeddb';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { AlertTriangle } from 'lucide-react';

function masteryColor(m: number) {
    if (m >= 80) return 'text-emerald-500';
    if (m >= 50) return 'text-amber-500';
    return 'text-red-500';
}
function masteryLabel(m: number) {
    if (m >= 80) return 'Mastered';
    if (m >= 50) return 'Progressing';
    return 'Needs Work';
}
function formatConcept(c: string) {
    return c.replace(/_/g, ' ').replace(/\b\w/g, x => x.toUpperCase());
}
function formatKB(kb: number) {
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function Profile() {
    const { ready, userId, logout } = useAuth();
    const router = useRouter();

    const [profileName, setProfileName] = useState('');
    const [gradeBand, setGradeBand] = useState(2);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [skills, setSkills] = useState<SkillData[]>([]);
    const [masteryMap, setMasteryMap] = useState<Record<string, number>>({});
    const [dataUsedKB, setDataUsedKB] = useState(0);
    const [dailyLimitKB, setDailyLimitKB] = useState(10 * 1024);

    useEffect(() => {
        if (!ready) return;

        getLocalProfile().then(p => {
            if (p) {
                setProfileName(p.name);
                setGradeBand(p.gradeBand ?? 2);
                setSubjects(p.subjects ?? []);
            }
        });

        getSkillProfile().then(data =>
            setSkills([...data].sort((a, b) => b.lastAttempt - a.lastAttempt))
        );

        getMasteryMap().then(setMasteryMap);

        // Data usage — client-only
        const usage = getDailyUsage();
        setDataUsedKB(usage.data_used_kb);
        setDailyLimitKB(getDailyLimitKb());
    }, [ready]);

    const totalCorrect = skills.reduce((s, k) => s + k.correct, 0);
    const totalAttempts = skills.reduce((s, k) => s + k.correct + k.incorrect, 0);
    const overallMastery = totalAttempts > 0
        ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    const dataLimitKB = dailyLimitKB;
    const dataPercent = Math.min(100, dataLimitKB > 0 ? Math.round((dataUsedKB / dataLimitKB) * 100) : 0);
    const isOverDataLimit = dataLimitKB > 0 && dataUsedKB >= dataLimitKB;

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-lg px-4 py-10">
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h1 className="font-brand text-xl font-bold text-foreground">Profile</h1>
                            <p className="mt-1 text-sm text-muted-foreground">Your local learning data</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs font-brand"
                                onClick={() => router.push('/subjects')}
                            >
                                Subjects
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-xs font-brand"
                                onClick={async () => {
                                    await logout();
                                    router.replace('/login');
                                }}
                            >
                                Logout
                            </Button>
                        </div>
                    </div>

                    {/* Account card */}
                    <Card className="mt-6 p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                                <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-brand font-semibold text-foreground">
                                    {profileName || 'Learner'}
                                </p>
                                <p className="text-xs text-muted-foreground">ID: {userId.slice(0, 8)}…</p>
                            </div>
                            <Select
                                value={String(gradeBand)}
                                onValueChange={async (v) => {
                                    const band = Number(v) as 1 | 2 | 3 | 4 | 5;
                                    setGradeBand(band);
                                    const profile = await getLocalProfile();
                                    if (profile) await saveLocalProfile({ ...profile, gradeBand: band });
                                    if (typeof window !== 'undefined') window.localStorage.setItem('grade_band', String(band));
                                }}
                            >
                                <SelectTrigger className="ml-auto h-8 w-auto min-w-[140px] border-border font-brand text-xs">
                                    <SelectValue placeholder="Grade" />
                                </SelectTrigger>
                                <SelectContent>
                                    {GRADE_BAND_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={String(opt.value)}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Grade affects questions, subjects, subtopics, and resources across the app.
                            </p>
                        </div>
                    </Card>

                    {isOverDataLimit && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="font-brand">Daily data limit reached ({formatKB(dataUsedKB)}). Usage resets at midnight or use Reset below.</span>
                        </div>
                    )}
                    {/* Data Used Today */}
                    <Card className="mt-4 p-5">
                        <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-muted-foreground" />
                            <span className="font-brand text-sm font-semibold text-foreground flex-1">
                                Data Used Today
                            </span>
                            <span className={cn('font-brand text-sm font-bold', isOverDataLimit ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                                {formatKB(dataUsedKB)}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground"
                                onClick={() => { resetDailyUsage(); setDataUsedKB(0); }}
                                title="Reset counter"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        <Progress value={dataPercent} className="mt-2 h-1.5" />
                        <p className="mt-2 font-brand text-xs text-muted-foreground">
                            Daily limit
                        </p>
                        <Slider
                            className="mt-1 w-full"
                            min={1024}
                            max={50 * 1024}
                            step={1024}
                            value={[dailyLimitKB]}
                            onValueChange={([v]) => {
                                const kb = v ?? dailyLimitKB;
                                setDailyLimitKB(kb);
                                setDailyLimitKb(kb);
                            }}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            {formatKB(dataUsedKB)} of {formatKB(dataLimitKB)} · resets at midnight
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground italic">
                            Tracked locally only — never sent to server.
                        </p>
                    </Card>

                    {/* Overall mastery */}
                    {totalAttempts > 0 && (
                        <Card className="mt-4 p-5">
                            <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-muted-foreground" />
                                <span className="font-brand text-sm font-semibold text-foreground">
                                    Overall Mastery
                                </span>
                                <span className={cn('ml-auto font-brand text-sm font-bold', masteryColor(overallMastery))}>
                                    {overallMastery}%
                                </span>
                            </div>
                            <Progress value={overallMastery} className="mt-2 h-2" />
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                {totalCorrect} correct / {totalAttempts} total · {skills.length} concept{skills.length !== 1 ? 's' : ''}
                            </p>
                        </Card>
                    )}

                    {/* Mastery map (float display) */}
                    {Object.keys(masteryMap).length > 0 && (
                        <div className="mt-6">
                            <h2 className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Subtopic Mastery
                            </h2>
                            <div className="space-y-2">
                                {Object.entries(masteryMap)
                                    .sort(([, a], [, b]) => a - b) // weakest first
                                    .map(([subtopic, score]) => {
                                        const pct = Math.round(score * 100);
                                        const cls = score < 0.3 ? 'weak' : score <= 0.6 ? 'medium' : 'strong';
                                        return (
                                            <div key={subtopic} className="flex items-center gap-3">
                                                <span className="font-brand text-xs w-36 shrink-0 text-foreground capitalize">
                                                    {formatConcept(subtopic)}
                                                </span>
                                                <Progress value={pct} className="flex-1 h-1.5" />
                                                <Badge
                                                    variant="outline"
                                                    className={cn('text-xs font-brand shrink-0 w-16 justify-center', {
                                                        'border-red-500/40 text-red-500': cls === 'weak',
                                                        'border-amber-500/40 text-amber-500': cls === 'medium',
                                                        'border-emerald-500/40 text-emerald-500': cls === 'strong',
                                                    })}
                                                >
                                                    {cls}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Subject skill dashboard & grade selection */}
                    <SkillDashboard
                        subjects={(subjects.length ? subjects : ['math', 'science', 'english']).filter(
                            (s): s is SubjectId => ['math', 'science', 'english'].includes(s),
                        )}
                    />

                    {/* Per-concept skill cards */}
                    {skills.length > 0 && (
                        <div className="mt-6">
                            <h2 className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                Question Accuracy
                            </h2>
                            <div className="space-y-2.5">
                                {skills.map(s => (
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
                                Answer questions to begin tracking your progress.
                            </p>
                        </div>
                    )}

                    <p className="mt-8 text-xs text-muted-foreground">
                        All data is stored on your device only — nothing is sent to any server.
                    </p>
                </div>
            </main>
        </div>
    );
}
