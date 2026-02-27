'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Wifi, Image, Video, FileText, ArrowLeft } from 'lucide-react';

const LOW_DATA_KEY = 'kmap_low_data';

export default function SettingsPage() {
    const router = useRouter();
    const [lowDataMode, setLowDataMode] = useState(false);

    useEffect(() => {
        setLowDataMode(localStorage.getItem(LOW_DATA_KEY) === 'true');
    }, []);

    const toggle = (val: boolean) => {
        setLowDataMode(val);
        localStorage.setItem(LOW_DATA_KEY, String(val));
    };

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="container mx-auto max-w-lg px-4 py-10">
                <div className="animate-fade-in">

                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-6">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>

                    <h1 className="font-brand text-xl font-bold text-foreground">Settings</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Preferences stored locally on your device</p>

                    {/* Low Data Mode */}
                    <Card className="mt-6 p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Wifi className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="font-brand font-semibold text-foreground">Low Data Mode</p>
                                    <p className="text-xs text-muted-foreground">Reduce bandwidth usage</p>
                                </div>
                            </div>
                            <Switch
                                id="low-data"
                                checked={lowDataMode}
                                onCheckedChange={toggle}
                            />
                        </div>

                        {lowDataMode && (
                            <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3">
                                <p className="font-brand text-xs font-semibold text-foreground mb-2">
                                    When enabled:
                                </p>
                                <ul className="space-y-1.5">
                                    {[
                                        [Image, 'Thumbnails hidden'],
                                        [Video, 'Video resources excluded'],
                                        [FileText, 'Only text and small PDFs (< 500 KB)'],
                                    ].map(([Icon, label], i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            {label as string}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Card>

                    <p className="mt-6 text-xs text-muted-foreground">
                        All settings are stored locally. Nothing is sent to the server.
                    </p>
                </div>
            </main>
        </div>
    );
}
