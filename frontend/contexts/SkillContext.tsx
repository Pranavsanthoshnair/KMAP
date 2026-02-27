'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAllSubjectSkills, setSubjectSkill as setSubjectSkillIdb, touchSubjectAttendance as touchSubjectAttendanceIdb } from '@/lib/indexeddb';

export type SkillLevel = 1 | 2 | 3;

export type SkillMap = Record<string, SkillLevel>;
export type ScoreMap = Record<string, number>;

interface SkillContextType {
    skills: SkillMap;
    lastScores: ScoreMap;
    lastAttendedAt: Record<string, number>;
    getSkill: (subjectId: string) => SkillLevel;
    getLastAttendedAt: (subjectId: string) => number | undefined;
    updateSkill: (subjectId: string, level: SkillLevel, lastScore?: number) => void;
    touchSubjectAttendance: (subjectId: string) => void;
}

const SkillContext = createContext<SkillContextType | undefined>(undefined);

const LEGACY_STORAGE_KEY = 'kmap_subject_skills_v1';

/** One-time migration: read from localStorage and write to IndexedDB, then clear localStorage */
async function migrateFromLocalStorageIfPresent(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { skills?: SkillMap; lastScores?: ScoreMap };
        const skills = parsed.skills ?? {};
        const lastScores = parsed.lastScores ?? {};
        for (const [subjectId, level] of Object.entries(skills)) {
            if (level === 1 || level === 2 || level === 3) {
                await setSubjectSkillIdb(subjectId, level, lastScores[subjectId]);
            }
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
        // ignore
    }
}

export function SkillProvider({ children }: { children: ReactNode }) {
    const { ready } = useAuth();
    const [skills, setSkills] = useState<SkillMap>({});
    const [lastScores, setLastScores] = useState<ScoreMap>({});
    const [lastAttendedAt, setLastAttendedAt] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        (async () => {
            await migrateFromLocalStorageIfPresent();
            if (cancelled) return;
            const { skills: s, lastScores: ls, lastAttendedAt: lat } = await getAllSubjectSkills();
            setSkills(s);
            setLastScores(ls);
            setLastAttendedAt(lat ?? {});
        })();
        return () => {
            cancelled = true;
        };
    }, [ready]);

    const getSkill = useCallback(
        (subjectId: string): SkillLevel => {
            const key = subjectId.toLowerCase();
            const lvl = skills[key];
            if (lvl === 2 || lvl === 3) return lvl;
            return 1;
        },
        [skills],
    );

    const getLastAttendedAt = useCallback(
        (subjectId: string): number | undefined => lastAttendedAt[subjectId.toLowerCase()],
        [lastAttendedAt],
    );

    const updateSkill = useCallback((subjectId: string, level: SkillLevel, lastScore?: number) => {
        const key = subjectId.toLowerCase();
        const now = Date.now();
        setSkills(prev => ({ ...prev, [key]: level }));
        setLastScores(prev => {
            const next = { ...prev };
            if (typeof lastScore === 'number' && !Number.isNaN(lastScore)) {
                next[key] = lastScore;
            }
            return next;
        });
        setLastAttendedAt(prev => ({ ...prev, [key]: now }));
        setSubjectSkillIdb(key, level, lastScore).catch(() => {
            // ignore IDB errors — in-memory state still correct
        });
    }, []);

    const touchSubjectAttendance = useCallback((subjectId: string) => {
        const key = subjectId.toLowerCase();
        const now = Date.now();
        setLastAttendedAt(prev => ({ ...prev, [key]: now }));
        touchSubjectAttendanceIdb(key).catch(() => {});
    }, []);

    return (
        <SkillContext.Provider value={{ skills, lastScores, lastAttendedAt, getSkill, getLastAttendedAt, updateSkill, touchSubjectAttendance }}>
            {children}
        </SkillContext.Provider>
    );
}

export function useSkillContext(): SkillContextType {
    const ctx = useContext(SkillContext);
    if (!ctx) {
        throw new Error('useSkillContext must be used within SkillProvider');
    }
    return ctx;
}
