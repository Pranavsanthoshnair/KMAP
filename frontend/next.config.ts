import type { NextConfig } from 'next';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

// When running from monorepo root (npm run dev -w frontend), load .env.local from frontend dir
const cwd = process.cwd();
const envLocalPath = [
    path.join(cwd, '.env.local'),
    path.join(cwd, 'frontend', '.env.local'),
].find(p => existsSync(p));
if (envLocalPath) {
    const content = readFileSync(envLocalPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
                const key = trimmed.slice(0, eq).trim();
                let val = trimmed.slice(eq + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
                    val = val.slice(1, -1);
                if (!(key in process.env)) process.env[key] = val;
            }
        }
    }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Remove console.log in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Optimise package imports — tree-shake icon libraries aggressively
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-progress',
      '@radix-ui/react-badge',
    ],
  },
};

export default nextConfig;
