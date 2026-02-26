'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** No login needed — redirect straight to dashboard. */
export default function LoginPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/dashboard'); }, [router]);
    return null;
}
