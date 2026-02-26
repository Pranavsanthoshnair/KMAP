'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSkillContext } from '@/contexts/SkillContext';
import { useRouter } from 'next/navigation';
import { SUBJECT_LABEL, type SubjectId } from '@/lib/subjects';

function levelBadgeColor(level: 1 | 2 | 3): string {
    if (level === 1) return 'bg-red-500/10 text-red-500 border-red-500/40';
    if (level === 2) return 'bg-amber-500/10 text-amber-500 border-amber-500/40';
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40';
}

export function SkillDashboard({ subjects }: { subjects: SubjectId[] }) {
    const { getSkill, lastScores } = useSkillContext();
    const router = useRouter();

    if (!subjects || subjects.length === 0) return null;

    return (
        <div className="mt-6 space-y-2">
            <h2 className="font-brand text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Subject Skill Levels
            </h2>
            <div className="space-y-3">
                {subjects.map(id => {
                    const level = getSkill(id);
                    const lastScore = lastScores[id] ?? null;
                    const pct = lastScore != null ? Math.max(0, Math.min(100, Math.round(lastScore))) : null;

                    return (
                        <Card key={id} className="p-4 flex items-center justify-between gap-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-brand text-sm font-semibold text-foreground">
                                        {SUBJECT_LABEL[id]}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`font-brand text-[11px] px-2 py-0.5 ${levelBadgeColor(level)}`}
                                    >
                                        Level {level}
                                    </Badge>
                                </div>
                                {pct != null && (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                            <span>Last score</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <Progress value={pct} className="h-1.5" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="font-brand text-xs"
                                    disabled={level >= 3}
                                    onClick={() => router.push(`/promotion/${id}?target=${level + 1}`)}
                                >
                                    {level >= 3 ? 'Max Level' : 'Attempt Promotion'}
                                </Button>
                                <p className="text-[10px] text-muted-foreground">
                                    Promotion test required to move up.
                                </p>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

