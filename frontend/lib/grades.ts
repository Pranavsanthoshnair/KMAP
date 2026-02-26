/**
 * Shared grade band options and labels (1–5).
 * 1 = 1st grade (Classes 1–4), 2 = 2nd grade (Classes 5–8),
 * 3 = 3rd grade (Classes 9–10), 4 = 4th grade (+1/+2), 5 = 5th grade (College).
 */
export const GRADE_BAND_OPTIONS = [
    { value: 1, label: '1st grade (Classes 1–4)' },
    { value: 2, label: '2nd grade (Classes 5–8)' },
    { value: 3, label: '3rd grade (Classes 9–10)' },
    { value: 4, label: '4th grade (+1 / +2)' },
    { value: 5, label: '5th grade (College)' },
] as const;

export function getGradeLabel(band: number): string {
    const opt = GRADE_BAND_OPTIONS.find(o => o.value === band);
    return opt?.label ?? `Grade ${band}`;
}
