'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BadgeDefinition } from '@/lib/badges';

interface BadgeToastProps {
    badge: BadgeDefinition;
    onDismiss: () => void;
}

/** Self-dismissing animated toast shown when a badge is earned. */
export function BadgeToast({ badge, onDismiss }: BadgeToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Animate in
        const showTimer = setTimeout(() => setVisible(true), 50);
        // Auto-dismiss after 4 s
        const hideTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(onDismiss, 400); // wait for fade-out
        }, 4000);
        return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }, [onDismiss]);

    return (
        <div
            className={cn(
                'fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-border bg-card shadow-xl px-4 py-3 max-w-xs',
                'transition-all duration-400',
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3',
            )}
            style={{ width: '18rem' }}
        >
            {/* Glow ring behind emoji */}
            <div className="relative flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/30">
                <span className="text-2xl leading-none select-none" role="img" aria-label={badge.name}>
                    {badge.emoji}
                </span>
            </div>

            <div className="min-w-0">
                <p className="text-[10px] font-brand uppercase tracking-widest text-primary font-semibold">
                    Badge Unlocked!
                </p>
                <p className="font-brand text-sm font-bold text-foreground leading-snug mt-0.5">
                    {badge.name}
                </p>
                <p className="font-brand text-xs text-muted-foreground mt-0.5 leading-snug">
                    {badge.description}
                </p>
            </div>

            {/* Dismiss button */}
            <button
                onClick={() => { setVisible(false); setTimeout(onDismiss, 400); }}
                aria-label="Dismiss"
                className="ml-auto text-muted-foreground/60 hover:text-foreground transition-colors text-lg leading-none font-light self-start"
            >
                ×
            </button>

            {/* Bottom progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl bg-secondary">
                <div
                    className="h-full bg-primary"
                    style={{ animation: 'badge-drain 4s linear forwards' }}
                />
            </div>

            <style>{`
                @keyframes badge-drain {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>
        </div>
    );
}

/**
 * Renders a queue of badge toasts one at a time.
 * Pass the newly-earned badge array returned by checkAndAwardBadges().
 */
export function BadgeToastQueue({ badges }: { badges: BadgeDefinition[] }) {
    const [queue, setQueue] = useState<BadgeDefinition[]>(badges);
    const [showing, setShowing] = useState<BadgeDefinition | null>(badges[0] ?? null);

    useEffect(() => {
        setQueue(badges);
        setShowing(badges[0] ?? null);
    }, [badges]);

    const dismiss = () => {
        setQueue(prev => {
            const next = prev.slice(1);
            setShowing(next[0] ?? null);
            return next;
        });
    };

    if (!showing) return null;
    return <BadgeToast key={showing.id} badge={showing} onDismiss={dismiss} />;
}
