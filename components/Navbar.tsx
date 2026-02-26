'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function Navbar() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    return (
        <nav className="border-b border-border bg-card">
            <div className="container mx-auto flex h-14 items-center justify-between px-4">
                <Link href="/" className="font-brand text-lg font-bold tracking-tight text-foreground">
                    KMAP
                </Link>
                <div className="flex items-center gap-2">
                    {user ? (
                        <>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/dashboard">Subjects</Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/profile">Profile</Link>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/recovery">Recovery Key</Link>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                Logout
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/login">Login</Link>
                            </Button>
                            <Button size="sm" asChild>
                                <Link href="/signup">Sign Up</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
