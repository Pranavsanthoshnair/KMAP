const CAPSULE_DONE_PREFIX = 'kmap_capsule_done_';

export function getCapsuleDone(subject: string, gradeBand: number): { score: number; total: number } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(`${CAPSULE_DONE_PREFIX}${subject}_${gradeBand}`);
        if (!raw) return null;
        const data = JSON.parse(raw) as { score: number; total: number };
        if (typeof data?.score !== 'number' || typeof data?.total !== 'number') return null;
        return { score: data.score, total: data.total };
    } catch {
        return null;
    }
}

export function setCapsuleDone(subject: string, gradeBand: number, score: number, total: number) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(`${CAPSULE_DONE_PREFIX}${subject}_${gradeBand}`, JSON.stringify({ score, total }));
    } catch {
        // ignore
    }
}

export function clearCapsuleDone(subject: string, gradeBand: number) {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.removeItem(`${CAPSULE_DONE_PREFIX}${subject}_${gradeBand}`);
    } catch {
        // ignore
    }
}
