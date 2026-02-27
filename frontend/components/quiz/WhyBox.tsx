'use client';

/**
 * WhyBox — shows pre-generated explanation when user selects a wrong option.
 * Client-side only, no API, no logging. Does not block quiz flow.
 */
export default function WhyBox({ explanation }: { explanation: string }) {
    if (!explanation?.trim()) return null;
    return (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40">
            <p className="text-sm text-red-700 dark:text-red-300">{explanation}</p>
        </div>
    );
}
