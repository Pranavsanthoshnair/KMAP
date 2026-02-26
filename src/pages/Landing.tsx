import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="animate-fade-in text-center">
          <h1 className="font-brand text-6xl font-bold tracking-tighter text-foreground sm:text-8xl">
            KMAP
          </h1>
          <p className="mt-4 font-brand text-sm tracking-widest text-muted-foreground">
            KNOWLEDGE ALLOCATED INTELLIGENTLY
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Login
            </Link>
          </div>
          <p className="mt-16 max-w-md text-xs leading-relaxed text-muted-foreground">
            Privacy-first adaptive learning through Knowledge Capsules.
            No videos. No chatbots. Minimal bandwidth. Offline capable.
          </p>
        </div>
      </main>
    </div>
  );
}
