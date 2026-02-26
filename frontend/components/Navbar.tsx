'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function Navbar() {
    const { ready } = useAuth();

    return (
        <nav className="border-b border-border bg-card">
            <div className="container mx-auto flex h-14 items-center justify-between px-4">
                <Link href="/dashboard" className="font-brand text-lg font-bold tracking-tight text-foreground">
                    KMAP
                </Link>
                <div className="flex items-center gap-2">
                    {ready && (
                        <>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/subjects">Subjects</Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/profile">Profile</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
