'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** No signup needed — redirect straight to dashboard. */
export default function SignupPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/dashboard'); }, [router]);
    return null;
}
