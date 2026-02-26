export type SubjectId = 'math' | 'science' | 'english';

/** Fallback when GET /api/subjects fails or returns empty */
export const FALLBACK_SUBJECTS: { id: SubjectId; label: string }[] = [
    { id: 'math', label: 'Mathematics' },
    { id: 'science', label: 'Science' },
    { id: 'english', label: 'English' },
];

export const SUBJECT_LABEL: Record<SubjectId, string> = Object.fromEntries(
    FALLBACK_SUBJECTS.map(s => [s.id, s.label])
) as Record<SubjectId, string>;

export interface SubjectOption {
    id: string;
    label: string;
}

/**
 * Fetch canonical subjects from API. Falls back to FALLBACK_SUBJECTS on error or empty.
 */
export async function fetchSubjects(): Promise<SubjectOption[]> {
    try {
        const res = await fetch('/api/subjects', { cache: 'no-store' });
        const data = (await res.json()) as { subjects?: { id: string; label: string }[] };
        const list = data.subjects ?? [];
        if (list.length > 0) return list;
    } catch {
        // ignore
    }
    return FALLBACK_SUBJECTS;
}

/**
 * Format a subject slug (e.g. "math") into a human‑friendly label.
 * Falls back to simple capitalization for unknown subjects.
 */
export function formatSubjectId(subject: string): string {
    const key = subject.toLowerCase() as SubjectId;
    if (key in SUBJECT_LABEL) {
        return SUBJECT_LABEL[key];
    }
    if (!subject) return '';
    return subject.charAt(0).toUpperCase() + subject.slice(1);
}

