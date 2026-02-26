'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveLocalProfile, generateRecoveryKey } from '@/lib/indexeddb';

const GRADE_BANDS = [
    { value: '1', label: 'Classes 1–4' },
    { value: '2', label: 'Classes 5–8' },
    { value: '3', label: 'Classes 9–10' },
    { value: '4', label: 'Classes 11–12' },
    { value: '5', label: 'College' },
];

export default function Signup() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gradeBand, setGradeBand] = useState('1');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await signUp(email, password, name, parseInt(gradeBand));

        if (error) {
            toast({ title: 'Signup failed', description: error.message, variant: 'destructive' });
            setLoading(false);
            return;
        }

        const recoveryKey = generateRecoveryKey();
        await saveLocalProfile({
            id: 'local',
            name,
            gradeBand: parseInt(gradeBand),
            subjects: [],
            recoveryKey,
        });

        toast({ title: 'Welcome to KMAP!', description: 'Your account has been created.' });
        router.push('/dashboard');
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex flex-1 items-center justify-center px-4">
                <div className="w-full max-w-sm animate-fade-in">
                    <h1 className="font-brand text-2xl font-bold text-foreground">Sign Up</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Create your KMAP profile</p>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                        </div>
                        <div>
                            <Label>Grade Band</Label>
                            <Select value={gradeBand} onValueChange={setGradeBand}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {GRADE_BANDS.map((g) => (
                                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Account'}
                        </Button>
                    </form>
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link href="/login" className="text-primary hover:underline">Login</Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
