'use client';

/**
 * lib/data-tracker.ts
 *
 * Privacy-first local data usage tracker.
 * Stored in localStorage ONLY — never sent to server.
 *
 * Incremented on:
 *   • Quiz question fetch  (~2 KB estimate)
 *   • Resource metadata fetch (actual response size when known)
 *   • Resource opened (PDF/video) = size_kb from metadata
 */

const KEY = 'kmap_data_usage';
const LIMIT_KEY = 'kmap_daily_data_limit_kb';

/** Default daily limit in KB (10 MB). */
const DEFAULT_DAILY_LIMIT_KB = 10 * 1024;

interface DailyUsage {
    date: string;       // YYYY-MM-DD
    data_used_kb: number;
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function getDailyUsage(): DailyUsage {
    if (typeof window === 'undefined') return { date: today(), data_used_kb: 0 };

    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { date: today(), data_used_kb: 0 };

        const stored: DailyUsage = JSON.parse(raw);

        // Auto-reset on a new day
        if (stored.date !== today()) {
            const fresh: DailyUsage = { date: today(), data_used_kb: 0 };
            localStorage.setItem(KEY, JSON.stringify(fresh));
            return fresh;
        }

        return stored;
    } catch {
        return { date: today(), data_used_kb: 0 };
    }
}

export function incrementDataUsage(kb: number): void {
    if (typeof window === 'undefined' || kb <= 0) return;

    try {
        const current = getDailyUsage();
        const updated: DailyUsage = {
            date: today(),
            data_used_kb: Math.round((current.data_used_kb + kb) * 10) / 10,
        };
        localStorage.setItem(KEY, JSON.stringify(updated));
    } catch {
        // localStorage may be unavailable — silently skip
    }
}

export function resetDailyUsage(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify({ date: today(), data_used_kb: 0 }));
}

/** Get user-set daily data limit in KB (stored locally). */
export function getDailyLimitKb(): number {
    if (typeof window === 'undefined') return DEFAULT_DAILY_LIMIT_KB;
    try {
        const raw = localStorage.getItem(LIMIT_KEY);
        if (raw == null) return DEFAULT_DAILY_LIMIT_KB;
        const n = parseInt(raw, 10);
        if (Number.isNaN(n) || n < 1024) return DEFAULT_DAILY_LIMIT_KB; // min 1 MB
        return Math.min(100 * 1024, n); // cap 100 MB
    } catch {
        return DEFAULT_DAILY_LIMIT_KB;
    }
}

/** Set daily data limit in KB (e.g. 1024 = 1 MB). Min 1024, max 102400. */
export function setDailyLimitKb(kb: number): void {
    if (typeof window === 'undefined') return;
    const clamped = Math.max(1024, Math.min(102400, Math.round(kb)));
    localStorage.setItem(LIMIT_KEY, String(clamped));
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Call after fetching a batch of questions (~2 KB per question). */
export function trackQuestionsFetch(questionCount: number): void {
    incrementDataUsage(questionCount * 2);
}

/** Call after fetching resource metadata (rough estimate: 1 KB per resource). */
export function trackMetadataFetch(resourceCount: number): void {
    incrementDataUsage(resourceCount * 1);
}

/** Call when user opens a resource (PDF/video). size_kb from metadata. */
export function trackResourceOpen(sizeKb: number): void {
    incrementDataUsage(sizeKb);
}
