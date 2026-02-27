'use client';

/**
 * WhyBox — shows question-specific explanation when user selects a wrong option.
 * Client-side only, no API. Text is tailored to the question (from engine).
 */
export default function WhyBox({ explanation }: { explanation: string }) {
    if (!explanation?.trim()) return null;
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-brand text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200 mb-1.5">
                Why?
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">{explanation}</p>
        </div>
    );
}
