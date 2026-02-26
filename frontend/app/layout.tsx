import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// ── Fonts loaded via next/font — no render-blocking @import ──────────────────
const ibmPlexMono = IBM_Plex_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-brand',
    display: 'swap',
});

const inter = Inter({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600'],
    variable: '--font-body',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'KMAP – Knowledge Allocated Intelligently',
    description:
        'Privacy-first adaptive learning through Knowledge Capsules. No videos. No chatbots. Minimal bandwidth. Offline capable.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${ibmPlexMono.variable} ${inter.variable}`}>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
