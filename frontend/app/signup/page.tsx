'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Signup just reuses the local profile flow on /login. */
export default function SignupPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/login'); }, [router]);
    return null;
}
