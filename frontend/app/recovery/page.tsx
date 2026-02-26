'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Recovery keys are handled locally — redirect to profile. */
export default function RecoveryPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/profile'); }, [router]);
    return null;
}
