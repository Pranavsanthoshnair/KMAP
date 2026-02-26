'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { SkillProvider } from '@/contexts/SkillContext';
import { GradeBandProvider } from '@/components/GradeBandProvider';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <AuthProvider>
                    <SkillProvider>
                        <GradeBandProvider>{children}</GradeBandProvider>
                    </SkillProvider>
                </AuthProvider>
            </TooltipProvider>
        </QueryClientProvider>
    );
}
