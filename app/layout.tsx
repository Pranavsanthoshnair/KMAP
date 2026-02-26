import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'KMAP – Knowledge Allocated Intelligently',
    description:
        'Privacy-first adaptive learning through Knowledge Capsules. No videos. No chatbots. Minimal bandwidth. Offline capable.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
