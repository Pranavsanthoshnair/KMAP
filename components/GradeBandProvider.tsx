'use client';

import { useEffect, ReactNode } from 'react';
import { getLocalProfile } from '@/lib/indexeddb';

/**
 * GradeBandProvider — silently syncs the grade_band from IndexedDB
 * (set during signup) into localStorage so legacy code that reads
 * localStorage('grade_band') continues to work.
 *
 * The popup is intentionally removed — grade is collected at signup.
 */
export function GradeBandProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        getLocalProfile().then(profile => {
            if (profile?.gradeBand != null) {
                localStorage.setItem('grade_band', profile.gradeBand.toString());
            }
        }).catch(() => { /* silently ignore if IndexedDB is unavailable */ });
    }, []);

    return <>{children}</>;
}
